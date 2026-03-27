import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import PgBoss from 'pg-boss';
import { prisma } from '../../lib/prisma.js';
import { loadReportData } from './report-data-loader.js';
import { generatePdf } from './pdf-generator.js';
import { generateExcel } from './excel-generator.js';

// ── pg-boss singleton ──────────────────────────────────────────────────────

export const EXPORT_QUEUE_NAME = 'export-generate';

let boss: PgBoss | null = null;

export function getExportBoss(): PgBoss | null {
	return boss;
}

// ── Exports directory ──────────────────────────────────────────────────────

function getExportsDir(): string {
	// Resolve relative to the project root (3 levels up from this file's directory)
	const thisDir = dirname(fileURLToPath(import.meta.url));
	return join(thisDir, '..', '..', '..', '..', '..', 'data', 'exports');
}

// ── Job handler ────────────────────────────────────────────────────────────

interface ExportJobPayload {
	jobId: number;
}

async function handleExportJobs(jobs: PgBoss.Job<ExportJobPayload>[]): Promise<void> {
	for (const job of jobs) {
		await processExportJob(job.data.jobId);
	}
}

async function processExportJob(jobId: number): Promise<void> {
	// 1. Load the ExportJob record
	const exportJob = await prisma.exportJob.findUnique({
		where: { id: jobId },
	});

	if (!exportJob) {
		return;
	}

	try {
		// 2. Mark as PROCESSING
		await prisma.exportJob.update({
			where: { id: jobId },
			data: { status: 'PROCESSING', progress: 10 },
		});

		// 3. Load report data
		const options = exportJob.comparisonVersionId
			? { comparisonVersionId: exportJob.comparisonVersionId }
			: undefined;
		const reportData = await loadReportData(
			prisma,
			exportJob.versionId,
			exportJob.reportType,
			options
		);

		await prisma.exportJob.update({
			where: { id: jobId },
			data: { progress: 50 },
		});

		// 4. Generate file based on format
		let fileBuffer: Buffer;
		let fileExt: string;

		if (exportJob.format === 'PDF') {
			fileBuffer = await generatePdf(reportData);
			fileExt = 'pdf';
		} else {
			fileBuffer = await generateExcel(reportData);
			fileExt = 'xlsx';
		}

		await prisma.exportJob.update({
			where: { id: jobId },
			data: { progress: 80 },
		});

		// 5. Write file to disk
		const exportsDir = getExportsDir();
		await mkdir(exportsDir, { recursive: true });

		const fileName = `${exportJob.reportType.toLowerCase()}-${jobId}-${Date.now()}.${fileExt}`;
		const filePath = join(exportsDir, fileName);
		await writeFile(filePath, fileBuffer);

		// 6. Mark as DONE
		await prisma.exportJob.update({
			where: { id: jobId },
			data: {
				status: 'DONE',
				progress: 100,
				filePath,
				completedAt: new Date(),
				expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h expiry
			},
		});
	} catch (err) {
		const errorMessage =
			err instanceof Error ? err.message : 'Unknown error during export generation';

		await prisma.exportJob.update({
			where: { id: jobId },
			data: {
				status: 'FAILED',
				errorMessage,
				completedAt: new Date(),
			},
		});
	}
}

// ── Worker initialization ──────────────────────────────────────────────────

export async function startExportWorker(): Promise<void> {
	const connectionString = process.env.DATABASE_URL;
	if (!connectionString) {
		return;
	}

	boss = new PgBoss(connectionString);
	await boss.start();

	// pg-boss v10 requires explicit queue creation before send/work.
	// Without this, send() silently drops jobs (INSERT JOINs pgboss.queue).
	await boss.createQueue(EXPORT_QUEUE_NAME);

	await boss.work<ExportJobPayload>(EXPORT_QUEUE_NAME, handleExportJobs);
}

export async function stopExportWorker(): Promise<void> {
	if (boss) {
		await boss.stop();
		boss = null;
	}
}

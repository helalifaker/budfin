import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createReadStream, existsSync } from 'node:fs';
import { prisma } from '../lib/prisma.js';
import { getExportBoss, EXPORT_QUEUE_NAME } from '../services/export/export-worker.js';

// ── Schemas ────────────────────────────────────────────────────────────────

const REPORT_TYPES = [
	'PNL',
	'REVENUE',
	'STAFFING',
	'OPEX',
	'ENROLLMENT',
	'DASHBOARD',
	'FULL_BUDGET',
] as const;

const FORMATS = ['PDF', 'EXCEL'] as const;

/** Reports that expose salary-level data and require salary:view permission. */
const SALARY_REPORTS = new Set<string>(['STAFFING']);

const createJobBody = z.object({
	versionId: z.number().int().positive(),
	reportType: z.enum(REPORT_TYPES),
	format: z.enum(FORMATS),
	comparisonVersionId: z.number().int().positive().optional(),
});

const jobIdParams = z.object({
	id: z.coerce.number().int().positive(),
});

// ── Helpers ────────────────────────────────────────────────────────────────

const CONTENT_TYPE_MAP: Record<string, string> = {
	PDF: 'application/pdf',
	EXCEL: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

const FILE_EXT_MAP: Record<string, string> = {
	PDF: 'pdf',
	EXCEL: 'xlsx',
};

// ── Routes ─────────────────────────────────────────────────────────────────

export async function exportRoutes(app: FastifyInstance) {
	// POST /jobs — Create an export job and enqueue it via pg-boss
	app.post('/jobs', {
		schema: {
			body: createJobBody,
		},
		preHandler: [app.authenticate, app.requirePermission('data:view')],
		handler: async (request, reply) => {
			const { versionId, reportType, format, comparisonVersionId } = request.body as z.infer<
				typeof createJobBody
			>;

			// Salary-related reports require salary:view
			if (SALARY_REPORTS.has(reportType)) {
				const { ROLE_PERMISSIONS } = await import('../lib/rbac.js');
				const userPerms = ROLE_PERMISSIONS[request.user.role];
				if (!userPerms?.has('salary:view')) {
					return reply.status(403).send({
						code: 'FORBIDDEN',
						message: 'Salary reports require salary:view permission',
					});
				}
			}

			// Validate version exists
			const version = await prisma.budgetVersion.findUnique({
				where: { id: versionId },
				select: { id: true },
			});

			if (!version) {
				return reply.status(404).send({
					code: 'VERSION_NOT_FOUND',
					message: `Version ${versionId} not found`,
				});
			}

			// Validate comparison version if provided
			if (comparisonVersionId) {
				const compVersion = await prisma.budgetVersion.findUnique({
					where: { id: comparisonVersionId },
					select: { id: true },
				});
				if (!compVersion) {
					return reply.status(404).send({
						code: 'COMPARISON_VERSION_NOT_FOUND',
						message: `Comparison version ${comparisonVersionId} not found`,
					});
				}
			}

			// Fail fast if the export worker is not running — otherwise the job
			// would be created in PENDING state with no worker to process it.
			const boss = getExportBoss();
			if (!boss) {
				return reply.status(503).send({
					code: 'EXPORT_WORKER_UNAVAILABLE',
					message: 'Export service is temporarily unavailable. Please try again.',
				});
			}

			// Create the ExportJob record
			const job = await prisma.exportJob.create({
				data: {
					versionId,
					reportType,
					format,
					status: 'PENDING',
					progress: 0,
					comparisonVersionId: comparisonVersionId ?? null,
					createdById: request.user.id,
				},
			});

			// Enqueue the pg-boss job (returns null if queue doesn't exist)
			const pgBossId = await boss.send(EXPORT_QUEUE_NAME, { jobId: job.id });

			if (!pgBossId) {
				await prisma.exportJob.update({
					where: { id: job.id },
					data: { status: 'FAILED', errorMessage: 'Failed to enqueue export job' },
				});
				return reply.status(503).send({
					code: 'EXPORT_WORKER_UNAVAILABLE',
					message: 'Export service failed to queue the job. Please try again.',
				});
			}

			return reply.status(201).send({
				id: job.id,
				status: job.status,
				progress: job.progress,
				createdAt: job.createdAt.toISOString(),
			});
		},
	});

	// GET /jobs/:id — Poll job status
	app.get('/jobs/:id', {
		schema: {
			params: jobIdParams,
		},
		preHandler: [app.authenticate, app.requirePermission('data:view')],
		handler: async (request, reply) => {
			const { id } = request.params as z.infer<typeof jobIdParams>;

			const job = await prisma.exportJob.findUnique({
				where: { id },
			});

			if (!job) {
				return reply.status(404).send({
					code: 'EXPORT_JOB_NOT_FOUND',
					message: `Export job ${id} not found`,
				});
			}

			// Creator check: only the user who created the job can poll it
			if (job.createdById !== request.user.id) {
				return reply.status(403).send({
					code: 'FORBIDDEN',
					message: 'You can only access your own export jobs',
				});
			}

			const response: Record<string, unknown> = {
				id: job.id,
				status: job.status,
				progress: job.progress,
				createdAt: job.createdAt.toISOString(),
			};

			if (job.status === 'DONE') {
				response.downloadUrl = `/api/v1/export/jobs/${job.id}/download`;
				response.completedAt = job.completedAt?.toISOString();
			}

			if (job.status === 'FAILED') {
				response.errorMessage = job.errorMessage;
			}

			return response;
		},
	});

	// GET /jobs/:id/download — Stream the generated file
	app.get('/jobs/:id/download', {
		schema: {
			params: jobIdParams,
		},
		preHandler: [app.authenticate, app.requirePermission('data:view')],
		handler: async (request, reply) => {
			const { id } = request.params as z.infer<typeof jobIdParams>;

			const job = await prisma.exportJob.findUnique({
				where: { id },
			});

			if (!job) {
				return reply.status(404).send({
					code: 'EXPORT_JOB_NOT_FOUND',
					message: `Export job ${id} not found`,
				});
			}

			// Creator check
			if (job.createdById !== request.user.id) {
				return reply.status(403).send({
					code: 'FORBIDDEN',
					message: 'You can only download your own export files',
				});
			}

			if (job.status !== 'DONE' || !job.filePath) {
				return reply.status(409).send({
					code: 'EXPORT_NOT_READY',
					message: 'Export job has not completed yet',
				});
			}

			if (!existsSync(job.filePath)) {
				return reply.status(410).send({
					code: 'EXPORT_FILE_GONE',
					message: 'Export file has been cleaned up',
				});
			}

			const contentType = CONTENT_TYPE_MAP[job.format] ?? 'application/octet-stream';
			const ext = FILE_EXT_MAP[job.format] ?? 'bin';
			const filename = `${job.reportType.toLowerCase()}-export-${job.id}.${ext}`;

			return reply
				.header('Content-Type', contentType)
				.header('Content-Disposition', `attachment; filename="${filename}"`)
				.send(createReadStream(job.filePath));
		},
	});
}

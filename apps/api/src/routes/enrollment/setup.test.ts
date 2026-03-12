import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { generateKeyPair } from 'jose';
import { auth } from '../../plugins/auth.js';
import { prisma } from '../../lib/prisma.js';
import { enrollmentSetupRoutes } from './setup.js';
import { setKeys, signAccessToken } from '../../services/token.js';

vi.mock('../../services/enrollment-workspace.js', () => ({
	calculateAndPersistEnrollmentWorkspace: vi.fn().mockResolvedValue({
		runId: 'setup-run-1',
		durationMs: 12,
		summary: {
			totalStudentsAy1: 330,
			totalStudentsAy2: 322,
			overCapacityGrades: [],
		},
		results: [],
	}),
	markEnrollmentInputsStale: vi.fn().mockResolvedValue(['ENROLLMENT', 'REVENUE']),
	normalizeCohortMutations: vi.fn((entries: unknown) => entries),
}));

vi.mock('../../lib/prisma.js', () => {
	const mockPrisma = {
		budgetVersion: {
			findUnique: vi.fn(),
			findMany: vi.fn(),
			update: vi.fn().mockResolvedValue({}),
		},
		gradeLevel: {
			findMany: vi.fn(),
		},
		enrollmentHeadcount: {
			findMany: vi.fn(),
			upsert: vi.fn().mockResolvedValue({}),
		},
		cohortParameter: {
			upsert: vi.fn().mockResolvedValue({}),
		},
		auditEntry: {
			create: vi.fn().mockResolvedValue({ id: 1 }),
		},
		$transaction: vi.fn().mockImplementation((fn: (tx: Record<string, unknown>) => unknown) =>
			fn({
				budgetVersion: mockPrisma.budgetVersion,
				gradeLevel: mockPrisma.gradeLevel,
				enrollmentHeadcount: mockPrisma.enrollmentHeadcount,
				cohortParameter: mockPrisma.cohortParameter,
				auditEntry: mockPrisma.auditEntry,
			})
		),
	};
	return { prisma: mockPrisma };
});

import {
	calculateAndPersistEnrollmentWorkspace,
	markEnrollmentInputsStale,
} from '../../services/enrollment-workspace.js';

const mockPrisma = prisma as unknown as {
	budgetVersion: {
		findUnique: ReturnType<typeof vi.fn>;
		findMany: ReturnType<typeof vi.fn>;
		update: ReturnType<typeof vi.fn>;
	};
	gradeLevel: {
		findMany: ReturnType<typeof vi.fn>;
	};
	enrollmentHeadcount: {
		findMany: ReturnType<typeof vi.fn>;
		upsert: ReturnType<typeof vi.fn>;
	};
	cohortParameter: {
		upsert: ReturnType<typeof vi.fn>;
	};
	auditEntry: {
		create: ReturnType<typeof vi.fn>;
	};
	$transaction: ReturnType<typeof vi.fn>;
};

const mockCalculateAndPersistEnrollmentWorkspace =
	calculateAndPersistEnrollmentWorkspace as unknown as ReturnType<typeof vi.fn>;
const mockMarkEnrollmentInputsStale = markEnrollmentInputsStale as unknown as ReturnType<
	typeof vi.fn
>;

const ROUTE_PREFIX = '/api/v1/versions/:versionId/enrollment';
const URL_PREFIX = '/api/v1/versions/1/enrollment';

const gradeLevels = [
	{ gradeCode: 'PS', gradeName: 'Petite Section', band: 'MATERNELLE', displayOrder: 1 },
	{ gradeCode: 'MS', gradeName: 'Moyenne Section', band: 'MATERNELLE', displayOrder: 2 },
	{ gradeCode: 'GS', gradeName: 'Grande Section', band: 'MATERNELLE', displayOrder: 3 },
	{ gradeCode: 'CP', gradeName: 'Cours Preparatoire', band: 'ELEMENTAIRE', displayOrder: 4 },
	{ gradeCode: 'CE1', gradeName: 'Cours Elementaire 1', band: 'ELEMENTAIRE', displayOrder: 5 },
	{ gradeCode: 'CE2', gradeName: 'Cours Elementaire 2', band: 'ELEMENTAIRE', displayOrder: 6 },
	{ gradeCode: 'CM1', gradeName: 'Cours Moyen 1', band: 'ELEMENTAIRE', displayOrder: 7 },
	{ gradeCode: 'CM2', gradeName: 'Cours Moyen 2', band: 'ELEMENTAIRE', displayOrder: 8 },
	{ gradeCode: '6EME', gradeName: 'Sixieme', band: 'COLLEGE', displayOrder: 9 },
	{ gradeCode: '5EME', gradeName: 'Cinquieme', band: 'COLLEGE', displayOrder: 10 },
	{ gradeCode: '4EME', gradeName: 'Quatrieme', band: 'COLLEGE', displayOrder: 11 },
	{ gradeCode: '3EME', gradeName: 'Troisieme', band: 'COLLEGE', displayOrder: 12 },
	{ gradeCode: '2NDE', gradeName: 'Seconde', band: 'LYCEE', displayOrder: 13 },
	{ gradeCode: '1ERE', gradeName: 'Premiere', band: 'LYCEE', displayOrder: 14 },
	{ gradeCode: 'TERM', gradeName: 'Terminale', band: 'LYCEE', displayOrder: 15 },
];

let app: FastifyInstance;

async function makeToken(overrides: { sub?: number; role?: string } = {}) {
	return signAccessToken({
		sub: overrides.sub ?? 1,
		email: 'admin@budfin.app',
		role: overrides.role ?? 'Admin',
		sessionId: 'test-session-id',
	});
}

function authHeader(token: string) {
	return { authorization: `Bearer ${token}` };
}

function buildMultipart(
	csvContent: string,
	fields: Record<string, string> = {}
): { body: Buffer; contentType: string } {
	const boundary = '----EnrollmentSetupBoundary123';
	let body = '';

	for (const [name, value] of Object.entries(fields)) {
		body += `--${boundary}\r\n`;
		body += `Content-Disposition: form-data; name="${name}"\r\n\r\n`;
		body += `${value}\r\n`;
	}

	body += `--${boundary}\r\n`;
	body += 'Content-Disposition: form-data; name="file"; filename="enrollment.csv"\r\n';
	body += 'Content-Type: text/csv\r\n\r\n';
	body += `${csvContent}\r\n`;
	body += `--${boundary}--\r\n`;

	return {
		body: Buffer.from(body),
		contentType: `multipart/form-data; boundary=${boundary}`,
	};
}

beforeAll(async () => {
	const keys = await generateKeyPair('RS256');
	setKeys(keys.privateKey, keys.publicKey);
});

beforeEach(async () => {
	vi.clearAllMocks();

	app = Fastify();
	app.setValidatorCompiler(validatorCompiler);
	app.setSerializerCompiler(serializerCompiler);
	await app.register(auth);
	await app.register(enrollmentSetupRoutes, { prefix: ROUTE_PREFIX });
	await app.ready();
});

describe('GET /setup-baseline', () => {
	it('returns the locked prior-year Actual AY2 baseline', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValueOnce({ id: 1, fiscalYear: 2026 });
		mockPrisma.gradeLevel.findMany.mockResolvedValueOnce(gradeLevels);
		mockPrisma.budgetVersion.findMany.mockResolvedValueOnce([
			{
				id: 41,
				name: 'Actual FY2025 Working',
				fiscalYear: 2025,
				status: 'Published',
				updatedAt: new Date('2026-01-01T00:00:00Z'),
			},
			{
				id: 42,
				name: 'Actual FY2025 Locked',
				fiscalYear: 2025,
				status: 'Locked',
				updatedAt: new Date('2025-12-31T00:00:00Z'),
			},
		]);
		mockPrisma.enrollmentHeadcount.findMany.mockResolvedValueOnce([
			{ gradeLevel: 'PS', headcount: 90 },
			{ gradeLevel: 'MS', headcount: 96 },
		]);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/setup-baseline`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		expect(res.json().available).toBe(true);
		expect(res.json().sourceVersion.id).toBe(42);
		expect(res.json().entries[0]).toEqual(
			expect.objectContaining({
				gradeLevel: 'PS',
				baselineHeadcount: 90,
			})
		);
	});
});

describe('POST /setup-import/validate', () => {
	it('returns normalized preview rows and diffs without persisting', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValueOnce({ id: 1 });
		mockPrisma.gradeLevel.findMany.mockResolvedValueOnce(gradeLevels);

		const { body, contentType } = buildMultipart('grade_level,student_count\nPS,95\nMS,100\n', {
			baseline: JSON.stringify([
				{ gradeLevel: 'PS', headcount: 90 },
				{ gradeLevel: 'MS', headcount: 96 },
			]),
		});

		const token = await makeToken();
		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/setup-import/validate`,
			headers: {
				...authHeader(token),
				'content-type': contentType,
			},
			payload: body,
		});

		expect(res.statusCode).toBe(200);
		expect(res.json().validRows).toBe(2);
		expect(res.json().summary.importTotal).toBe(195);
		expect(res.json().preview[0]).toEqual(
			expect.objectContaining({
				gradeLevel: 'PS',
				baselineHeadcount: 90,
				importedHeadcount: 95,
				delta: 5,
			})
		);
		expect(mockPrisma.enrollmentHeadcount.upsert).not.toHaveBeenCalled();
	});
});

describe('POST /setup/apply', () => {
	it('persists staged inputs and runs the enrollment calculation atomically', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValueOnce({
			id: 1,
			fiscalYear: 2026,
			status: 'Draft',
			dataSource: 'MANUAL',
			staleModules: [],
			rolloverThreshold: 1,
			cappedRetention: 0.98,
		});
		mockPrisma.gradeLevel.findMany.mockResolvedValueOnce(
			gradeLevels.map((gradeLevel) => ({ gradeCode: gradeLevel.gradeCode }))
		);

		const token = await makeToken();
		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/setup/apply`,
			headers: authHeader(token),
			payload: {
				ay1Entries: gradeLevels.map((gradeLevel, index) => ({
					gradeLevel: gradeLevel.gradeCode,
					headcount: 80 + index,
				})),
				cohortEntries: gradeLevels.map((gradeLevel, index) => ({
					gradeLevel: gradeLevel.gradeCode,
					retentionRate: gradeLevel.gradeCode === 'PS' ? 0 : 0.97,
					lateralEntryCount: gradeLevel.gradeCode === 'PS' ? 0 : index % 3,
					lateralWeightFr: index % 3 > 0 ? 0.3333 : 0,
					lateralWeightNat: index % 3 > 0 ? 0.3334 : 0,
					lateralWeightAut: index % 3 > 0 ? 0.3333 : 0,
				})),
				psAy2Headcount: 92,
				planningRules: {
					rolloverThreshold: 1.03,
					cappedRetention: 0.99,
				},
			},
		});

		expect(res.statusCode).toBe(200);
		expect(res.json().runId).toBe('setup-run-1');
		expect(mockPrisma.enrollmentHeadcount.upsert).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					versionId_academicPeriod_gradeLevel: {
						versionId: 1,
						academicPeriod: 'AY2',
						gradeLevel: 'PS',
					},
				},
				update: expect.objectContaining({
					headcount: 92,
				}),
			})
		);
		expect(mockPrisma.budgetVersion.update).toHaveBeenCalledWith({
			where: { id: 1 },
			data: {
				rolloverThreshold: '1.0300',
				cappedRetention: '0.9900',
			},
		});
		expect(mockPrisma.cohortParameter.upsert).toHaveBeenCalledTimes(15);
		expect(mockMarkEnrollmentInputsStale).toHaveBeenCalled();
		expect(mockCalculateAndPersistEnrollmentWorkspace).toHaveBeenCalled();
	});

	it('rejects setup apply when lateral weights do not sum to 1.0', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValueOnce({
			id: 1,
			fiscalYear: 2026,
			status: 'Draft',
			dataSource: 'MANUAL',
			staleModules: [],
			rolloverThreshold: 1,
			cappedRetention: 0.98,
		});
		mockPrisma.gradeLevel.findMany.mockResolvedValueOnce(
			gradeLevels.map((gradeLevel) => ({ gradeCode: gradeLevel.gradeCode }))
		);

		const token = await makeToken();
		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/setup/apply`,
			headers: authHeader(token),
			payload: {
				ay1Entries: gradeLevels.map((gradeLevel, index) => ({
					gradeLevel: gradeLevel.gradeCode,
					headcount: 80 + index,
				})),
				cohortEntries: gradeLevels.map((gradeLevel, index) => ({
					gradeLevel: gradeLevel.gradeCode,
					retentionRate: gradeLevel.gradeCode === 'PS' ? 0 : 0.97,
					lateralEntryCount: gradeLevel.gradeCode === 'PS' ? 0 : index === 1 ? 5 : 0,
					lateralWeightFr: gradeLevel.gradeCode === 'PS' ? 0 : index === 1 ? 0.4 : 0,
					lateralWeightNat: gradeLevel.gradeCode === 'PS' ? 0 : index === 1 ? 0.4 : 0,
					lateralWeightAut: gradeLevel.gradeCode === 'PS' ? 0 : index === 1 ? 0.1 : 0,
				})),
				psAy2Headcount: 92,
			},
		});

		expect(res.statusCode).toBe(422);
		expect(res.json()).toEqual(
			expect.objectContaining({
				code: 'LATERAL_WEIGHT_SUM_INVALID',
			})
		);
		expect(mockPrisma.enrollmentHeadcount.upsert).not.toHaveBeenCalled();
		expect(mockCalculateAndPersistEnrollmentWorkspace).not.toHaveBeenCalled();
	});
});

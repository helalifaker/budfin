import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { generateKeyPair } from 'jose';
import { auth } from '../../plugins/auth.js';
import { prisma } from '../../lib/prisma.js';
import { enrollmentSettingsRoutes } from './settings.js';
import { setKeys, signAccessToken } from '../../services/token.js';

vi.mock('../../lib/prisma.js', () => {
	const mockPrisma = {
		budgetVersion: {
			findUnique: vi.fn(),
			update: vi.fn(),
		},
		gradeLevel: {
			findMany: vi.fn(),
		},
		versionCapacityConfig: {
			findMany: vi.fn(),
			upsert: vi.fn(),
		},
		auditEntry: {
			create: vi.fn().mockResolvedValue({ id: 1 }),
		},
		$transaction: vi.fn().mockImplementation((fn: (tx: Record<string, unknown>) => unknown) =>
			fn({
				budgetVersion: mockPrisma.budgetVersion,
				gradeLevel: mockPrisma.gradeLevel,
				versionCapacityConfig: mockPrisma.versionCapacityConfig,
				auditEntry: mockPrisma.auditEntry,
			})
		),
	};
	return { prisma: mockPrisma };
});

const mockPrisma = prisma as unknown as {
	budgetVersion: {
		findUnique: ReturnType<typeof vi.fn>;
		update: ReturnType<typeof vi.fn>;
	};
	gradeLevel: {
		findMany: ReturnType<typeof vi.fn>;
	};
	versionCapacityConfig: {
		findMany: ReturnType<typeof vi.fn>;
		upsert: ReturnType<typeof vi.fn>;
	};
	auditEntry: {
		create: ReturnType<typeof vi.fn>;
	};
	$transaction: ReturnType<typeof vi.fn>;
};

const ROUTE_PREFIX = '/api/v1/versions/:versionId/enrollment';
const URL_PREFIX = '/api/v1/versions/1/enrollment';

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
	await app.register(enrollmentSettingsRoutes, { prefix: ROUTE_PREFIX });
	await app.ready();
});

describe('GET /settings', () => {
	it('returns version-scoped rules and capacity rows', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValueOnce({
			id: 1,
			rolloverThreshold: '1.0300',
			cappedRetention: '0.9900',
			retentionRecentWeight: '0.6500',
			historicalTargetRecentWeight: '0.8500',
		});
		mockPrisma.gradeLevel.findMany.mockResolvedValueOnce([
			{
				gradeCode: 'PS',
				gradeName: 'Petite Section',
				band: 'MATERNELLE',
				displayOrder: 1,
				defaultAy2Intake: 66,
				maxClassSize: 25,
				plancherPct: '0.7000',
				ciblePct: '0.8000',
				plafondPct: '1.0000',
			},
		]);
		mockPrisma.versionCapacityConfig.findMany.mockResolvedValueOnce([
			{
				gradeLevel: 'PS',
				maxClassSize: 24,
				plancherPct: '0.6500',
				ciblePct: '0.7800',
				plafondPct: '0.9500',
			},
		]);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/settings`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		expect(res.json()).toEqual({
			rules: {
				rolloverThreshold: 1.03,
				cappedRetention: 0.99,
				retentionRecentWeight: 0.65,
				historicalTargetRecentWeight: 0.85,
			},
			capacityByGrade: [
				{
					gradeLevel: 'PS',
					gradeName: 'Petite Section',
					band: 'MATERNELLE',
					displayOrder: 1,
					defaultAy2Intake: 66,
					maxClassSize: 24,
					plancherPct: 0.65,
					ciblePct: 0.78,
					plafondPct: 0.95,
					templateMaxClassSize: 25,
					templatePlancherPct: 0.7,
					templateCiblePct: 0.8,
					templatePlafondPct: 1,
				},
			],
		});
	});
});

describe('PUT /settings', () => {
	it('updates rules and grade planning config, then marks downstream modules stale', async () => {
		mockPrisma.budgetVersion.findUnique
			.mockResolvedValueOnce({
				id: 1,
				status: 'Draft',
				dataSource: 'MANUAL',
				staleModules: ['ENROLLMENT'],
			})
			.mockResolvedValueOnce({
				id: 1,
				rolloverThreshold: '1.0200',
				cappedRetention: '0.9900',
				retentionRecentWeight: '0.6000',
				historicalTargetRecentWeight: '0.8000',
			});
		mockPrisma.gradeLevel.findMany
			.mockResolvedValueOnce([{ gradeCode: 'PS' }])
			.mockResolvedValueOnce([
				{
					gradeCode: 'PS',
					gradeName: 'Petite Section',
					band: 'MATERNELLE',
					displayOrder: 1,
					defaultAy2Intake: 66,
					maxClassSize: 25,
					plancherPct: '0.7000',
					ciblePct: '0.8000',
					plafondPct: '1.0000',
				},
			]);
		mockPrisma.versionCapacityConfig.findMany.mockResolvedValueOnce([
			{
				gradeLevel: 'PS',
				maxClassSize: 23,
				plancherPct: '0.6800',
				ciblePct: '0.7900',
				plafondPct: '0.9600',
			},
		]);

		const token = await makeToken();
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/settings`,
			headers: authHeader(token),
			payload: {
				rules: {
					rolloverThreshold: 1.02,
					cappedRetention: 0.99,
					retentionRecentWeight: 0.6,
					historicalTargetRecentWeight: 0.8,
				},
				capacityByGrade: [
					{
						gradeLevel: 'PS',
						maxClassSize: 23,
						plancherPct: 0.68,
						ciblePct: 0.79,
						plafondPct: 0.96,
					},
				],
			},
		});

		expect(res.statusCode).toBe(200);
		expect(mockPrisma.budgetVersion.update).toHaveBeenCalledWith({
			where: { id: 1 },
			data: {
				rolloverThreshold: '1.0200',
				cappedRetention: '0.9900',
				retentionRecentWeight: '0.6000',
				historicalTargetRecentWeight: '0.8000',
				staleModules: ['ENROLLMENT', 'DHG', 'STAFFING', 'PNL'],
			},
		});
		expect(mockPrisma.versionCapacityConfig.upsert).toHaveBeenCalledWith({
			where: {
				versionId_gradeLevel: {
					versionId: 1,
					gradeLevel: 'PS',
				},
			},
			create: {
				versionId: 1,
				gradeLevel: 'PS',
				maxClassSize: 23,
				plancherPct: '0.6800',
				ciblePct: '0.7900',
				plafondPct: '0.9600',
			},
			update: {
				maxClassSize: 23,
				plancherPct: '0.6800',
				ciblePct: '0.7900',
				plafondPct: '0.9600',
			},
		});
		expect(res.json()).toEqual({
			rules: {
				rolloverThreshold: 1.02,
				cappedRetention: 0.99,
				retentionRecentWeight: 0.6,
				historicalTargetRecentWeight: 0.8,
			},
			capacityByGrade: [
				{
					gradeLevel: 'PS',
					gradeName: 'Petite Section',
					band: 'MATERNELLE',
					displayOrder: 1,
					defaultAy2Intake: 66,
					maxClassSize: 23,
					plancherPct: 0.68,
					ciblePct: 0.79,
					plafondPct: 0.96,
					templateMaxClassSize: 25,
					templatePlancherPct: 0.7,
					templateCiblePct: 0.8,
					templatePlafondPct: 1,
				},
			],
			staleModules: ['ENROLLMENT', 'DHG', 'STAFFING', 'PNL'],
		});
	});

	it('returns 409 IMPORTED_VERSION when editing an imported version', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValueOnce({
			id: 1,
			status: 'Draft',
			dataSource: 'IMPORTED',
			staleModules: [],
		});

		const token = await makeToken();
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/settings`,
			headers: authHeader(token),
			payload: {
				rules: {
					rolloverThreshold: 1,
					cappedRetention: 0.98,
					retentionRecentWeight: 0.6,
					historicalTargetRecentWeight: 0.8,
				},
				capacityByGrade: [
					{
						gradeLevel: 'PS',
						maxClassSize: 25,
						plancherPct: 0.7,
						ciblePct: 0.8,
						plafondPct: 1,
					},
				],
			},
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('IMPORTED_VERSION');
	});
});

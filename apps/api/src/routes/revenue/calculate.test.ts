import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { generateKeyPair } from 'jose';
import { auth } from '../../plugins/auth.js';
import { revenueCalculateRoutes } from './calculate.js';
import { setKeys, signAccessToken } from '../../services/token.js';
import { buildCanonicalDynamicOtherRevenueRows } from '../../services/revenue-config.js';
import { DerivedRevenueConfigurationError } from '../../services/derived-revenue.js';

// ── Mock revenue engine ─────────────────────────────────────────────────────

const mockCalculateRevenue = vi.fn();
vi.mock('../../services/revenue-engine.js', () => ({
	calculateRevenue: (...args: unknown[]) => mockCalculateRevenue(...args),
}));

// ── Mock derived revenue ────────────────────────────────────────────────────

const mockComputeAllDerivedRevenue = vi.fn().mockReturnValue([]);
vi.mock('../../services/derived-revenue.js', () => ({
	DerivedRevenueConfigurationError: class DerivedRevenueConfigurationError extends Error {
		code: string;
		details?: unknown;

		constructor(code: string, message: string, details?: unknown) {
			super(message);
			this.code = code;
			this.details = details;
		}
	},
	computeAllDerivedRevenue: (...args: unknown[]) => mockComputeAllDerivedRevenue(...args),
}));

// ── Mock Prisma ─────────────────────────────────────────────────────────────

vi.mock('../../lib/prisma.js', () => {
	const mockPrisma = {
		budgetVersion: {
			findUnique: vi.fn(),
			update: vi.fn(),
		},
		enrollmentDetail: { findMany: vi.fn() },
		feeGrid: { findMany: vi.fn() },
		discountPolicy: { findMany: vi.fn() },
		otherRevenueItem: { findMany: vi.fn(), update: vi.fn() },
		enrollmentHeadcount: { findMany: vi.fn() },
		cohortParameter: { findMany: vi.fn() },
		versionRevenueSettings: { findUnique: vi.fn() },
		calculationAuditLog: {
			create: vi.fn().mockResolvedValue({ id: 1 }),
			updateMany: vi.fn().mockResolvedValue({ count: 1 }),
		},
		monthlyRevenue: {
			deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
			createMany: vi.fn().mockResolvedValue({ count: 0 }),
		},
		monthlyOtherRevenue: {
			deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
			createMany: vi.fn().mockResolvedValue({ count: 0 }),
		},
		auditEntry: {
			create: vi.fn().mockResolvedValue({ id: 1 }),
		},
		$transaction: vi
			.fn()
			.mockImplementation((fn: (tx: Record<string, unknown>) => unknown) => fn(mockPrisma)),
	};
	return { prisma: mockPrisma };
});

import { prisma } from '../../lib/prisma.js';

const mockPrisma = prisma as unknown as {
	budgetVersion: {
		findUnique: ReturnType<typeof vi.fn>;
		update: ReturnType<typeof vi.fn>;
	};
	enrollmentDetail: { findMany: ReturnType<typeof vi.fn> };
	feeGrid: { findMany: ReturnType<typeof vi.fn> };
	discountPolicy: { findMany: ReturnType<typeof vi.fn> };
	otherRevenueItem: { findMany: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
	enrollmentHeadcount: { findMany: ReturnType<typeof vi.fn> };
	cohortParameter: { findMany: ReturnType<typeof vi.fn> };
	versionRevenueSettings: { findUnique: ReturnType<typeof vi.fn> };
	calculationAuditLog: {
		create: ReturnType<typeof vi.fn>;
		updateMany: ReturnType<typeof vi.fn>;
	};
	monthlyRevenue: {
		deleteMany: ReturnType<typeof vi.fn>;
		createMany: ReturnType<typeof vi.fn>;
	};
	monthlyOtherRevenue: {
		deleteMany: ReturnType<typeof vi.fn>;
		createMany: ReturnType<typeof vi.fn>;
	};
	$transaction: ReturnType<typeof vi.fn>;
};

let app: FastifyInstance;

async function makeToken(role = 'Admin') {
	return signAccessToken({
		sub: 1,
		email: 'admin@budfin.app',
		role,
		sessionId: 'calc-session',
	});
}

function authHeader(token: string) {
	return { authorization: `Bearer ${token}` };
}

const ROUTE_PREFIX = '/api/v1/versions/:versionId/calculate';
const URL_PREFIX = '/api/v1/versions/1/calculate';

const mockVersion = {
	id: 1,
	name: 'Budget v1',
	status: 'Draft',
	dataSource: 'CALCULATED',
	staleModules: ['REVENUE'],
};

const mockEngineResult = {
	tuitionRevenue: [
		{
			academicPeriod: 'AY1',
			gradeLevel: 'PS',
			nationality: 'Francais',
			tariff: 'RP',
			month: 1,
			grossRevenueHt: '1000.0000',
			discountAmount: '100.0000',
			netRevenueHt: '900.0000',
			vatAmount: '135.0000',
		},
	],
	otherRevenue: [
		{
			lineItemName: 'Registration Fees AY1',
			ifrsCategory: 'Registration Fees',
			executiveCategory: 'REGISTRATION_FEES',
			month: 1,
			amount: '200.0000',
		},
	],
	totals: {
		grossRevenueHt: '1000.0000',
		totalDiscounts: '100.0000',
		netRevenueHt: '900.0000',
		totalVat: '135.0000',
		totalOtherRevenue: '200.0000',
		totalExecutiveOtherRevenue: '200.0000',
		totalOperatingRevenue: '1100.0000',
	},
};

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
	await app.register(revenueCalculateRoutes, { prefix: ROUTE_PREFIX });
	await app.ready();

	mockPrisma.enrollmentDetail.findMany.mockResolvedValue([]);
	mockPrisma.feeGrid.findMany.mockResolvedValue([]);
	mockPrisma.discountPolicy.findMany.mockResolvedValue([]);
	mockPrisma.otherRevenueItem.findMany.mockResolvedValue(
		buildCanonicalDynamicOtherRevenueRows().map((item, index) => ({
			id: index + 1,
			...item,
			specificMonths: item.specificMonths ?? [],
		}))
	);
	mockPrisma.enrollmentHeadcount.findMany.mockResolvedValue([]);
	mockPrisma.cohortParameter.findMany.mockResolvedValue(
		[
			'MS',
			'GS',
			'CP',
			'CE1',
			'CE2',
			'CM1',
			'CM2',
			'6EME',
			'5EME',
			'4EME',
			'3EME',
			'2NDE',
			'1ERE',
			'TERM',
		].map((gradeLevel) => ({
			gradeLevel,
			appliedRetentionRate: '0.9700',
			retainedFromPrior: 0,
			historicalTargetHeadcount: null,
			derivedLaterals: 0,
			usesConfiguredRetention: true,
		}))
	);
	mockPrisma.versionRevenueSettings.findUnique.mockResolvedValue({
		dpiPerStudentHt: '2000.0000',
		dossierPerStudentHt: '1000.0000',
		examBacPerStudent: '2000.0000',
		examDnbPerStudent: '600.0000',
		examEafPerStudent: '800.0000',
		evalPrimairePerStudent: '200.0000',
		evalSecondairePerStudent: '300.0000',
	});
	mockPrisma.budgetVersion.update.mockResolvedValue({});
	mockComputeAllDerivedRevenue.mockReturnValue([]);
});

describe('POST /calculate/revenue', () => {
	it('calculates revenue successfully and returns summary', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockVersion);
		mockCalculateRevenue.mockReturnValue(mockEngineResult);

		const token = await makeToken('Editor');
		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/revenue`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.runId).toBeTruthy();
		expect(body.durationMs).toBeGreaterThanOrEqual(0);
		expect(body.summary).toEqual({
			grossRevenueHt: '1000.0000',
			totalDiscounts: '100.0000',
			netRevenueHt: '900.0000',
			totalVat: '135.0000',
			totalOtherRevenue: '200.0000',
			totalExecutiveOtherRevenue: '200.0000',
			totalOperatingRevenue: '1100.0000',
		});
		expect(body.tuitionRowCount).toBe(1);
		expect(body.otherRevenueRowCount).toBe(1);
	});

	it('returns reporting-aligned summary totals for mapped items outside the raw executive bucket', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockVersion);
		mockCalculateRevenue.mockReturnValue({
			tuitionRevenue: [
				{
					academicPeriod: 'AY1',
					gradeLevel: 'PS',
					nationality: 'Francais',
					tariff: 'Plein',
					month: 1,
					grossRevenueHt: '1000.0000',
					discountAmount: '100.0000',
					netRevenueHt: '900.0000',
					vatAmount: '135.0000',
				},
			],
			otherRevenue: [
				{
					lineItemName: 'Daycare',
					ifrsCategory: 'Other Revenue',
					executiveCategory: null,
					month: 1,
					amount: '75.0000',
				},
			],
			totals: {
				grossRevenueHt: '1000.0000',
				totalDiscounts: '100.0000',
				netRevenueHt: '900.0000',
				totalVat: '135.0000',
				totalOtherRevenue: '75.0000',
				totalExecutiveOtherRevenue: '0.0000',
				totalOperatingRevenue: '900.0000',
			},
		});

		const token = await makeToken();
		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/revenue`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		expect(res.json().summary).toEqual({
			grossRevenueHt: '1000.0000',
			totalDiscounts: '100.0000',
			netRevenueHt: '900.0000',
			totalVat: '135.0000',
			totalOtherRevenue: '75.0000',
			totalExecutiveOtherRevenue: '75.0000',
			totalOperatingRevenue: '975.0000',
		});
	});

	it('persists tuition and other-revenue rows in a transaction', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockVersion);
		mockCalculateRevenue.mockReturnValue(mockEngineResult);

		const token = await makeToken();
		await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/revenue`,
			headers: authHeader(token),
		});

		expect(mockPrisma.monthlyRevenue.deleteMany).toHaveBeenCalledWith({
			where: { versionId: 1, scenarioName: 'Base' },
		});
		expect(mockPrisma.monthlyRevenue.createMany).toHaveBeenCalledOnce();
		expect(mockPrisma.monthlyOtherRevenue.createMany).toHaveBeenCalledOnce();
		expect(mockPrisma.calculationAuditLog.create).toHaveBeenCalledOnce();
		expect(mockPrisma.calculationAuditLog.updateMany).toHaveBeenCalledOnce();
	});

	it('removes REVENUE and marks downstream modules stale after calculation', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue({
			...mockVersion,
			staleModules: ['REVENUE', 'PNL'],
		});
		mockCalculateRevenue.mockReturnValue(mockEngineResult);

		const token = await makeToken();
		await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/revenue`,
			headers: authHeader(token),
		});

		expect(mockPrisma.budgetVersion.update).toHaveBeenCalledWith({
			where: { id: 1 },
			data: { staleModules: ['PNL', 'STAFFING'] },
		});
	});

	it('adds STAFFING and PNL when staleModules starts empty', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue({
			...mockVersion,
			staleModules: [],
		});
		mockCalculateRevenue.mockReturnValue(mockEngineResult);

		const token = await makeToken();
		await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/revenue`,
			headers: authHeader(token),
		});

		expect(mockPrisma.budgetVersion.update).toHaveBeenCalledWith({
			where: { id: 1 },
			data: { staleModules: ['STAFFING', 'PNL'] },
		});
	});

	it('preserves existing STAFFING while adding PNL', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue({
			...mockVersion,
			staleModules: ['REVENUE', 'STAFFING'],
		});
		mockCalculateRevenue.mockReturnValue(mockEngineResult);

		const token = await makeToken();
		await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/revenue`,
			headers: authHeader(token),
		});

		expect(mockPrisma.budgetVersion.update).toHaveBeenCalledWith({
			where: { id: 1 },
			data: { staleModules: ['STAFFING', 'PNL'] },
		});
	});

	it('returns 404 for non-existent version', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(null);

		const token = await makeToken();
		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/revenue`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('VERSION_NOT_FOUND');
	});

	it('returns 409 for non-Draft version (locked)', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue({
			...mockVersion,
			status: 'Published',
		});

		const token = await makeToken();
		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/revenue`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('VERSION_LOCKED');
	});

	it('returns 409 for imported version', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue({
			...mockVersion,
			dataSource: 'IMPORTED',
		});

		const token = await makeToken();
		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/revenue`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('IMPORTED_VERSION');
	});

	it('returns 409 when enrollment outputs are stale', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue({
			...mockVersion,
			staleModules: ['ENROLLMENT'],
		});

		const token = await makeToken();
		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/revenue`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('ENROLLMENT_STALE');
	});

	it('returns 422 when version-scoped revenue settings are missing', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockVersion);
		mockPrisma.versionRevenueSettings.findUnique.mockResolvedValue(null);

		const token = await makeToken();
		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/revenue`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(422);
		expect(res.json().code).toBe('REVENUE_SETTINGS_MISSING');
	});

	it('returns 422 when dynamic other-revenue rows are incomplete', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockVersion);
		mockPrisma.otherRevenueItem.findMany.mockResolvedValue([]);

		const token = await makeToken();
		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/revenue`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(422);
		expect(res.json().code).toBe('DYNAMIC_OTHER_REVENUE_INVALID');
	});

	it('returns 422 when derived revenue validation fails with DAI_MISMATCH', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockVersion);
		mockComputeAllDerivedRevenue.mockImplementationOnce(() => {
			throw new DerivedRevenueConfigurationError(
				'DAI_MISMATCH',
				'DAI values must match across AY2 tariffs for CP|Francais.',
				{ gradeLevel: 'CP', nationality: 'Francais' }
			);
		});

		const token = await makeToken();
		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/revenue`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(422);
		expect(res.json().code).toBe('DAI_MISMATCH');
		expect(res.json().details).toBeDefined();
	});

	it('returns 422 when derived revenue validation fails with DAI_RATE_MISSING', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockVersion);
		mockComputeAllDerivedRevenue.mockImplementationOnce(() => {
			throw new DerivedRevenueConfigurationError(
				'DAI_RATE_MISSING',
				'No Plein tariff DAI rate found for CP|Francais.',
				{ gradeLevel: 'CP', nationality: 'Francais' }
			);
		});

		const token = await makeToken();
		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/revenue`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(422);
		expect(res.json().code).toBe('DAI_RATE_MISSING');
		expect(res.json().details).toBeDefined();
	});

	it('updates dynamic OtherRevenueItem annualAmount with computed derived value', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockVersion);
		mockCalculateRevenue.mockReturnValue(mockEngineResult);
		// Return a single matching derived item
		mockComputeAllDerivedRevenue.mockReturnValue([
			{
				lineItemName: 'DAI - Francais',
				annualAmount: '7500.0000',
				distributionMethod: 'SPECIFIC_PERIOD',
				weightArray: null,
				specificMonths: [5, 6],
				ifrsCategory: 'Registration Fees',
			},
		]);

		const token = await makeToken();
		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/revenue`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		// DAI - Francais is the first canonical item, id = 1 in the default mock
		expect(mockPrisma.otherRevenueItem.update).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { id: 1 },
				data: { annualAmount: '7500.0000' },
			})
		);
	});

	it('handles empty enrollment data gracefully', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockVersion);
		mockCalculateRevenue.mockReturnValue({
			tuitionRevenue: [],
			otherRevenue: [],
			totals: {
				grossRevenueHt: '0.0000',
				totalDiscounts: '0.0000',
				netRevenueHt: '0.0000',
				totalVat: '0.0000',
				totalOtherRevenue: '0.0000',
				totalExecutiveOtherRevenue: '0.0000',
				totalOperatingRevenue: '0.0000',
			},
		});

		const token = await makeToken();
		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/revenue`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		expect(res.json().tuitionRowCount).toBe(0);
		expect(res.json().otherRevenueRowCount).toBe(0);
	});

	it('returns 403 for Viewer role', async () => {
		const token = await makeToken('Viewer');
		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/revenue`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(403);
		expect(res.json().code).toBe('FORBIDDEN');
	});

	it('returns 401 without authentication', async () => {
		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/revenue`,
		});

		expect(res.statusCode).toBe(401);
	});
});

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { generateKeyPair } from 'jose';
import { setKeys, signAccessToken } from '../../services/token.js';
import { auth } from '../../plugins/auth.js';
import { staffingCalculateRoutes } from './calculate.js';

// ── Mock crypto-helper ──────────────────────────────────────────────────────

vi.mock('../../services/staffing/crypto-helper.js', () => ({
	getEncryptionKey: vi.fn().mockReturnValue('test-encryption-key'),
	resetEncryptionKey: vi.fn(),
}));

// ── Mock calculation engines ────────────────────────────────────────────────

const mockCalculateDHG = vi.fn();
vi.mock('../../services/staffing/dhg-engine.js', () => ({
	calculateDHG: (...args: unknown[]) => mockCalculateDHG(...args),
}));

const mockCalculateEmployeeAnnualCost = vi.fn();
vi.mock('../../services/staffing/cost-engine.js', () => ({
	calculateEmployeeAnnualCost: (...args: unknown[]) => mockCalculateEmployeeAnnualCost(...args),
}));

const mockCalculateCategoryMonthlyCosts = vi.fn();
vi.mock('../../services/staffing/category-cost-engine.js', () => ({
	calculateCategoryMonthlyCosts: (...args: unknown[]) => mockCalculateCategoryMonthlyCosts(...args),
}));

// ── Mock Prisma ─────────────────────────────────────────────────────────────

vi.mock('../../lib/prisma.js', () => {
	const mockPrisma = {
		budgetVersion: {
			findUnique: vi.fn(),
		},
		enrollmentHeadcount: {
			count: vi.fn(),
			findMany: vi.fn(),
		},
		employee: {
			count: vi.fn(),
		},
		gradeLevel: {
			findMany: vi.fn(),
		},
		versionCapacityConfig: {
			findMany: vi.fn().mockResolvedValue([]),
		},
		dhgGrilleConfig: {
			findMany: vi.fn(),
		},
		dhgRequirement: {
			upsert: vi.fn(),
		},
		monthlyStaffCost: {
			deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
			createMany: vi.fn().mockResolvedValue({ count: 0 }),
		},
		eosProvision: {
			deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
			create: vi.fn().mockResolvedValue({ id: 1 }),
		},
		categoryMonthlyCost: {
			deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
			createMany: vi.fn().mockResolvedValue({ count: 0 }),
		},
		systemConfig: {
			findMany: vi.fn(),
		},
		calculationAuditLog: {
			create: vi.fn().mockResolvedValue({ id: 1 }),
		},
		auditEntry: {
			create: vi.fn().mockResolvedValue({ id: 1 }),
		},
		$queryRawUnsafe: vi.fn(),
		$executeRaw: vi.fn(),
	};
	return { prisma: mockPrisma };
});

import { prisma } from '../../lib/prisma.js';

const mockPrisma = prisma as unknown as {
	budgetVersion: { findUnique: ReturnType<typeof vi.fn> };
	enrollmentHeadcount: {
		count: ReturnType<typeof vi.fn>;
		findMany: ReturnType<typeof vi.fn>;
	};
	employee: { count: ReturnType<typeof vi.fn> };
	gradeLevel: { findMany: ReturnType<typeof vi.fn> };
	versionCapacityConfig: { findMany: ReturnType<typeof vi.fn> };
	dhgGrilleConfig: { findMany: ReturnType<typeof vi.fn> };
	dhgRequirement: { upsert: ReturnType<typeof vi.fn> };
	monthlyStaffCost: {
		deleteMany: ReturnType<typeof vi.fn>;
		createMany: ReturnType<typeof vi.fn>;
	};
	eosProvision: {
		deleteMany: ReturnType<typeof vi.fn>;
		create: ReturnType<typeof vi.fn>;
	};
	categoryMonthlyCost: {
		deleteMany: ReturnType<typeof vi.fn>;
		createMany: ReturnType<typeof vi.fn>;
	};
	systemConfig: { findMany: ReturnType<typeof vi.fn> };
	calculationAuditLog: { create: ReturnType<typeof vi.fn> };
	$queryRawUnsafe: ReturnType<typeof vi.fn>;
	$executeRaw: ReturnType<typeof vi.fn>;
};

// ── Helpers ─────────────────────────────────────────────────────────────────

let app: FastifyInstance;

async function makeToken(role = 'Admin') {
	return signAccessToken({
		sub: 1,
		email: 'admin@budfin.app',
		role,
		sessionId: 'test-session-id',
	});
}

function authHeader(token: string) {
	return { authorization: `Bearer ${token}` };
}

const ROUTE_PREFIX = '/api/v1/versions/:versionId/calculate';
const URL_PREFIX = '/api/v1/versions/1/calculate';

const mockDraftVersion = {
	id: 1,
	name: 'Budget v1',
	status: 'Draft',
	fiscalYear: 2026,
	staleModules: ['STAFFING'],
};

// ── Setup ───────────────────────────────────────────────────────────────────

beforeAll(async () => {
	const keys = await generateKeyPair('RS256');
	setKeys(keys.privateKey, keys.publicKey);
});

beforeEach(async () => {
	vi.clearAllMocks();

	app = Fastify({ logger: false });
	app.setValidatorCompiler(validatorCompiler);
	app.setSerializerCompiler(serializerCompiler);
	await app.register(auth);
	await app.register(staffingCalculateRoutes, { prefix: ROUTE_PREFIX });
	await app.ready();
});

// ── POST /calculate/staffing ────────────────────────────────────────────────

describe('POST /calculate/staffing', () => {
	it('returns 401 without auth', async () => {
		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/staffing`,
		});
		expect(res.statusCode).toBe(401);
	});

	it('returns 403 for Viewer role (no data:edit permission)', async () => {
		const token = await makeToken('Viewer');

		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/staffing`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(403);
		expect(res.json().code).toBe('FORBIDDEN');
	});

	it('returns 404 when version not found', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(null);
		const token = await makeToken();

		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/staffing`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('VERSION_NOT_FOUND');
	});

	it('returns 409 when version is locked', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue({
			...mockDraftVersion,
			status: 'Locked',
		});
		const token = await makeToken();

		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/staffing`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('VERSION_LOCKED');
	});

	it('returns 422 when enrollment data is missing', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockDraftVersion);
		mockPrisma.enrollmentHeadcount.count.mockResolvedValue(0);
		mockPrisma.employee.count.mockResolvedValue(5);
		const token = await makeToken();

		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/staffing`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(422);
		expect(res.json().code).toBe('MISSING_PREREQUISITES');
		expect(res.json().missing).toContain('ENROLLMENT');
	});

	it('returns 422 when employee data is missing', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockDraftVersion);
		mockPrisma.enrollmentHeadcount.count.mockResolvedValue(10);
		mockPrisma.employee.count.mockResolvedValue(0);
		const token = await makeToken();

		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/staffing`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(422);
		expect(res.json().code).toBe('MISSING_PREREQUISITES');
		expect(res.json().missing).toContain('EMPLOYEES');
	});

	it('calculates staffing successfully and returns summary', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockDraftVersion);
		mockPrisma.enrollmentHeadcount.count.mockResolvedValue(5);
		mockPrisma.employee.count.mockResolvedValue(3);

		// DHG calculation inputs
		mockPrisma.enrollmentHeadcount.findMany.mockResolvedValue([
			{
				id: 1,
				versionId: 1,
				gradeLevel: 'CP',
				headcount: 25,
				academicPeriod: '2025-2026',
			},
		]);
		mockPrisma.gradeLevel.findMany.mockResolvedValue([{ gradeCode: 'CP', maxClassSize: 28 }]);
		mockPrisma.dhgGrilleConfig.findMany.mockResolvedValue([]);

		const { Decimal } = await import('decimal.js');
		mockCalculateDHG.mockReturnValue([
			{
				gradeLevel: 'CP',
				sectionsNeeded: 1,
				totalWeeklyHours: new Decimal('26'),
				totalAnnualHours: new Decimal('936'),
				fte: new Decimal('1.5'),
			},
		]);

		// Employee cost calculation inputs
		mockPrisma.$queryRawUnsafe.mockResolvedValue([
			{
				id: 1,
				employee_code: 'EMP001',
				status: 'Existing',
				is_saudi: false,
				is_ajeer: false,
				is_teaching: true,
				joining_date: new Date('2023-09-01'),
				base_salary: '5000',
				housing_allowance: '1000',
				transport_allowance: '500',
				responsibility_premium: '0',
				hsa_amount: '0',
				augmentation: '0',
				ajeer_annual_levy: '0',
				ajeer_monthly_fee: '0',
			},
		]);

		const zeroDecimal = new Decimal('0');
		const monthData = Array.from({ length: 12 }, (_, i) => ({
			month: i + 1,
			baseGross: new Decimal('5000'),
			adjustedGross: new Decimal('5000'),
			housingAllowance: new Decimal('1000'),
			transportAllowance: new Decimal('500'),
			responsibilityPremium: zeroDecimal,
			hsaAmount: zeroDecimal,
			gosiAmount: new Decimal('500'),
			ajeerAmount: zeroDecimal,
			eosMonthlyAccrual: new Decimal('100'),
			totalCost: new Decimal('7100'),
		}));

		mockCalculateEmployeeAnnualCost.mockReturnValue({
			months: monthData,
			eos: {
				yearsOfService: new Decimal('2.5'),
				eosBase: new Decimal('6000'),
				eosAnnual: new Decimal('3000'),
				eosMonthlyAccrual: new Decimal('250'),
			},
		});

		mockPrisma.systemConfig.findMany.mockResolvedValue([]);

		mockCalculateCategoryMonthlyCosts.mockReturnValue([
			{ month: 1, category: 'remplacements', amount: new Decimal('100') },
		]);

		mockPrisma.$executeRaw.mockResolvedValue(1);

		const token = await makeToken();

		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/staffing`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.run_id).toBeDefined();
		expect(body.duration_ms).toBeDefined();
		expect(body.summary).toBeDefined();
		expect(body.summary.total_fte).toBe('1.5000');

		// Verify calculation engines were called
		expect(mockCalculateDHG).toHaveBeenCalledOnce();
		expect(mockCalculateEmployeeAnnualCost).toHaveBeenCalledOnce();

		// Verify stale flag was cleared
		expect(mockPrisma.$executeRaw).toHaveBeenCalled();

		// Verify audit log
		expect(mockPrisma.calculationAuditLog.create).toHaveBeenCalledOnce();
	});

	it('allows Editor role (has data:edit permission)', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockDraftVersion);
		mockPrisma.enrollmentHeadcount.count.mockResolvedValue(0);
		mockPrisma.employee.count.mockResolvedValue(0);
		const token = await makeToken('Editor');

		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/staffing`,
			headers: authHeader(token),
		});

		// Editor can reach the handler (422 is business logic, not auth)
		expect(res.statusCode).toBe(422);
	});
});

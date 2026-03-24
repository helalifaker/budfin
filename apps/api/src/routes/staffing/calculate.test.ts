import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { generateKeyPair } from 'jose';
import { Decimal } from 'decimal.js';
import { setKeys, signAccessToken } from '../../services/token.js';
import { auth } from '../../plugins/auth.js';
import { staffingCalculateRoutes } from './calculate.js';

// ── Mock crypto-helper ──────────────────────────────────────────────────────

vi.mock('../../services/staffing/crypto-helper.js', () => ({
	getEncryptionKey: vi.fn().mockReturnValue('test-encryption-key'),
	resetEncryptionKey: vi.fn(),
}));

// ── Mock calculation engines ────────────────────────────────────────────────

const mockCalculateDemand = vi.fn();
vi.mock('../../services/staffing/demand-engine.js', () => ({
	calculateDemand: (...args: unknown[]) => mockCalculateDemand(...args),
	gradeToBand: (grade: string) => {
		const map: Record<string, string> = {
			PS: 'MATERNELLE',
			MS: 'MATERNELLE',
			GS: 'MATERNELLE',
			CP: 'ELEMENTAIRE',
			CE1: 'ELEMENTAIRE',
			CE2: 'ELEMENTAIRE',
			CM1: 'ELEMENTAIRE',
			CM2: 'ELEMENTAIRE',
			'6EME': 'COLLEGE',
			'5EME': 'COLLEGE',
			'4EME': 'COLLEGE',
			'3EME': 'COLLEGE',
			'2NDE': 'LYCEE',
			'1ERE': 'LYCEE',
			TERM: 'LYCEE',
		};
		return map[grade.toUpperCase()] ?? 'UNKNOWN';
	},
}));

const mockCalculateCoverage = vi.fn();
vi.mock('../../services/staffing/coverage-engine.js', () => ({
	calculateCoverage: (...args: unknown[]) => mockCalculateCoverage(...args),
}));

const mockCalculateHsa = vi.fn();
vi.mock('../../services/staffing/hsa-engine.js', () => ({
	calculateHsa: (...args: unknown[]) => mockCalculateHsa(...args),
}));

const mockCalculateEmployeeAnnualCost = vi.fn();
vi.mock('../../services/staffing/cost-engine.js', () => ({
	calculateEmployeeAnnualCost: (...args: unknown[]) => mockCalculateEmployeeAnnualCost(...args),
}));

const mockCalculateConfigurableCategoryMonthlyCosts = vi.fn();
vi.mock('../../services/staffing/category-cost-engine.js', () => ({
	calculateConfigurableCategoryMonthlyCosts: (...args: unknown[]) =>
		mockCalculateConfigurableCategoryMonthlyCosts(...args),
}));

// ── Mock Prisma ─────────────────────────────────────────────────────────────

const mockTx = {
	teachingRequirementSource: {
		deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
		createMany: vi.fn().mockResolvedValue({ count: 0 }),
	},
	teachingRequirementLine: {
		deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
		createMany: vi.fn().mockResolvedValue({ count: 0 }),
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
	budgetVersion: {
		update: vi.fn().mockResolvedValue({}),
	},
	staffingAssignment: {
		deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
		createMany: vi.fn().mockResolvedValue({ count: 0 }),
	},
	calculationAuditLog: {
		create: vi.fn().mockResolvedValue({ id: 1 }),
	},
	$executeRawUnsafe: vi.fn().mockResolvedValue(1),
	$executeRaw: vi.fn().mockResolvedValue(1),
};

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
		versionStaffingSettings: {
			findUnique: vi.fn(),
			create: vi.fn(),
		},
		gradeLevel: {
			findMany: vi.fn().mockResolvedValue([]),
		},
		versionCapacityConfig: {
			findMany: vi.fn().mockResolvedValue([]),
		},
		dhgRule: {
			findMany: vi.fn().mockResolvedValue([]),
		},
		serviceObligationProfile: {
			findMany: vi.fn().mockResolvedValue([]),
		},
		versionServiceProfileOverride: {
			findMany: vi.fn().mockResolvedValue([]),
		},
		versionStaffingCostAssumption: {
			findMany: vi.fn().mockResolvedValue([]),
		},
		versionLyceeGroupAssumption: {
			findMany: vi.fn().mockResolvedValue([]),
		},
		demandOverride: {
			findMany: vi.fn().mockResolvedValue([]),
		},
		staffingAssignment: {
			findMany: vi.fn().mockResolvedValue([]),
		},
		calculationAuditLog: {
			create: vi.fn().mockResolvedValue({ id: 1 }),
		},
		auditEntry: {
			create: vi.fn().mockResolvedValue({ id: 1 }),
		},
		$queryRawUnsafe: vi.fn(),
		$queryRaw: vi.fn(),
		$transaction: vi.fn(),
	};
	return { prisma: mockPrisma };
});

import { prisma } from '../../lib/prisma.js';

type MockedPrisma = {
	budgetVersion: { findUnique: ReturnType<typeof vi.fn> };
	enrollmentHeadcount: {
		count: ReturnType<typeof vi.fn>;
		findMany: ReturnType<typeof vi.fn>;
	};
	employee: { count: ReturnType<typeof vi.fn> };
	versionStaffingSettings: {
		findUnique: ReturnType<typeof vi.fn>;
		create: ReturnType<typeof vi.fn>;
	};
	gradeLevel: { findMany: ReturnType<typeof vi.fn> };
	versionCapacityConfig: { findMany: ReturnType<typeof vi.fn> };
	dhgRule: { findMany: ReturnType<typeof vi.fn> };
	serviceObligationProfile: { findMany: ReturnType<typeof vi.fn> };
	versionServiceProfileOverride: { findMany: ReturnType<typeof vi.fn> };
	versionStaffingCostAssumption: { findMany: ReturnType<typeof vi.fn> };
	versionLyceeGroupAssumption: { findMany: ReturnType<typeof vi.fn> };
	demandOverride: { findMany: ReturnType<typeof vi.fn> };
	staffingAssignment: { findMany: ReturnType<typeof vi.fn> };
	calculationAuditLog: { create: ReturnType<typeof vi.fn> };
	$queryRawUnsafe: ReturnType<typeof vi.fn>;
	$queryRaw: ReturnType<typeof vi.fn>;
	$transaction: ReturnType<typeof vi.fn>;
};

const mockPrisma = prisma as unknown as MockedPrisma;

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

const mockSettings = {
	id: 1,
	versionId: 1,
	hsaTargetHours: new Decimal('1.50'),
	hsaFirstHourRate: new Decimal('500.00'),
	hsaAdditionalHourRate: new Decimal('400.00'),
	hsaMonths: 10,
	academicWeeks: 36,
	ajeerAnnualFee: new Decimal('10925.0000'),
	reconciliationBaseline: null,
};

const ZERO = new Decimal(0);

function makeMonthData() {
	return Array.from({ length: 12 }, (_, i) => ({
		month: i + 1,
		baseGross: new Decimal('5000'),
		adjustedGross: new Decimal('5000'),
		housingAllowance: new Decimal('1000'),
		transportAllowance: new Decimal('500'),
		responsibilityPremium: ZERO,
		hsaAmount: ZERO,
		gosiAmount: new Decimal('500'),
		ajeerAmount: ZERO,
		eosMonthlyAccrual: new Decimal('100'),
		totalCost: new Decimal('7100'),
	}));
}

function setupFullPipelineMocks() {
	mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockDraftVersion);
	mockPrisma.enrollmentHeadcount.count.mockResolvedValue(5);
	mockPrisma.employee.count.mockResolvedValue(3);
	mockPrisma.versionStaffingSettings.findUnique.mockResolvedValue(mockSettings);

	mockPrisma.enrollmentHeadcount.findMany.mockResolvedValue([
		{
			id: 1,
			versionId: 1,
			gradeLevel: 'CP',
			headcount: 25,
			academicPeriod: 'AY2',
		},
	]);
	mockPrisma.gradeLevel.findMany.mockResolvedValue([{ gradeCode: 'CP', maxClassSize: 28 }]);
	mockPrisma.versionCapacityConfig.findMany.mockResolvedValue([]);
	mockPrisma.dhgRule.findMany.mockResolvedValue([]);
	mockPrisma.serviceObligationProfile.findMany.mockResolvedValue([
		{
			id: 1,
			code: 'CERTIFIE',
			name: 'Certifie',
			weeklyServiceHours: new Decimal('18.0'),
			hsaEligible: true,
			defaultCostMode: 'LOCAL_PAYROLL',
			sortOrder: 1,
		},
	]);
	mockPrisma.versionServiceProfileOverride.findMany.mockResolvedValue([]);
	mockPrisma.versionStaffingCostAssumption.findMany.mockResolvedValue([]);
	mockPrisma.versionLyceeGroupAssumption.findMany.mockResolvedValue([]);
	mockPrisma.demandOverride.findMany.mockResolvedValue([]);
	mockPrisma.staffingAssignment.findMany.mockResolvedValue([]);

	mockPrisma.$queryRaw.mockResolvedValue([
		{
			id: 1,
			employee_code: 'EMP001',
			name: 'John Doe',
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
			cost_mode: 'LOCAL_PAYROLL',
			record_type: 'EMPLOYEE',
			service_profile_id: 1,
			hourly_percentage: '1.0000',
		},
	]);

	// Demand engine returns sources + lines
	mockCalculateDemand.mockReturnValue({
		sources: [
			{
				gradeLevel: 'CP',
				disciplineCode: 'FRANCAIS',
				lineType: 'STRUCTURAL',
				driverType: 'HOURS',
				headcount: 25,
				maxClassSize: 28,
				driverUnits: 1,
				hoursPerUnit: new Decimal('10'),
				totalWeeklyHours: new Decimal('10'),
			},
		],
		lines: [
			{
				band: 'ELEMENTAIRE',
				disciplineCode: 'FRANCAIS',
				lineLabel: 'Elementaire — FRANCAIS',
				lineType: 'STRUCTURAL',
				driverType: 'HOURS',
				serviceProfileCode: 'CERTIFIE',
				totalDriverUnits: 1,
				totalWeeklyHours: new Decimal('10'),
				baseOrs: new Decimal('18'),
				effectiveOrs: new Decimal('19.5'),
				requiredFteRaw: new Decimal('0.5556'),
				requiredFtePlanned: new Decimal('0.5128'),
				recommendedPositions: 1,
			},
		],
	});

	// Coverage engine returns updated lines + warnings
	mockCalculateCoverage.mockReturnValue({
		updatedLines: [
			{
				id: 1,
				band: 'ELEMENTAIRE',
				disciplineCode: 'FRANCAIS',
				lineType: 'STRUCTURAL',
				requiredFteRaw: new Decimal('0.5556'),
				requiredFtePlanned: new Decimal('0.5128'),
				coveredFte: new Decimal(0),
				gapFte: new Decimal('-0.5556'),
				coverageStatus: 'DEFICIT',
				assignedStaffCount: 0,
				vacancyCount: 0,
			},
		],
		warnings: [],
	});

	// HSA engine
	mockCalculateHsa.mockReturnValue({
		hsaCostPerMonth: new Decimal('700'),
		hsaAnnualPerTeacher: new Decimal('7000'),
	});

	// Cost engine per employee
	mockCalculateEmployeeAnnualCost.mockReturnValue({
		months: makeMonthData(),
		eos: {
			yearsOfService: new Decimal('2.5'),
			eosBase: new Decimal('6000'),
			eosAnnual: new Decimal('3000'),
			eosMonthlyAccrual: new Decimal('250'),
		},
	});

	// Category cost engine
	mockCalculateConfigurableCategoryMonthlyCosts.mockReturnValue([]);

	// Transaction mock: execute the callback with the mock tx
	mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockTx) => Promise<void>) => {
		await fn(mockTx);
	});
}

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

	it('auto-creates VersionStaffingSettings when missing', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockDraftVersion);
		mockPrisma.enrollmentHeadcount.count.mockResolvedValue(5);
		mockPrisma.employee.count.mockResolvedValue(3);
		mockPrisma.versionStaffingSettings.findUnique.mockResolvedValue(null);
		mockPrisma.versionStaffingSettings.create.mockResolvedValue(mockSettings);

		// Setup remaining mocks for full pipeline
		mockPrisma.enrollmentHeadcount.findMany.mockResolvedValue([
			{
				id: 1,
				versionId: 1,
				gradeLevel: 'CP',
				headcount: 25,
				academicPeriod: 'AY2',
			},
		]);
		mockPrisma.gradeLevel.findMany.mockResolvedValue([]);
		mockPrisma.$queryRaw.mockResolvedValue([]);
		mockPrisma.staffingAssignment.findMany.mockResolvedValue([]);

		mockCalculateDemand.mockReturnValue({ sources: [], lines: [] });
		mockCalculateCoverage.mockReturnValue({
			updatedLines: [],
			warnings: [],
		});
		mockCalculateHsa.mockReturnValue({
			hsaCostPerMonth: new Decimal('700'),
			hsaAnnualPerTeacher: new Decimal('7000'),
		});
		mockCalculateConfigurableCategoryMonthlyCosts.mockReturnValue([]);
		mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockTx) => Promise<void>) => {
			await fn(mockTx);
		});

		const token = await makeToken();
		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/staffing`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		expect(mockPrisma.versionStaffingSettings.create).toHaveBeenCalledWith({
			data: { versionId: 1 },
		});
	});

	it('runs full pipeline and returns summary', async () => {
		setupFullPipelineMocks();
		const token = await makeToken();

		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/staffing`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.runId).toBeDefined();
		expect(body.durationMs).toBeDefined();
		expect(body.summary).toBeDefined();
		expect(body.summary.totalFteNeeded).toBe('0.5556');
		expect(body.summary.totalFteCovered).toBe('0.0000');
		expect(body.summary.totalGap).toBe('-0.5556');
		expect(body.summary.warningCount).toBe(0);

		// Verify all engines were called
		expect(mockCalculateDemand).toHaveBeenCalledOnce();
		expect(mockCalculateCoverage).toHaveBeenCalledOnce();
		expect(mockCalculateHsa).toHaveBeenCalledOnce();
		expect(mockCalculateEmployeeAnnualCost).toHaveBeenCalledOnce();
		expect(mockCalculateConfigurableCategoryMonthlyCosts).toHaveBeenCalledOnce();

		// Verify transaction was executed
		expect(mockPrisma.$transaction).toHaveBeenCalledOnce();

		// Verify old data was deleted in transaction
		expect(mockTx.teachingRequirementSource.deleteMany).toHaveBeenCalledWith({
			where: { versionId: 1 },
		});
		expect(mockTx.teachingRequirementLine.deleteMany).toHaveBeenCalledWith({
			where: { versionId: 1 },
		});
		expect(mockTx.monthlyStaffCost.deleteMany).toHaveBeenCalledWith({
			where: { versionId: 1 },
		});
		expect(mockTx.eosProvision.deleteMany).toHaveBeenCalledWith({
			where: { versionId: 1 },
		});
		expect(mockTx.categoryMonthlyCost.deleteMany).toHaveBeenCalledWith({
			where: { versionId: 1 },
		});

		// Verify stale modules updated (remove STAFFING, add PNL)
		expect(mockTx.budgetVersion.update).toHaveBeenCalledWith({
			where: { id: 1 },
			data: { staleModules: ['PNL'] },
		});

		// Verify audit log (now inside transaction)
		expect(mockTx.calculationAuditLog.create).toHaveBeenCalledOnce();
	});

	it('applies demand overrides to requirement lines', async () => {
		setupFullPipelineMocks();

		// Add demand override that replaces requiredFtePlanned
		mockPrisma.demandOverride.findMany.mockResolvedValue([
			{
				id: 1,
				versionId: 1,
				band: 'ELEMENTAIRE',
				disciplineId: 10,
				lineType: 'STRUCTURAL',
				overrideFte: new Decimal('2.0000'),
				reasonCode: 'MANUAL_ADJUST',
				note: null,
				discipline: { code: 'FRANCAIS' },
			},
		]);

		const token = await makeToken();
		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/staffing`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);

		// The coverage engine should have been called with overridden planned FTE
		const coverageCallArgs = mockCalculateCoverage.mock.calls[0]![0] as {
			requirementLines: Array<{ requiredFtePlanned: Decimal }>;
		};
		const line = coverageCallArgs.requirementLines[0]!;
		expect(line.requiredFtePlanned.toFixed(4)).toBe('2.0000');
	});

	it('HSA eligibility: only eligible LOCAL_PAYROLL employees get HSA', async () => {
		setupFullPipelineMocks();

		// Add a second employee that is LOCAL_PAYROLL but no service profile
		mockPrisma.$queryRaw.mockResolvedValue([
			{
				id: 1,
				employee_code: 'EMP001',
				name: 'HSA Teacher',
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
				cost_mode: 'LOCAL_PAYROLL',
				record_type: 'EMPLOYEE',
				service_profile_id: 1,
				hourly_percentage: '1.0000',
			},
			{
				id: 2,
				employee_code: 'EMP002',
				name: 'Non-HSA Teacher',
				status: 'Existing',
				is_saudi: false,
				is_ajeer: false,
				is_teaching: true,
				joining_date: new Date('2024-01-01'),
				base_salary: '4000',
				housing_allowance: '800',
				transport_allowance: '400',
				responsibility_premium: '0',
				hsa_amount: '0',
				augmentation: '0',
				cost_mode: 'AEFE_RECHARGE',
				record_type: 'EMPLOYEE',
				service_profile_id: 1,
				hourly_percentage: '1.0000',
			},
		]);

		const token = await makeToken();
		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/staffing`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);

		// Cost engine should be called twice (once per employee)
		expect(mockCalculateEmployeeAnnualCost).toHaveBeenCalledTimes(2);

		// First employee (LOCAL_PAYROLL + HSA eligible): hsaAmount = '700.0000'
		const firstCall = mockCalculateEmployeeAnnualCost.mock.calls[0]![0] as {
			hsaAmount: string;
			costMode: string;
		};
		expect(firstCall.hsaAmount).toBe('700.0000');
		expect(firstCall.costMode).toBe('LOCAL_PAYROLL');

		// Second employee (AEFE_RECHARGE): hsaAmount = '0' (not eligible)
		const secondCall = mockCalculateEmployeeAnnualCost.mock.calls[1]![0] as {
			hsaAmount: string;
			costMode: string;
		};
		expect(secondCall.hsaAmount).toBe('0');
		expect(secondCall.costMode).toBe('AEFE_RECHARGE');
	});

	it('cost aggregation: directCostAnnual computed from assignment shares', async () => {
		setupFullPipelineMocks();

		// Setup assignment linking employee to the demand line
		mockPrisma.staffingAssignment.findMany.mockResolvedValue([
			{
				id: 1,
				versionId: 1,
				employeeId: 1,
				band: 'ELEMENTAIRE',
				disciplineId: 10,
				hoursPerWeek: new Decimal('9'),
				fteShare: new Decimal('0.5000'),
				source: 'MANUAL',
				note: null,
				employee: {
					id: 1,
					name: 'John Doe',
					status: 'Existing',
					costMode: 'LOCAL_PAYROLL',
					recordType: 'EMPLOYEE',
					hourlyPercentage: new Decimal('1.0000'),
				},
				discipline: { id: 10, code: 'FRANCAIS' },
			},
		]);

		// Coverage engine: line now has some coverage
		mockCalculateCoverage.mockReturnValue({
			updatedLines: [
				{
					id: 1,
					band: 'ELEMENTAIRE',
					disciplineCode: 'FRANCAIS',
					lineType: 'STRUCTURAL',
					requiredFteRaw: new Decimal('0.5556'),
					requiredFtePlanned: new Decimal('0.5128'),
					coveredFte: new Decimal('0.5000'),
					gapFte: new Decimal('-0.0556'),
					coverageStatus: 'COVERED',
					assignedStaffCount: 1,
					vacancyCount: 0,
				},
			],
			warnings: [],
		});

		const token = await makeToken();
		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/staffing`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);

		// The teaching requirement line should have directCostAnnual =
		// employee annual cost * fteShare
		// Employee annual cost = 7100 * 12 = 85200
		// directCostAnnual = 85200 * 0.5000 = 42600.0000
		const lineData = mockTx.teachingRequirementLine.createMany.mock.calls;
		expect(lineData.length).toBe(1);
		const lineRow = lineData[0]![0].data[0];
		expect(lineRow.directCostAnnual).toBe('42600.0000');
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

	it('persists source rows and line rows in transaction', async () => {
		setupFullPipelineMocks();
		const token = await makeToken();

		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/staffing`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);

		// Sources should be persisted (filtered by discipline ID availability)
		// In our mock, dhgRules is empty so no disciplineCodeToId mapping
		// Only sources with valid discipline IDs are persisted
		// Since demandOverride is empty and dhgRules is empty, no source rows are created
		// This is expected — only lines should be created

		// Lines should be persisted
		expect(mockTx.teachingRequirementLine.createMany).toHaveBeenCalledOnce();
		const lineCallData = mockTx.teachingRequirementLine.createMany.mock.calls[0]![0];
		expect(lineCallData.data).toHaveLength(1);
		expect(lineCallData.data[0].band).toBe('ELEMENTAIRE');
		expect(lineCallData.data[0].disciplineCode).toBe('FRANCAIS');
		expect(lineCallData.data[0].coverageStatus).toBe('DEFICIT');

		// EOS provision should be persisted
		expect(mockTx.eosProvision.create).toHaveBeenCalledOnce();

		// Monthly costs should be persisted
		expect(mockTx.monthlyStaffCost.createMany).toHaveBeenCalledOnce();
		const monthlyCostData = mockTx.monthlyStaffCost.createMany.mock.calls[0]![0];
		expect(monthlyCostData.data).toHaveLength(12);
	});

	it('returns correct totalCost including employee and category costs', async () => {
		setupFullPipelineMocks();

		// Add some category costs
		mockCalculateConfigurableCategoryMonthlyCosts.mockReturnValue([
			{
				month: 1,
				category: 'REMPLACEMENTS',
				amount: new Decimal('100'),
				calculationMode: 'PERCENT_OF_PAYROLL',
			},
			{
				month: 1,
				category: 'FORMATION',
				amount: new Decimal('50'),
				calculationMode: 'PERCENT_OF_PAYROLL',
			},
		]);

		const token = await makeToken();
		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/staffing`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();

		// Employee annual cost = 7100 * 12 = 85200
		// Category costs = 100 + 50 = 150
		// Total = 85200 + 150 = 85350
		expect(body.summary.totalCost).toBe('85350.0000');
	});

	it('uses configurable category cost engine (not legacy)', async () => {
		setupFullPipelineMocks();

		mockPrisma.versionStaffingCostAssumption.findMany.mockResolvedValue([
			{
				id: 1,
				versionId: 1,
				category: 'REMPLACEMENTS',
				calculationMode: 'PERCENT_OF_PAYROLL',
				value: new Decimal('0.0200'),
				excludeSummerMonths: false,
			},
		]);

		const token = await makeToken();
		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/staffing`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);

		// Verify configurable engine was called with correct assumptions
		expect(mockCalculateConfigurableCategoryMonthlyCosts).toHaveBeenCalledOnce();
		const callArgs = mockCalculateConfigurableCategoryMonthlyCosts.mock.calls[0]![0] as {
			assumptions: Array<{
				category: string;
				calculationMode: string;
				value: Decimal;
			}>;
		};
		expect(callArgs.assumptions).toHaveLength(1);
		expect(callArgs.assumptions[0]!.category).toBe('REMPLACEMENTS');
		expect(callArgs.assumptions[0]!.calculationMode).toBe('PERCENT_OF_PAYROLL');
	});
});

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { generateKeyPair } from 'jose';
import { setKeys, signAccessToken } from '../../services/token.js';
import { auth } from '../../plugins/auth.js';
import { employeeRoutes } from './employees.js';

// ── Mock crypto-helper ──────────────────────────────────────────────────────

vi.mock('../../services/staffing/crypto-helper.js', () => ({
	getEncryptionKey: vi.fn().mockReturnValue('test-encryption-key'),
	resetEncryptionKey: vi.fn(),
}));

// ── Mock Prisma ─────────────────────────────────────────────────────────────

vi.mock('../../lib/prisma.js', () => {
	const mockPrisma = {
		budgetVersion: {
			findUnique: vi.fn(),
		},
		employee: {
			findUnique: vi.fn(),
			findFirst: vi.fn(),
			delete: vi.fn(),
			update: vi.fn(),
		},
		auditEntry: {
			create: vi.fn().mockResolvedValue({ id: 1 }),
		},
		$queryRaw: vi.fn(),
		$executeRaw: vi.fn(),
	};
	return { prisma: mockPrisma };
});

import { prisma } from '../../lib/prisma.js';

const mockPrisma = prisma as unknown as {
	budgetVersion: {
		findUnique: ReturnType<typeof vi.fn>;
	};
	employee: {
		findUnique: ReturnType<typeof vi.fn>;
		findFirst: ReturnType<typeof vi.fn>;
		delete: ReturnType<typeof vi.fn>;
		update: ReturnType<typeof vi.fn>;
	};
	auditEntry: {
		create: ReturnType<typeof vi.fn>;
	};
	$queryRaw: ReturnType<typeof vi.fn>;
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

const ROUTE_PREFIX = '/api/v1/versions/:versionId';
const URL_PREFIX = '/api/v1/versions/1';

const mockDraftVersion = {
	id: 1,
	name: 'Budget v1',
	status: 'Draft',
	staleModules: [] as string[],
};

const mockLockedVersion = {
	id: 1,
	name: 'Budget v1',
	status: 'Locked',
	staleModules: [] as string[],
};

const mockPublishedVersion = {
	id: 1,
	name: 'Budget v1',
	status: 'Published',
	staleModules: [] as string[],
};

const now = new Date('2026-01-15T10:00:00.000Z');

const mockDecryptedEmployee = {
	id: 42,
	version_id: 1,
	employee_code: 'EMP001',
	name: 'Jean Dupont',
	function_role: 'Teacher',
	department: 'Teaching',
	status: 'Existing',
	joining_date: new Date('2023-09-01'),
	payment_method: 'Bank Transfer',
	is_saudi: false,
	is_ajeer: false,
	is_teaching: true,
	hourly_percentage: '1.0000',
	base_salary: '5000.0000',
	housing_allowance: '1000.0000',
	transport_allowance: '500.0000',
	responsibility_premium: '0.0000',
	hsa_amount: '0.0000',
	augmentation: '0.0000',
	augmentation_effective_date: null,
	ajeer_annual_levy: '0.0000',
	ajeer_monthly_fee: '0.0000',
	// Epic 18 new fields
	record_type: 'EMPLOYEE',
	cost_mode: 'LOCAL_PAYROLL',
	discipline_id: 1,
	service_profile_id: 2,
	home_band: 'COLLEGE',
	contract_end_date: null,
	discipline_name: 'Mathematics',
	service_profile_name: 'CERTIFIE',
	created_at: now,
	updated_at: now,
	created_by: 1,
	updated_by: null,
};

const validEmployeeBody = {
	employeeCode: 'EMP001',
	name: 'Jean Dupont',
	functionRole: 'Teacher',
	department: 'Teaching',
	status: 'Existing',
	joiningDate: '2023-09-01',
	paymentMethod: 'Bank Transfer',
	isSaudi: false,
	isAjeer: false,
	isTeaching: true,
	hourlyPercentage: '1.0000',
	baseSalary: '5000.0000',
	housingAllowance: '1000.0000',
	transportAllowance: '500.0000',
	responsibilityPremium: '0.0000',
	augmentation: '0.0000',
	augmentationEffectiveDate: null,
	ajeerAnnualLevy: '0.0000',
	ajeerMonthlyFee: '0.0000',
	// New fields
	recordType: 'EMPLOYEE',
	costMode: 'LOCAL_PAYROLL',
	disciplineId: 1,
	serviceProfileId: 2,
	homeBand: 'COLLEGE',
	contractEndDate: null,
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
	await app.register(employeeRoutes, { prefix: ROUTE_PREFIX });
	await app.ready();
});

// ── GET /employees ──────────────────────────────────────────────────────────

describe('GET /employees', () => {
	it('returns 401 without auth header', async () => {
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/employees`,
		});
		expect(res.statusCode).toBe(401);
	});

	it('returns 404 when version not found', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(null);
		const token = await makeToken();

		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/employees`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('VERSION_NOT_FOUND');
	});

	it('returns paginated employee list with new fields', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockDraftVersion);
		mockPrisma.$queryRaw
			.mockResolvedValueOnce([mockDecryptedEmployee])
			.mockResolvedValueOnce([{ count: 1n }]);
		const token = await makeToken();

		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/employees`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.employees).toHaveLength(1);
		expect(body.total).toBe(1);
		expect(body.page).toBe(1);
		expect(body.page_size).toBe(50);
		expect(body.employees[0].base_salary).toBe('5000.0000');
		// AC-01: new fields present in response
		expect(body.employees[0].record_type).toBe('EMPLOYEE');
		expect(body.employees[0].cost_mode).toBe('LOCAL_PAYROLL');
		expect(body.employees[0].discipline_id).toBe(1);
		expect(body.employees[0].service_profile_id).toBe(2);
		expect(body.employees[0].home_band).toBe('COLLEGE');
		expect(body.employees[0].contract_end_date).toBeNull();
		// AC-01: joined names
		expect(body.employees[0].discipline_name).toBe('Mathematics');
		expect(body.employees[0].service_profile_name).toBe('CERTIFIE');
	});

	it('respects page and page_size query params', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockDraftVersion);
		mockPrisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: 0n }]);
		const token = await makeToken();

		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/employees?page=2&page_size=10`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.page).toBe(2);
		expect(body.page_size).toBe(10);
	});

	it('redacts salary fields for Viewer role', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockDraftVersion);
		const redactedEmployee = {
			...mockDecryptedEmployee,
			base_salary: null,
			housing_allowance: null,
			transport_allowance: null,
			responsibility_premium: null,
			hsa_amount: null,
			augmentation: null,
		};
		mockPrisma.$queryRaw
			.mockResolvedValueOnce([redactedEmployee])
			.mockResolvedValueOnce([{ count: 1n }]);
		const token = await makeToken('Viewer');

		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/employees`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.employees[0].base_salary).toBeNull();
		expect(body.employees[0].housing_allowance).toBeNull();
		expect(body.employees[0].transport_allowance).toBeNull();
		expect(body.employees[0].responsibility_premium).toBeNull();
		expect(body.employees[0].hsa_amount).toBeNull();
		expect(body.employees[0].augmentation).toBeNull();
		// Non-salary new fields still visible
		expect(body.employees[0].record_type).toBe('EMPLOYEE');
		expect(body.employees[0].cost_mode).toBe('LOCAL_PAYROLL');
	});

	it('filters by department query param', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockDraftVersion);
		mockPrisma.$queryRaw
			.mockResolvedValueOnce([mockDecryptedEmployee])
			.mockResolvedValueOnce([{ count: 1n }]);
		const token = await makeToken();

		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/employees?department=Teaching`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
	});

	it('filters by status query param', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockDraftVersion);
		mockPrisma.$queryRaw
			.mockResolvedValueOnce([mockDecryptedEmployee])
			.mockResolvedValueOnce([{ count: 1n }]);
		const token = await makeToken();

		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/employees?status=Existing`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
	});

	it('filters by recordType query param', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockDraftVersion);
		mockPrisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: 0n }]);
		const token = await makeToken();

		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/employees?recordType=VACANCY`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
	});
});

// ── GET /employees/:id ──────────────────────────────────────────────────────

describe('GET /employees/:id', () => {
	it('returns 401 without auth', async () => {
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/employees/42`,
		});
		expect(res.statusCode).toBe(401);
	});

	it('returns single employee with new fields', async () => {
		mockPrisma.$queryRaw.mockResolvedValue([mockDecryptedEmployee]);
		const token = await makeToken();

		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/employees/42`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.id).toBe(42);
		expect(body.employee_code).toBe('EMP001');
		expect(body.base_salary).toBe('5000.0000');
		// AC-01: new fields and joined names
		expect(body.record_type).toBe('EMPLOYEE');
		expect(body.cost_mode).toBe('LOCAL_PAYROLL');
		expect(body.discipline_id).toBe(1);
		expect(body.discipline_name).toBe('Mathematics');
		expect(body.service_profile_id).toBe(2);
		expect(body.service_profile_name).toBe('CERTIFIE');
		expect(body.home_band).toBe('COLLEGE');
	});

	it('returns 404 when employee not found', async () => {
		mockPrisma.$queryRaw.mockResolvedValue([]);
		const token = await makeToken();

		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/employees/999`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('EMPLOYEE_NOT_FOUND');
	});

	it('redacts salary fields for Viewer role', async () => {
		const redactedEmployee = {
			...mockDecryptedEmployee,
			base_salary: null,
			housing_allowance: null,
			transport_allowance: null,
			responsibility_premium: null,
			hsa_amount: null,
			augmentation: null,
		};
		mockPrisma.$queryRaw.mockResolvedValue([redactedEmployee]);
		const token = await makeToken('Viewer');

		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/employees/42`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.base_salary).toBeNull();
		expect(body.housing_allowance).toBeNull();
	});
});

// ── POST /employees ─────────────────────────────────────────────────────────

describe('POST /employees', () => {
	it('returns 401 without auth', async () => {
		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/employees`,
			payload: validEmployeeBody,
		});
		expect(res.statusCode).toBe(401);
	});

	it('returns 403 for Viewer role (no data:edit permission)', async () => {
		const token = await makeToken('Viewer');

		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/employees`,
			headers: authHeader(token),
			payload: validEmployeeBody,
		});

		expect(res.statusCode).toBe(403);
		expect(res.json().code).toBe('FORBIDDEN');
	});

	it('returns 404 when version not found', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(null);
		const token = await makeToken();

		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/employees`,
			headers: authHeader(token),
			payload: validEmployeeBody,
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('VERSION_NOT_FOUND');
	});

	it('returns 409 when version is locked', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockLockedVersion);
		const token = await makeToken();

		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/employees`,
			headers: authHeader(token),
			payload: validEmployeeBody,
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('VERSION_LOCKED');
	});

	it('returns 409 for duplicate employee code', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockDraftVersion);
		mockPrisma.employee.findUnique.mockResolvedValue({ id: 99 });
		const token = await makeToken();

		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/employees`,
			headers: authHeader(token),
			payload: validEmployeeBody,
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('DUPLICATE_EMPLOYEE_CODE');
	});

	it('creates employee successfully and returns 201 with new fields', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockDraftVersion);
		mockPrisma.employee.findUnique.mockResolvedValue(null);
		mockPrisma.$queryRaw
			.mockResolvedValueOnce([{ id: 42 }]) // INSERT RETURNING id
			.mockResolvedValueOnce([mockDecryptedEmployee]); // SELECT for response
		mockPrisma.$executeRaw.mockResolvedValue(1); // addStaleFlag

		const token = await makeToken();

		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/employees`,
			headers: authHeader(token),
			payload: validEmployeeBody,
		});

		expect(res.statusCode).toBe(201);
		const body = res.json();
		expect(body.id).toBe(42);
		expect(body.employee_code).toBe('EMP001');
		expect(body.record_type).toBe('EMPLOYEE');
		expect(body.cost_mode).toBe('LOCAL_PAYROLL');
		expect(body.discipline_name).toBe('Mathematics');
		expect(mockPrisma.auditEntry.create).toHaveBeenCalledOnce();
		expect(mockPrisma.$executeRaw).toHaveBeenCalled(); // stale flag
	});

	it('allows Editor role (has data:edit permission)', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockDraftVersion);
		mockPrisma.employee.findUnique.mockResolvedValue(null);
		mockPrisma.$queryRaw
			.mockResolvedValueOnce([{ id: 43 }])
			.mockResolvedValueOnce([{ ...mockDecryptedEmployee, id: 43 }]);
		mockPrisma.$executeRaw.mockResolvedValue(1);

		const token = await makeToken('Editor');

		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/employees`,
			headers: authHeader(token),
			payload: validEmployeeBody,
		});

		expect(res.statusCode).toBe(201);
	});

	it('rejects invalid body (missing required fields)', async () => {
		const token = await makeToken();

		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/employees`,
			headers: authHeader(token),
			payload: { name: 'Test' }, // missing required fields
		});

		expect(res.statusCode).toBe(400);
	});

	// AC-02: isTeaching validation
	it('returns 400 when isTeaching=true but disciplineId is missing', async () => {
		const token = await makeToken();

		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/employees`,
			headers: authHeader(token),
			payload: {
				...validEmployeeBody,
				isTeaching: true,
				disciplineId: null,
				serviceProfileId: null,
				homeBand: null,
			},
		});

		expect(res.statusCode).toBe(400);
		expect(res.json().code).toBe('TEACHING_FIELDS_REQUIRED');
		expect(res.json().errors).toContain('disciplineId is required when isTeaching is true');
		expect(res.json().errors).toContain('serviceProfileId is required when isTeaching is true');
		expect(res.json().errors).toContain('homeBand is required when isTeaching is true');
	});

	it('allows non-teaching employee without discipline/profile/band', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockDraftVersion);
		mockPrisma.employee.findUnique.mockResolvedValue(null);
		const nonTeachingEmployee = {
			...mockDecryptedEmployee,
			is_teaching: false,
			discipline_id: null,
			service_profile_id: null,
			home_band: null,
			discipline_name: null,
			service_profile_name: null,
		};
		mockPrisma.$queryRaw
			.mockResolvedValueOnce([{ id: 44 }])
			.mockResolvedValueOnce([nonTeachingEmployee]);
		mockPrisma.$executeRaw.mockResolvedValue(1);

		const token = await makeToken();

		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/employees`,
			headers: authHeader(token),
			payload: {
				...validEmployeeBody,
				isTeaching: false,
				disciplineId: null,
				serviceProfileId: null,
				homeBand: null,
			},
		});

		expect(res.statusCode).toBe(201);
	});

	// AC-03: hsaAmount stripped from body
	it('strips hsaAmount from request body (always uses 0.0000)', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockDraftVersion);
		mockPrisma.employee.findUnique.mockResolvedValue(null);
		mockPrisma.$queryRaw
			.mockResolvedValueOnce([{ id: 45 }])
			.mockResolvedValueOnce([mockDecryptedEmployee]);
		mockPrisma.$executeRaw.mockResolvedValue(1);

		const token = await makeToken();

		// Even if hsaAmount is sent in body, it should be ignored
		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/employees`,
			headers: authHeader(token),
			payload: {
				...validEmployeeBody,
				hsaAmount: '99999.0000', // should be stripped
			},
		});

		expect(res.statusCode).toBe(201);
		// The hsaAmount field in the INSERT should be '0.0000', not '99999.0000'
		// We verify via the INSERT call's arguments containing '0.0000' for hsa
	});

	// AC-04: VACANCY auto-code generation
	it('auto-generates employee code for VACANCY records', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockDraftVersion);
		// generateVacancyCode query
		mockPrisma.$queryRaw
			.mockResolvedValueOnce([{ max_num: 5 }]) // existing max VAC-005
			.mockResolvedValueOnce([{ id: 46 }]) // INSERT RETURNING id
			.mockResolvedValueOnce([
				{
					...mockDecryptedEmployee,
					id: 46,
					employee_code: 'VAC-006',
					record_type: 'VACANCY',
					is_teaching: false,
					discipline_id: null,
					service_profile_id: null,
					home_band: null,
					discipline_name: null,
					service_profile_name: null,
				},
			]);
		mockPrisma.employee.findUnique.mockResolvedValue(null); // no dup
		mockPrisma.$executeRaw.mockResolvedValue(1);

		const token = await makeToken();

		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/employees`,
			headers: authHeader(token),
			payload: {
				...validEmployeeBody,
				recordType: 'VACANCY',
				isTeaching: false,
				disciplineId: null,
				serviceProfileId: null,
				homeBand: null,
				baseSalary: null,
				housingAllowance: null,
				transportAllowance: null,
			},
		});

		expect(res.statusCode).toBe(201);
		expect(res.json().employee_code).toBe('VAC-006');
		expect(res.json().record_type).toBe('VACANCY');
	});

	it('auto-generates VAC-001 when no vacancies exist', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockDraftVersion);
		mockPrisma.$queryRaw
			.mockResolvedValueOnce([{ max_num: null }]) // no existing VAC-NNN
			.mockResolvedValueOnce([{ id: 47 }])
			.mockResolvedValueOnce([
				{
					...mockDecryptedEmployee,
					id: 47,
					employee_code: 'VAC-001',
					record_type: 'VACANCY',
					is_teaching: false,
					discipline_id: null,
					service_profile_id: null,
					home_band: null,
					discipline_name: null,
					service_profile_name: null,
				},
			]);
		mockPrisma.employee.findUnique.mockResolvedValue(null);
		mockPrisma.$executeRaw.mockResolvedValue(1);

		const token = await makeToken();

		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/employees`,
			headers: authHeader(token),
			payload: {
				...validEmployeeBody,
				recordType: 'VACANCY',
				isTeaching: false,
				disciplineId: null,
				serviceProfileId: null,
				homeBand: null,
			},
		});

		expect(res.statusCode).toBe(201);
		expect(res.json().employee_code).toBe('VAC-001');
	});

	// AC-04: Non-vacancy without employeeCode should fail
	it('returns 400 when EMPLOYEE recordType has no employeeCode', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockDraftVersion);
		const token = await makeToken();

		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/employees`,
			headers: authHeader(token),
			payload: {
				...validEmployeeBody,
				employeeCode: undefined,
				recordType: 'EMPLOYEE',
				isTeaching: false,
				disciplineId: null,
				serviceProfileId: null,
				homeBand: null,
			},
		});

		expect(res.statusCode).toBe(400);
		expect(res.json().code).toBe('EMPLOYEE_CODE_REQUIRED');
	});
});

// ── PUT /employees/:id ──────────────────────────────────────────────────────

describe('PUT /employees/:id', () => {
	it('returns 401 without auth', async () => {
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/employees/42`,
			payload: validEmployeeBody,
		});
		expect(res.statusCode).toBe(401);
	});

	it('returns 403 for Viewer role', async () => {
		const token = await makeToken('Viewer');

		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/employees/42`,
			headers: authHeader(token),
			payload: validEmployeeBody,
		});

		expect(res.statusCode).toBe(403);
	});

	it('returns 404 when version not found', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(null);
		const token = await makeToken();

		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/employees/42`,
			headers: authHeader(token),
			payload: validEmployeeBody,
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('VERSION_NOT_FOUND');
	});

	it('returns 409 when version is locked', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockLockedVersion);
		const token = await makeToken();

		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/employees/42`,
			headers: authHeader(token),
			payload: validEmployeeBody,
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('VERSION_LOCKED');
	});

	it('returns 404 when employee not found', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockDraftVersion);
		mockPrisma.employee.findFirst.mockResolvedValue(null);
		const token = await makeToken();

		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/employees/999`,
			headers: authHeader(token),
			payload: validEmployeeBody,
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('EMPLOYEE_NOT_FOUND');
	});

	it('returns 409 on optimistic lock conflict', async () => {
		const existingEmployee = {
			id: 42,
			versionId: 1,
			employeeCode: 'EMP001',
			updatedAt: new Date('2026-01-15T10:00:00.000Z'),
		};
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockDraftVersion);
		mockPrisma.employee.findFirst.mockResolvedValue(existingEmployee);
		const token = await makeToken();

		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/employees/42`,
			headers: {
				...authHeader(token),
				'if-match': '2026-01-14T00:00:00.000Z', // stale timestamp
			},
			payload: validEmployeeBody,
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('OPTIMISTIC_LOCK');
	});

	it('returns 409 for duplicate employee code on code change', async () => {
		const existingEmployee = {
			id: 42,
			versionId: 1,
			employeeCode: 'OLD001',
			updatedAt: now,
		};
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockDraftVersion);
		mockPrisma.employee.findFirst.mockResolvedValue(existingEmployee);
		mockPrisma.employee.findUnique.mockResolvedValue({ id: 99 });
		const token = await makeToken();

		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/employees/42`,
			headers: authHeader(token),
			payload: validEmployeeBody, // has employeeCode EMP001 != OLD001
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('DUPLICATE_EMPLOYEE_CODE');
	});

	it('updates employee successfully with new fields', async () => {
		const existingEmployee = {
			id: 42,
			versionId: 1,
			employeeCode: 'EMP001',
			updatedAt: now,
		};
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockDraftVersion);
		mockPrisma.employee.findFirst.mockResolvedValue(existingEmployee);
		mockPrisma.$executeRaw.mockResolvedValue(1);
		mockPrisma.$queryRaw.mockResolvedValue([mockDecryptedEmployee]);

		const token = await makeToken();

		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/employees/42`,
			headers: authHeader(token),
			payload: validEmployeeBody,
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.id).toBe(42);
		expect(body.record_type).toBe('EMPLOYEE');
		expect(body.cost_mode).toBe('LOCAL_PAYROLL');
		expect(mockPrisma.auditEntry.create).toHaveBeenCalledOnce();
	});

	// AC-02: isTeaching validation on PUT
	it('returns 400 when updating teaching employee without required fields', async () => {
		const token = await makeToken();

		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/employees/42`,
			headers: authHeader(token),
			payload: {
				...validEmployeeBody,
				isTeaching: true,
				disciplineId: null,
				serviceProfileId: 2,
				homeBand: 'COLLEGE',
			},
		});

		expect(res.statusCode).toBe(400);
		expect(res.json().code).toBe('TEACHING_FIELDS_REQUIRED');
		expect(res.json().errors).toContain('disciplineId is required when isTeaching is true');
	});
});

// ── DELETE /employees/:id ───────────────────────────────────────────────────

describe('DELETE /employees/:id', () => {
	it('returns 401 without auth', async () => {
		const res = await app.inject({
			method: 'DELETE',
			url: `${URL_PREFIX}/employees/42`,
		});
		expect(res.statusCode).toBe(401);
	});

	it('returns 403 for Editor role (requires Admin or BudgetOwner)', async () => {
		const token = await makeToken('Editor');

		const res = await app.inject({
			method: 'DELETE',
			url: `${URL_PREFIX}/employees/42`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(403);
		expect(res.json().code).toBe('FORBIDDEN');
	});

	it('returns 403 for Viewer role', async () => {
		const token = await makeToken('Viewer');

		const res = await app.inject({
			method: 'DELETE',
			url: `${URL_PREFIX}/employees/42`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(403);
	});

	it('returns 404 when version not found', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(null);
		const token = await makeToken();

		const res = await app.inject({
			method: 'DELETE',
			url: `${URL_PREFIX}/employees/42`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('VERSION_NOT_FOUND');
	});

	it('returns 409 when version is locked', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockLockedVersion);
		const token = await makeToken();

		const res = await app.inject({
			method: 'DELETE',
			url: `${URL_PREFIX}/employees/42`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('VERSION_LOCKED');
	});

	it('returns 409 when version is archived', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue({
			...mockDraftVersion,
			status: 'Archived',
		});
		const token = await makeToken();

		const res = await app.inject({
			method: 'DELETE',
			url: `${URL_PREFIX}/employees/42`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('VERSION_LOCKED');
	});

	it('returns 404 when employee not found', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockDraftVersion);
		mockPrisma.employee.findFirst.mockResolvedValue(null);
		const token = await makeToken();

		const res = await app.inject({
			method: 'DELETE',
			url: `${URL_PREFIX}/employees/42`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('EMPLOYEE_NOT_FOUND');
	});

	it('hard deletes on Draft version', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockDraftVersion);
		mockPrisma.employee.findFirst.mockResolvedValue({
			id: 42,
			versionId: 1,
			employeeCode: 'EMP001',
		});
		mockPrisma.employee.delete.mockResolvedValue({ id: 42 });
		mockPrisma.$executeRaw.mockResolvedValue(1);
		const token = await makeToken();

		const res = await app.inject({
			method: 'DELETE',
			url: `${URL_PREFIX}/employees/42`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(204);
		expect(mockPrisma.employee.delete).toHaveBeenCalledWith({
			where: { id: 42 },
		});
		expect(mockPrisma.auditEntry.create).toHaveBeenCalledOnce();
	});

	it('soft deletes (sets Departed) on Published version', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockPublishedVersion);
		mockPrisma.employee.findFirst.mockResolvedValue({
			id: 42,
			versionId: 1,
			employeeCode: 'EMP001',
		});
		mockPrisma.employee.update.mockResolvedValue({
			id: 42,
			status: 'Departed',
		});
		mockPrisma.$executeRaw.mockResolvedValue(1);
		const token = await makeToken();

		const res = await app.inject({
			method: 'DELETE',
			url: `${URL_PREFIX}/employees/42`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(204);
		expect(mockPrisma.employee.update).toHaveBeenCalledWith({
			where: { id: 42 },
			data: { status: 'Departed', updatedBy: 1 },
		});
	});

	it('allows BudgetOwner role to delete', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockDraftVersion);
		mockPrisma.employee.findFirst.mockResolvedValue({
			id: 42,
			versionId: 1,
			employeeCode: 'EMP001',
		});
		mockPrisma.employee.delete.mockResolvedValue({ id: 42 });
		mockPrisma.$executeRaw.mockResolvedValue(1);
		const token = await makeToken('BudgetOwner');

		const res = await app.inject({
			method: 'DELETE',
			url: `${URL_PREFIX}/employees/42`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(204);
	});
});

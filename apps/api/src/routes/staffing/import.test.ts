import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { generateKeyPair } from 'jose';
import { setKeys, signAccessToken } from '../../services/token.js';
import { auth } from '../../plugins/auth.js';
import { employeeImportRoutes } from './import.js';

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
			findMany: vi.fn(),
		},
		disciplineAlias: {
			findMany: vi.fn(),
		},
		serviceObligationProfile: {
			findMany: vi.fn(),
		},
		auditEntry: {
			create: vi.fn().mockResolvedValue({ id: 1 }),
		},
		$executeRawUnsafe: vi.fn(),
		$executeRaw: vi.fn(),
		$transaction: vi.fn(),
	};
	return { prisma: mockPrisma };
});

import { prisma } from '../../lib/prisma.js';

const mockPrisma = prisma as unknown as {
	budgetVersion: { findUnique: ReturnType<typeof vi.fn> };
	employee: { findMany: ReturnType<typeof vi.fn> };
	disciplineAlias: { findMany: ReturnType<typeof vi.fn> };
	serviceObligationProfile: { findMany: ReturnType<typeof vi.fn> };
	auditEntry: { create: ReturnType<typeof vi.fn> };
	$executeRawUnsafe: ReturnType<typeof vi.fn>;
	$executeRaw: ReturnType<typeof vi.fn>;
	$transaction: ReturnType<typeof vi.fn>;
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

const mockAliases = [
	{ alias: 'Professeur de Mathématiques', disciplineId: 1 },
	{ alias: 'Enseignant EPS', disciplineId: 2 },
	{ alias: 'Professeur Documentaliste', disciplineId: 3 },
];

const mockProfiles = [
	{ code: 'CERTIFIE', id: 1 },
	{ code: 'AGREGE', id: 2 },
	{ code: 'PE', id: 3 },
	{ code: 'EPS', id: 4 },
	{ code: 'ARABIC_ISLAMIC', id: 5 },
	{ code: 'DOCUMENTALISTE', id: 6 },
];

function setupDefaultMocks() {
	mockPrisma.disciplineAlias.findMany.mockResolvedValue(mockAliases);
	mockPrisma.serviceObligationProfile.findMany.mockResolvedValue(mockProfiles);
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
	await app.register(employeeImportRoutes, { prefix: ROUTE_PREFIX });
	await app.ready();
});

// ── POST /employees/import ──────────────────────────────────────────────────

describe('POST /employees/import', () => {
	it('returns 401 without auth', async () => {
		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/employees/import`,
		});
		expect(res.statusCode).toBe(401);
	});

	it('returns 403 for Viewer role', async () => {
		const token = await makeToken('Viewer');

		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/employees/import`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(403);
		expect(res.json().code).toBe('FORBIDDEN');
	});

	it('allows Admin role', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockDraftVersion);
		const token = await makeToken('Admin');

		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/employees/import`,
			headers: {
				...authHeader(token),
				'content-type': 'multipart/form-data; boundary=boundary123',
			},
			payload:
				'--boundary123\r\n' +
				'Content-Disposition: form-data; name="mode"\r\n\r\n' +
				'validate\r\n' +
				'--boundary123--\r\n',
		});

		// The route is reachable (not 403)
		expect(res.statusCode).not.toBe(403);
	});

	it('allows Editor role', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockDraftVersion);
		const token = await makeToken('Editor');

		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/employees/import`,
			headers: {
				...authHeader(token),
				'content-type': 'multipart/form-data; boundary=boundary123',
			},
			payload:
				'--boundary123\r\n' +
				'Content-Disposition: form-data; name="mode"\r\n\r\n' +
				'validate\r\n' +
				'--boundary123--\r\n',
		});

		expect(res.statusCode).not.toBe(403);
	});

	it('allows BudgetOwner role', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockDraftVersion);
		const token = await makeToken('BudgetOwner');

		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/employees/import`,
			headers: {
				...authHeader(token),
				'content-type': 'multipart/form-data; boundary=boundary123',
			},
			payload:
				'--boundary123\r\n' +
				'Content-Disposition: form-data; name="mode"\r\n\r\n' +
				'validate\r\n' +
				'--boundary123--\r\n',
		});

		expect(res.statusCode).not.toBe(403);
	});

	it('returns 404 when version not found', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(null);
		const token = await makeToken();

		const { default: ExcelJS } = await import('exceljs');
		const workbook = new ExcelJS.Workbook();
		const sheet = workbook.addWorksheet('Sheet1');
		sheet.addRow([
			'employee_code',
			'name',
			'function_role',
			'department',
			'joining_date',
			'base_salary',
			'housing_allowance',
			'transport_allowance',
		]);
		sheet.addRow(['EMP001', 'Test', 'Teacher', 'Teaching', '2023-09-01', '5000', '1000', '500']);
		const buffer = await workbook.xlsx.writeBuffer();

		const boundary = 'boundary123456';
		const fileField = Buffer.concat([
			Buffer.from(
				`--${boundary}\r\n` +
					`Content-Disposition: form-data; name="mode"\r\n\r\n` +
					`validate\r\n` +
					`--${boundary}\r\n` +
					`Content-Disposition: form-data; name="file"; ` +
					`filename="import.xlsx"\r\n` +
					`Content-Type: application/vnd.` +
					`openxmlformats-officedocument.` +
					`spreadsheetml.sheet\r\n\r\n`
			),
			Buffer.from(buffer as ArrayBuffer),
			Buffer.from(`\r\n--${boundary}--\r\n`),
		]);

		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/employees/import`,
			headers: {
				...authHeader(token),
				'content-type': `multipart/form-data; boundary=${boundary}`,
			},
			payload: fileField,
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

		const { default: ExcelJS } = await import('exceljs');
		const workbook = new ExcelJS.Workbook();
		const sheet = workbook.addWorksheet('Sheet1');
		sheet.addRow([
			'employee_code',
			'name',
			'function_role',
			'department',
			'joining_date',
			'base_salary',
			'housing_allowance',
			'transport_allowance',
		]);
		sheet.addRow(['EMP001', 'Test', 'Teacher', 'Teaching', '2023-09-01', '5000', '1000', '500']);
		const buffer = await workbook.xlsx.writeBuffer();

		const boundary = 'boundary789';
		const fileField = Buffer.concat([
			Buffer.from(
				`--${boundary}\r\n` +
					`Content-Disposition: form-data; name="mode"\r\n\r\n` +
					`validate\r\n` +
					`--${boundary}\r\n` +
					`Content-Disposition: form-data; name="file"; ` +
					`filename="import.xlsx"\r\n` +
					`Content-Type: application/vnd.` +
					`openxmlformats-officedocument.` +
					`spreadsheetml.sheet\r\n\r\n`
			),
			Buffer.from(buffer as ArrayBuffer),
			Buffer.from(`\r\n--${boundary}--\r\n`),
		]);

		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/employees/import`,
			headers: {
				...authHeader(token),
				'content-type': `multipart/form-data; boundary=${boundary}`,
			},
			payload: fileField,
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('VERSION_LOCKED');
	});

	// AC-05: Discipline alias resolution
	it('resolves discipline via alias lookup in validate mode', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockDraftVersion);
		mockPrisma.employee.findMany.mockResolvedValue([]);
		setupDefaultMocks();
		const token = await makeToken();

		const { default: ExcelJS } = await import('exceljs');
		const workbook = new ExcelJS.Workbook();
		const sheet = workbook.addWorksheet('Sheet1');
		sheet.addRow([
			'employee_code',
			'name',
			'function_role',
			'department',
			'joining_date',
			'base_salary',
			'housing_allowance',
			'transport_allowance',
			'is_teaching',
		]);
		sheet.addRow([
			'EMP001',
			'Jean',
			'Professeur de Mathématiques',
			'Teaching',
			'2023-09-01',
			'5000',
			'1000',
			'500',
			'true',
		]);
		const buffer = await workbook.xlsx.writeBuffer();

		const boundary = 'boundary-alias1';
		const fileField = Buffer.concat([
			Buffer.from(
				`--${boundary}\r\n` +
					`Content-Disposition: form-data; name="mode"\r\n\r\n` +
					`validate\r\n` +
					`--${boundary}\r\n` +
					`Content-Disposition: form-data; name="file"; ` +
					`filename="import.xlsx"\r\n` +
					`Content-Type: application/vnd.` +
					`openxmlformats-officedocument.` +
					`spreadsheetml.sheet\r\n\r\n`
			),
			Buffer.from(buffer as ArrayBuffer),
			Buffer.from(`\r\n--${boundary}--\r\n`),
		]);

		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/employees/import`,
			headers: {
				...authHeader(token),
				'content-type': `multipart/form-data; boundary=${boundary}`,
			},
			payload: fileField,
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.preview[0].discipline_id).toBe(1); // matched alias
	});

	// AC-05: Unresolvable discipline logged to exceptions
	it('logs exception for unresolvable discipline', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockDraftVersion);
		mockPrisma.employee.findMany.mockResolvedValue([]);
		setupDefaultMocks();
		const token = await makeToken();

		const { default: ExcelJS } = await import('exceljs');
		const workbook = new ExcelJS.Workbook();
		const sheet = workbook.addWorksheet('Sheet1');
		sheet.addRow([
			'employee_code',
			'name',
			'function_role',
			'department',
			'joining_date',
			'base_salary',
			'housing_allowance',
			'transport_allowance',
			'is_teaching',
		]);
		sheet.addRow([
			'EMP002',
			'Marie',
			'Unknown Role',
			'Teaching',
			'2023-09-01',
			'5000',
			'1000',
			'500',
			'true',
		]);
		const buffer = await workbook.xlsx.writeBuffer();

		const boundary = 'boundary-alias2';
		const fileField = Buffer.concat([
			Buffer.from(
				`--${boundary}\r\n` +
					`Content-Disposition: form-data; name="mode"\r\n\r\n` +
					`validate\r\n` +
					`--${boundary}\r\n` +
					`Content-Disposition: form-data; name="file"; ` +
					`filename="import.xlsx"\r\n` +
					`Content-Type: application/vnd.` +
					`openxmlformats-officedocument.` +
					`spreadsheetml.sheet\r\n\r\n`
			),
			Buffer.from(buffer as ArrayBuffer),
			Buffer.from(`\r\n--${boundary}--\r\n`),
		]);

		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/employees/import`,
			headers: {
				...authHeader(token),
				'content-type': `multipart/form-data; boundary=${boundary}`,
			},
			payload: fileField,
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		// Should have discipline exception
		expect(body.exceptions.length).toBeGreaterThanOrEqual(1);
		expect(body.exceptions[0].field).toBe('disciplineId');
		expect(body.preview[0].discipline_id).toBeNull();
	});

	// AC-06: Service profile heuristic resolution
	it('resolves service profile CERTIFIE for generic teaching role', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockDraftVersion);
		mockPrisma.employee.findMany.mockResolvedValue([]);
		setupDefaultMocks();
		const token = await makeToken();

		const { default: ExcelJS } = await import('exceljs');
		const workbook = new ExcelJS.Workbook();
		const sheet = workbook.addWorksheet('Sheet1');
		sheet.addRow([
			'employee_code',
			'name',
			'function_role',
			'department',
			'joining_date',
			'base_salary',
			'housing_allowance',
			'transport_allowance',
			'is_teaching',
		]);
		// Generic teacher with is_teaching=true -> CERTIFIE catch-all
		sheet.addRow([
			'EMP003',
			'Pierre',
			'Professeur de Mathématiques',
			'Teaching',
			'2023-09-01',
			'5000',
			'1000',
			'500',
			'true',
		]);
		const buffer = await workbook.xlsx.writeBuffer();

		const boundary = 'boundary-profile1';
		const fileField = Buffer.concat([
			Buffer.from(
				`--${boundary}\r\n` +
					`Content-Disposition: form-data; ` +
					`name="mode"\r\n\r\n` +
					`validate\r\n` +
					`--${boundary}\r\n` +
					`Content-Disposition: form-data; name="file"; ` +
					`filename="import.xlsx"\r\n` +
					`Content-Type: application/vnd.` +
					`openxmlformats-officedocument.` +
					`spreadsheetml.sheet\r\n\r\n`
			),
			Buffer.from(buffer as ArrayBuffer),
			Buffer.from(`\r\n--${boundary}--\r\n`),
		]);

		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/employees/import`,
			headers: {
				...authHeader(token),
				'content-type': `multipart/form-data; boundary=${boundary}`,
			},
			payload: fileField,
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		// CERTIFIE catch-all for teaching
		expect(body.preview[0].service_profile_id).toBe(1);
	});

	// AC-06: Non-teaching -> null service profile
	it('resolves null service profile for non-teaching employee', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockDraftVersion);
		mockPrisma.employee.findMany.mockResolvedValue([]);
		setupDefaultMocks();
		const token = await makeToken();

		const { default: ExcelJS } = await import('exceljs');
		const workbook = new ExcelJS.Workbook();
		const sheet = workbook.addWorksheet('Sheet1');
		sheet.addRow([
			'employee_code',
			'name',
			'function_role',
			'department',
			'joining_date',
			'base_salary',
			'housing_allowance',
			'transport_allowance',
			'is_teaching',
		]);
		sheet.addRow([
			'EMP004',
			'Admin User',
			'Secretary',
			'Administration',
			'2023-09-01',
			'3000',
			'500',
			'200',
			'false',
		]);
		const buffer = await workbook.xlsx.writeBuffer();

		const boundary = 'boundary-profile2';
		const fileField = Buffer.concat([
			Buffer.from(
				`--${boundary}\r\n` +
					`Content-Disposition: form-data; ` +
					`name="mode"\r\n\r\n` +
					`validate\r\n` +
					`--${boundary}\r\n` +
					`Content-Disposition: form-data; name="file"; ` +
					`filename="import.xlsx"\r\n` +
					`Content-Type: application/vnd.` +
					`openxmlformats-officedocument.` +
					`spreadsheetml.sheet\r\n\r\n`
			),
			Buffer.from(buffer as ArrayBuffer),
			Buffer.from(`\r\n--${boundary}--\r\n`),
		]);

		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/employees/import`,
			headers: {
				...authHeader(token),
				'content-type': `multipart/form-data; boundary=${boundary}`,
			},
			payload: fileField,
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		// Non-teaching -> null
		expect(body.preview[0].service_profile_id).toBeNull();
		// No exceptions for non-teaching
		const disciplineExceptions = body.exceptions.filter(
			(e: { field: string }) => e.field === 'serviceProfileId'
		);
		expect(disciplineExceptions).toHaveLength(0);
	});
});

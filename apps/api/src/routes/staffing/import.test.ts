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

		// Send request without a file to get FILE_REQUIRED
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

		// The route is reachable (not 403); expect 400 since no file was attached
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

		// Editor should pass RBAC
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

		// We need to send a valid multipart request to get past file parsing
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
					`Content-Disposition: form-data; name="file"; filename="import.xlsx"\r\n` +
					`Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n`
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
					`Content-Disposition: form-data; name="file"; filename="import.xlsx"\r\n` +
					`Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n`
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
});

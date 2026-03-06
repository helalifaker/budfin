import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { generateKeyPair } from 'jose';
import { Prisma } from '@prisma/client';
import type { AssumptionValueType } from '@prisma/client';
import { setKeys, signAccessToken } from '../../services/token.js';
import { auth } from '../../plugins/auth.js';
import { masterDataRoutes } from './index.js';

vi.mock('../../lib/prisma.js', () => {
	const mockPrisma = {
		chartOfAccount: {
			findMany: vi.fn(),
			findUnique: vi.fn(),
			create: vi.fn(),
			update: vi.fn(),
			delete: vi.fn(),
		},
		academicYear: {
			findMany: vi.fn(),
			findUnique: vi.fn(),
			create: vi.fn(),
			update: vi.fn(),
			delete: vi.fn(),
		},
		gradeLevel: {
			findMany: vi.fn(),
			findUnique: vi.fn(),
			update: vi.fn(),
		},
		nationality: {
			findMany: vi.fn(),
			findUnique: vi.fn(),
			create: vi.fn(),
			update: vi.fn(),
			delete: vi.fn(),
		},
		tariff: {
			findMany: vi.fn(),
			findUnique: vi.fn(),
			create: vi.fn(),
			update: vi.fn(),
			delete: vi.fn(),
		},
		department: {
			findMany: vi.fn(),
			findUnique: vi.fn(),
			create: vi.fn(),
			update: vi.fn(),
			delete: vi.fn(),
		},
		assumption: {
			findMany: vi.fn(),
			findUnique: vi.fn(),
			update: vi.fn(),
		},
		auditEntry: {
			create: vi.fn().mockResolvedValue({ id: 1 }),
		},
		$transaction: vi.fn().mockImplementation(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(fn: (tx: Record<string, any>) => unknown) => fn(mockPrisma)
		),
	};
	return { prisma: mockPrisma };
});

import { prisma } from '../../lib/prisma.js';

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

const now = new Date();

// --- Mock data ---

const mockAccount = {
	id: 1,
	accountCode: 'REV001',
	accountName: 'Tuition Revenue',
	type: 'REVENUE' as const,
	ifrsCategory: 'Revenue from Contracts',
	centerType: 'PROFIT_CENTER' as const,
	description: null,
	status: 'ACTIVE' as const,
	version: 1,
	createdAt: now,
	updatedAt: now,
	createdBy: 1,
	updatedBy: 1,
};

const mockNationality = {
	id: 1,
	code: 'FR',
	label: 'French',
	vatExempt: false,
	version: 1,
	createdAt: now,
	updatedAt: now,
	createdBy: 1,
	updatedBy: 1,
};

const _mockGradeLevel = {
	id: 1,
	code: 'PS',
	label: 'Petite Section',
	band: 'MATERNELLE',
	maxClassSize: 25,
	plancherPct: new Prisma.Decimal('0.60'),
	ciblePct: new Prisma.Decimal('0.80'),
	plafondPct: new Prisma.Decimal('1.00'),
	displayOrder: 1,
	version: 1,
	createdAt: now,
	updatedAt: now,
};

const _mockTariff = {
	id: 1,
	code: 'STD',
	label: 'Standard',
	description: null,
	version: 1,
	createdAt: now,
	updatedAt: now,
	createdBy: 1,
	updatedBy: 1,
};

const _mockDepartment = {
	id: 1,
	code: 'MATERNELLE',
	label: 'Maternelle',
	bandMapping: 'MATERNELLE' as const,
	version: 1,
	createdAt: now,
	updatedAt: now,
	createdBy: 1,
	updatedBy: 1,
};

const mockAssumptions = [
	{
		id: 1,
		key: 'gosiPension',
		value: '9.75',
		unit: '%',
		section: 'GOSI',
		valueType: 'PERCENTAGE' as AssumptionValueType,
		label: 'GOSI Pension',
		version: 1,
		createdAt: now,
		updatedAt: now,
		updatedBy: 1 as number | null,
	},
	{
		id: 2,
		key: 'gosiSaned',
		value: '1.50',
		unit: '%',
		section: 'GOSI',
		valueType: 'PERCENTAGE' as AssumptionValueType,
		label: 'GOSI SANED',
		version: 1,
		createdAt: now,
		updatedAt: now,
		updatedBy: 1 as number | null,
	},
	{
		id: 3,
		key: 'gosiOhi',
		value: '1.00',
		unit: '%',
		section: 'GOSI',
		valueType: 'PERCENTAGE' as AssumptionValueType,
		label: 'GOSI OHI',
		version: 1,
		createdAt: now,
		updatedAt: now,
		updatedBy: 1 as number | null,
	},
];

beforeAll(async () => {
	const keys = await generateKeyPair('RS256');
	setKeys(keys.privateKey, keys.publicKey);

	app = Fastify({ logger: false });
	app.setValidatorCompiler(validatorCompiler);
	app.setSerializerCompiler(serializerCompiler);
	await app.register(auth);
	await app.register(masterDataRoutes, {
		prefix: '/api/v1/master-data',
	});
	await app.ready();
});

beforeEach(() => {
	vi.clearAllMocks();
});

// ─── 1. Full CRUD lifecycle (accounts) ─────────────────────────────

describe('Full CRUD lifecycle — accounts', () => {
	it('create → get → update → get → delete → get empty', async () => {
		const token = await makeToken();
		const headers = authHeader(token);

		// CREATE
		vi.mocked(prisma.chartOfAccount.create).mockResolvedValue(mockAccount);
		const createRes = await app.inject({
			method: 'POST',
			url: '/api/v1/master-data/accounts',
			headers,
			payload: {
				accountCode: 'REV001',
				accountName: 'Tuition Revenue',
				type: 'REVENUE',
				ifrsCategory: 'Revenue from Contracts',
				centerType: 'PROFIT_CENTER',
			},
		});
		expect(createRes.statusCode).toBe(201);
		expect(createRes.json().accountCode).toBe('REV001');

		// GET — returns the created account
		vi.mocked(prisma.chartOfAccount.findMany).mockResolvedValue([mockAccount]);
		const listRes = await app.inject({
			method: 'GET',
			url: '/api/v1/master-data/accounts',
			headers,
		});
		expect(listRes.statusCode).toBe(200);
		expect(listRes.json().accounts).toHaveLength(1);

		// UPDATE
		const updated = {
			...mockAccount,
			accountName: 'Updated Revenue',
			version: 2,
		};
		vi.mocked(prisma.chartOfAccount.findUnique).mockResolvedValue(mockAccount);
		vi.mocked(prisma.chartOfAccount.update).mockResolvedValue(updated);
		const updateRes = await app.inject({
			method: 'PUT',
			url: '/api/v1/master-data/accounts/1',
			headers,
			payload: {
				accountCode: 'REV001',
				accountName: 'Updated Revenue',
				type: 'REVENUE',
				ifrsCategory: 'Revenue from Contracts',
				centerType: 'PROFIT_CENTER',
				version: 1,
			},
		});
		expect(updateRes.statusCode).toBe(200);
		expect(updateRes.json().accountName).toBe('Updated Revenue');

		// GET after update
		vi.mocked(prisma.chartOfAccount.findMany).mockResolvedValue([updated]);
		const listRes2 = await app.inject({
			method: 'GET',
			url: '/api/v1/master-data/accounts',
			headers,
		});
		expect(listRes2.json().accounts[0].accountName).toBe('Updated Revenue');

		// DELETE
		vi.mocked(prisma.chartOfAccount.findUnique).mockResolvedValue(updated);
		vi.mocked(prisma.chartOfAccount.delete).mockResolvedValue(updated);
		const deleteRes = await app.inject({
			method: 'DELETE',
			url: '/api/v1/master-data/accounts/1',
			headers,
		});
		expect(deleteRes.statusCode).toBe(204);

		// GET after delete — empty
		vi.mocked(prisma.chartOfAccount.findMany).mockResolvedValue([]);
		const listRes3 = await app.inject({
			method: 'GET',
			url: '/api/v1/master-data/accounts',
			headers,
		});
		expect(listRes3.json().accounts).toHaveLength(0);
	});
});

// ─── 2. Duplicate detection (nationalities) ────────────────────────

describe('Duplicate detection — nationalities', () => {
	it('returns 409 DUPLICATE_CODE for duplicate nationality code', async () => {
		const token = await makeToken();
		const headers = authHeader(token);

		// First create succeeds
		vi.mocked(prisma.nationality.create).mockResolvedValue(mockNationality);
		const res1 = await app.inject({
			method: 'POST',
			url: '/api/v1/master-data/nationalities',
			headers,
			payload: { code: 'FR', label: 'French' },
		});
		expect(res1.statusCode).toBe(201);

		// Second create with same code fails P2002
		vi.mocked(prisma.nationality.create).mockRejectedValue(
			new Prisma.PrismaClientKnownRequestError('Unique constraint', {
				code: 'P2002',
				clientVersion: '6.0.0',
			})
		);
		const res2 = await app.inject({
			method: 'POST',
			url: '/api/v1/master-data/nationalities',
			headers,
			payload: { code: 'FR', label: 'French Duplicate' },
		});
		expect(res2.statusCode).toBe(409);
		expect(res2.json().code).toBe('DUPLICATE_CODE');
	});
});

// ─── 3. RBAC enforcement across all endpoints ──────────────────────

describe('RBAC enforcement', () => {
	it('Viewer gets 200 on all GET endpoints', async () => {
		const token = await makeToken({ role: 'Viewer' });
		const headers = authHeader(token);

		vi.mocked(prisma.chartOfAccount.findMany).mockResolvedValue([]);
		vi.mocked(prisma.academicYear.findMany).mockResolvedValue([]);
		vi.mocked(prisma.gradeLevel.findMany).mockResolvedValue([]);
		vi.mocked(prisma.nationality.findMany).mockResolvedValue([]);
		vi.mocked(prisma.tariff.findMany).mockResolvedValue([]);
		vi.mocked(prisma.department.findMany).mockResolvedValue([]);
		vi.mocked(prisma.assumption.findMany).mockResolvedValue([]);

		const endpoints = [
			'/api/v1/master-data/accounts',
			'/api/v1/master-data/academic-years',
			'/api/v1/master-data/grade-levels',
			'/api/v1/master-data/nationalities',
			'/api/v1/master-data/tariffs',
			'/api/v1/master-data/departments',
			'/api/v1/master-data/assumptions',
		];

		for (const url of endpoints) {
			const res = await app.inject({ method: 'GET', url, headers });
			expect(res.statusCode).toBe(200);
		}
	});

	it('Viewer gets 403 on POST/PUT/DELETE for admin:config routes', async () => {
		const token = await makeToken({ role: 'Viewer' });
		const headers = authHeader(token);

		const accountPayload = {
			accountCode: 'REV001',
			accountName: 'Test',
			type: 'REVENUE',
			ifrsCategory: 'Test',
			centerType: 'PROFIT_CENTER',
		};
		const nationalityPayload = { code: 'FR', label: 'French' };
		const tariffPayload = { code: 'STD', label: 'Standard' };
		const departmentPayload = {
			code: 'MATERNELLE',
			label: 'Test',
			bandMapping: 'MATERNELLE',
		};

		const mutations: Array<{
			method: 'POST' | 'PUT' | 'DELETE';
			url: string;
			payload?: Record<string, unknown>;
		}> = [
			{ method: 'POST', url: '/api/v1/master-data/accounts', payload: accountPayload },
			{
				method: 'PUT',
				url: '/api/v1/master-data/accounts/1',
				payload: { ...accountPayload, version: 1 },
			},
			{ method: 'DELETE', url: '/api/v1/master-data/accounts/1' },
			{ method: 'POST', url: '/api/v1/master-data/nationalities', payload: nationalityPayload },
			{ method: 'DELETE', url: '/api/v1/master-data/nationalities/1' },
			{ method: 'POST', url: '/api/v1/master-data/tariffs', payload: tariffPayload },
			{ method: 'DELETE', url: '/api/v1/master-data/tariffs/1' },
			{ method: 'POST', url: '/api/v1/master-data/departments', payload: departmentPayload },
			{ method: 'DELETE', url: '/api/v1/master-data/departments/1' },
		];

		for (const { method, url, payload } of mutations) {
			const res = await app.inject({
				method,
				url,
				headers,
				...(payload ? { payload } : {}),
			});
			expect(res.statusCode).toBe(403);
		}
	});

	it('Editor gets 403 on POST accounts (admin:config)', async () => {
		const token = await makeToken({ role: 'Editor' });
		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/master-data/accounts',
			headers: authHeader(token),
			payload: {
				accountCode: 'REV001',
				accountName: 'Test',
				type: 'REVENUE',
				ifrsCategory: 'Test',
				centerType: 'PROFIT_CENTER',
			},
		});
		expect(res.statusCode).toBe(403);
	});

	it('BudgetOwner gets 200 on PATCH assumptions (data:edit)', async () => {
		const token = await makeToken({ role: 'BudgetOwner' });

		vi.mocked(prisma.assumption.update).mockResolvedValue({
			...mockAssumptions[0]!,
			value: '10.00',
			version: 2,
		});
		// First call: batch fetch; second call: refreshed list in transaction
		vi.mocked(prisma.assumption.findMany)
			.mockResolvedValueOnce([mockAssumptions[0]!])
			.mockResolvedValueOnce(mockAssumptions);

		const res = await app.inject({
			method: 'PATCH',
			url: '/api/v1/master-data/assumptions',
			headers: authHeader(token),
			payload: {
				updates: [{ key: 'gosiPension', value: '10.00', version: 1 }],
			},
		});
		expect(res.statusCode).toBe(200);
	});
});

// ─── 4. Optimistic locking (accounts) ──────────────────────────────

describe('Optimistic locking — accounts', () => {
	it('succeeds with correct version', async () => {
		const token = await makeToken();
		vi.mocked(prisma.chartOfAccount.findUnique).mockResolvedValue(mockAccount);
		vi.mocked(prisma.chartOfAccount.update).mockResolvedValue({ ...mockAccount, version: 2 });

		const res = await app.inject({
			method: 'PUT',
			url: '/api/v1/master-data/accounts/1',
			headers: authHeader(token),
			payload: {
				accountCode: 'REV001',
				accountName: 'Updated',
				type: 'REVENUE',
				ifrsCategory: 'Revenue from Contracts',
				centerType: 'PROFIT_CENTER',
				version: 1,
			},
		});
		expect(res.statusCode).toBe(200);
	});

	it('returns 409 OPTIMISTIC_LOCK with wrong version', async () => {
		const token = await makeToken();
		vi.mocked(prisma.chartOfAccount.findUnique).mockResolvedValue({ ...mockAccount, version: 5 });

		const res = await app.inject({
			method: 'PUT',
			url: '/api/v1/master-data/accounts/1',
			headers: authHeader(token),
			payload: {
				accountCode: 'REV001',
				accountName: 'Updated',
				type: 'REVENUE',
				ifrsCategory: 'Revenue from Contracts',
				centerType: 'PROFIT_CENTER',
				version: 1,
			},
		});
		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('OPTIMISTIC_LOCK');
	});
});

// ─── 5. Referential integrity (accounts) ────────────────────────────

describe('Referential integrity — accounts', () => {
	it('returns 409 REFERENCED_RECORD on FK violation', async () => {
		const token = await makeToken();
		vi.mocked(prisma.chartOfAccount.findUnique).mockResolvedValue(mockAccount);
		vi.mocked(prisma.chartOfAccount.delete).mockRejectedValue(
			new Prisma.PrismaClientKnownRequestError('Foreign key constraint', {
				code: 'P2003',
				clientVersion: '6.0.0',
			})
		);

		const res = await app.inject({
			method: 'DELETE',
			url: '/api/v1/master-data/accounts/1',
			headers: authHeader(token),
		});
		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('REFERENCED_RECORD');
	});
});

// ─── 6. Date cross-validation (academic years) ─────────────────────

describe('Date cross-validation — academic years', () => {
	it('returns 422 INVALID_DATE_ORDER when ay1Start > ay1End', async () => {
		const token = await makeToken();
		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/master-data/academic-years',
			headers: authHeader(token),
			payload: {
				fiscalYear: '202627',
				ay1Start: '2026-12-01',
				ay1End: '2026-09-01', // before ay1Start
				summerStart: '2026-12-20',
				summerEnd: '2027-01-05',
				ay2Start: '2027-01-05',
				ay2End: '2027-06-30',
				academicWeeks: 36,
			},
		});
		expect(res.statusCode).toBe(422);
		expect(res.json().code).toBe('INVALID_DATE_ORDER');
	});

	it('returns 201 with valid date ordering', async () => {
		const mockAY = {
			id: 1,
			fiscalYear: '202627',
			ay1Start: new Date('2026-09-01'),
			ay1End: new Date('2026-12-20'),
			summerStart: new Date('2026-12-20'),
			summerEnd: new Date('2027-01-05'),
			ay2Start: new Date('2027-01-05'),
			ay2End: new Date('2027-06-30'),
			academicWeeks: 36,
			version: 1,
			createdAt: now,
			updatedAt: now,
			createdBy: 1,
			updatedBy: 1,
		};

		vi.mocked(prisma.academicYear.create).mockResolvedValue(mockAY as never);

		const token = await makeToken();
		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/master-data/academic-years',
			headers: authHeader(token),
			payload: {
				fiscalYear: '202627',
				ay1Start: '2026-09-01',
				ay1End: '2026-12-20',
				summerStart: '2026-12-20',
				summerEnd: '2027-01-05',
				ay2Start: '2027-01-05',
				ay2End: '2027-06-30',
				academicWeeks: 36,
			},
		});
		expect(res.statusCode).toBe(201);
		expect(res.json().fiscalYear).toBe('202627');
	});
});

// ─── 7. 405 enforcement (grade levels) ──────────────────────────────

describe('405 enforcement — grade levels', () => {
	it('POST /grade-levels returns 405', async () => {
		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/master-data/grade-levels',
			payload: {},
		});
		expect(res.statusCode).toBe(405);
		expect(res.json().code).toBe('METHOD_NOT_ALLOWED');
	});

	it('DELETE /grade-levels/:id returns 405', async () => {
		const res = await app.inject({
			method: 'DELETE',
			url: '/api/v1/master-data/grade-levels/1',
		});
		expect(res.statusCode).toBe(405);
		expect(res.json().code).toBe('METHOD_NOT_ALLOWED');
	});
});

// ─── 8. GOSI computation (assumptions) ──────────────────────────────

describe('GOSI computation — assumptions', () => {
	it('computes gosiRateTotal from pension + saned + ohi', async () => {
		const token = await makeToken();
		vi.mocked(prisma.assumption.findMany).mockResolvedValue(mockAssumptions);

		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/master-data/assumptions',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		// 9.75 + 1.50 + 1.00 = 12.25
		expect(body.computed.gosiRateTotal).toBe('12.2500');
	});
});

// ─── 9. Audit log verification (accounts) ───────────────────────────

describe('Audit log verification — accounts', () => {
	it('logs ACCOUNT_CREATED on create', async () => {
		const token = await makeToken();
		vi.mocked(prisma.chartOfAccount.create).mockResolvedValue(mockAccount);

		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/master-data/accounts',
			headers: authHeader(token),
			payload: {
				accountCode: 'REV001',
				accountName: 'Tuition Revenue',
				type: 'REVENUE',
				ifrsCategory: 'Revenue from Contracts',
				centerType: 'PROFIT_CENTER',
			},
		});

		expect(res.statusCode).toBe(201);
		expect(prisma.auditEntry.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					operation: 'ACCOUNT_CREATED',
					tableName: 'chart_of_accounts',
				}),
			})
		);
	});

	it('logs ACCOUNT_UPDATED with oldValues and newValues', async () => {
		const token = await makeToken();
		vi.mocked(prisma.chartOfAccount.findUnique).mockResolvedValue(mockAccount);
		vi.mocked(prisma.chartOfAccount.update).mockResolvedValue({
			...mockAccount,
			accountName: 'Updated',
			version: 2,
		});

		await app.inject({
			method: 'PUT',
			url: '/api/v1/master-data/accounts/1',
			headers: authHeader(token),
			payload: {
				accountCode: 'REV001',
				accountName: 'Updated',
				type: 'REVENUE',
				ifrsCategory: 'Revenue from Contracts',
				centerType: 'PROFIT_CENTER',
				version: 1,
			},
		});

		expect(prisma.auditEntry.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					operation: 'ACCOUNT_UPDATED',
					oldValues: expect.objectContaining({
						accountCode: 'REV001',
					}),
					newValues: expect.objectContaining({
						accountName: 'Updated',
					}),
				}),
			})
		);
	});

	it('logs ACCOUNT_DELETED with oldValues', async () => {
		const token = await makeToken();
		vi.mocked(prisma.chartOfAccount.findUnique).mockResolvedValue(mockAccount);
		vi.mocked(prisma.chartOfAccount.delete).mockResolvedValue(mockAccount);

		await app.inject({
			method: 'DELETE',
			url: '/api/v1/master-data/accounts/1',
			headers: authHeader(token),
		});

		expect(prisma.auditEntry.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					operation: 'ACCOUNT_DELETED',
					oldValues: expect.objectContaining({
						accountCode: 'REV001',
					}),
				}),
			})
		);
	});
});

// ─── 10. Zod validation errors ──────────────────────────────────────

describe('Zod validation errors', () => {
	it('rejects lowercase accountCode', async () => {
		const token = await makeToken();
		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/master-data/accounts',
			headers: authHeader(token),
			payload: {
				accountCode: 'abc',
				accountName: 'Test',
				type: 'REVENUE',
				ifrsCategory: 'Test',
				centerType: 'PROFIT_CENTER',
			},
		});
		expect(res.statusCode).toBe(400);
	});

	it('rejects empty accountName', async () => {
		const token = await makeToken();
		const res = await app.inject({
			method: 'POST',
			url: '/api/v1/master-data/accounts',
			headers: authHeader(token),
			payload: {
				accountCode: 'REV001',
				accountName: '',
				type: 'REVENUE',
				ifrsCategory: 'Test',
				centerType: 'PROFIT_CENTER',
			},
		});
		expect(res.statusCode).toBe(400);
	});
});

// ─── 11. Grade level percentage validation ──────────────────────────

describe('Grade level percentage validation', () => {
	it('rejects plancher > cible', async () => {
		const token = await makeToken();
		const res = await app.inject({
			method: 'PUT',
			url: '/api/v1/master-data/grade-levels/1',
			headers: authHeader(token),
			payload: {
				maxClassSize: 25,
				plancherPct: 0.9, // > ciblePct
				ciblePct: 0.8,
				plafondPct: 1.0,
				displayOrder: 1,
				version: 1,
			},
		});
		expect(res.statusCode).toBe(400);
	});
});

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import {
	serializerCompiler,
	validatorCompiler,
} from 'fastify-type-provider-zod';
import { generateKeyPair } from 'jose';
import { setKeys, signAccessToken } from '../../services/token.js';
import { auth } from '../../plugins/auth.js';
import type { AssumptionValueType } from '@prisma/client';
import { assumptionRoutes } from './assumptions.js';

vi.mock('../../lib/prisma.js', () => {
	const mockPrisma = {
		assumption: {
			findMany: vi.fn(),
			findUnique: vi.fn(),
			update: vi.fn(),
		},
		auditEntry: {
			create: vi.fn().mockResolvedValue({ id: 1 }),
		},
		$transaction: vi.fn().mockImplementation(
			(fn: (tx: Record<string, unknown>) => unknown) => fn({
				assumption: mockPrisma.assumption,
				auditEntry: mockPrisma.auditEntry,
			}),
		),
	};
	return { prisma: mockPrisma };
});

import { prisma } from '../../lib/prisma.js';

let app: FastifyInstance;

async function makeToken(
	overrides: { sub?: number; role?: string } = {},
) {
	return signAccessToken({
		sub: overrides.sub ?? 1,
		email: 'admin@budfin.app',
		role: overrides.role ?? 'Admin',
	});
}

function authHeader(token: string) {
	return { authorization: `Bearer ${token}` };
}

const mockAssumptions = [
	{
		id: 1,
		key: 'gosiPension',
		value: '9.00',
		unit: '%',
		section: 'social_charges',
		label: 'GOSI Pension Rate',
		valueType: 'PERCENTAGE' as AssumptionValueType,
		version: 1,
		createdAt: new Date(),
		updatedAt: new Date(),
		updatedBy: null,
	},
	{
		id: 2,
		key: 'gosiSaned',
		value: '1.50',
		unit: '%',
		section: 'social_charges',
		label: 'GOSI SANED Rate',
		valueType: 'PERCENTAGE' as AssumptionValueType,
		version: 1,
		createdAt: new Date(),
		updatedAt: new Date(),
		updatedBy: null,
	},
	{
		id: 3,
		key: 'gosiOhi',
		value: '1.75',
		unit: '%',
		section: 'social_charges',
		label: 'GOSI OHI Rate',
		valueType: 'PERCENTAGE' as AssumptionValueType,
		version: 1,
		createdAt: new Date(),
		updatedAt: new Date(),
		updatedBy: null,
	},
	{
		id: 4,
		key: 'vatRate',
		value: '15',
		unit: '%',
		section: 'tax',
		label: 'VAT Rate',
		valueType: 'PERCENTAGE' as AssumptionValueType,
		version: 1,
		createdAt: new Date(),
		updatedAt: new Date(),
		updatedBy: null,
	},
];

beforeAll(async () => {
	const keys = await generateKeyPair('RS256');
	setKeys(keys.privateKey, keys.publicKey);

	app = Fastify({ logger: false });
	app.setValidatorCompiler(validatorCompiler);
	app.setSerializerCompiler(serializerCompiler);
	await app.register(auth);
	await app.register(assumptionRoutes, {
		prefix: '/api/v1/master-data/assumptions',
	});
	await app.ready();
});

beforeEach(() => {
	vi.clearAllMocks();
});

describe('GET /api/v1/master-data/assumptions', () => {
	it('returns assumptions with computed gosiRateTotal', async () => {
		vi.mocked(prisma.assumption.findMany).mockResolvedValue(mockAssumptions);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/master-data/assumptions',
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.assumptions).toHaveLength(4);
		expect(body.computed.gosiRateTotal).toBe('12.2500');
	});

	it('returns 401 without auth token', async () => {
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/master-data/assumptions',
		});
		expect(res.statusCode).toBe(401);
	});

	it('allows Viewer role to read assumptions', async () => {
		vi.mocked(prisma.assumption.findMany).mockResolvedValue(mockAssumptions);

		const token = await makeToken({ role: 'Viewer' });
		const res = await app.inject({
			method: 'GET',
			url: '/api/v1/master-data/assumptions',
			headers: authHeader(token),
		});
		expect(res.statusCode).toBe(200);
	});
});

describe('PATCH /api/v1/master-data/assumptions', () => {
	it('updates assumption value and returns refreshed list', async () => {
		vi.mocked(prisma.assumption.update).mockResolvedValue({
			...mockAssumptions[0]!,
			value: '10.00',
			version: 2,
		});
		// First call: batch fetch for validation; second call: refreshed list in transaction
		vi.mocked(prisma.assumption.findMany)
			.mockResolvedValueOnce([mockAssumptions[0]!])
			.mockResolvedValueOnce([
				{ ...mockAssumptions[0]!, value: '10.00', version: 2 },
				mockAssumptions[1]!,
				mockAssumptions[2]!,
				mockAssumptions[3]!,
			]);

		const token = await makeToken({ role: 'Editor' });
		const res = await app.inject({
			method: 'PATCH',
			url: '/api/v1/master-data/assumptions',
			headers: authHeader(token),
			payload: {
				updates: [
					{ key: 'gosiPension', value: '10.00', version: 1 },
				],
			},
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.assumptions).toBeDefined();
		expect(body.computed.gosiRateTotal).toBe('13.2500');
	});

	it('returns 409 on version mismatch', async () => {
		vi.mocked(prisma.assumption.findMany).mockResolvedValueOnce(
			[mockAssumptions[0]!],
		);

		const token = await makeToken({ role: 'Editor' });
		const res = await app.inject({
			method: 'PATCH',
			url: '/api/v1/master-data/assumptions',
			headers: authHeader(token),
			payload: {
				updates: [
					{ key: 'gosiPension', value: '10.00', version: 99 },
				],
			},
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('OPTIMISTIC_LOCK');
	});

	it('returns 422 for invalid PERCENTAGE value', async () => {
		vi.mocked(prisma.assumption.findMany).mockResolvedValueOnce(
			[mockAssumptions[0]!],
		);

		const token = await makeToken({ role: 'Editor' });
		const res = await app.inject({
			method: 'PATCH',
			url: '/api/v1/master-data/assumptions',
			headers: authHeader(token),
			payload: {
				updates: [
					{ key: 'gosiPension', value: '150', version: 1 },
				],
			},
		});

		expect(res.statusCode).toBe(422);
		const body = res.json();
		expect(body.code).toBe('VALIDATION_ERROR');
		expect(body.field_errors).toHaveLength(1);
		expect(body.field_errors[0].field).toBe('gosiPension');
	});

	it('returns 403 for Viewer role on PATCH', async () => {
		const token = await makeToken({ role: 'Viewer' });
		const res = await app.inject({
			method: 'PATCH',
			url: '/api/v1/master-data/assumptions',
			headers: authHeader(token),
			payload: {
				updates: [
					{ key: 'gosiPension', value: '10.00', version: 1 },
				],
			},
		});
		expect(res.statusCode).toBe(403);
	});

	it('allows BudgetOwner role to PATCH', async () => {
		vi.mocked(prisma.assumption.update).mockResolvedValue({
			...mockAssumptions[0]!,
			value: '8.50',
			version: 2,
		});
		// First call: batch fetch; second call: refreshed list in transaction
		vi.mocked(prisma.assumption.findMany)
			.mockResolvedValueOnce([mockAssumptions[0]!])
			.mockResolvedValueOnce([
				{ ...mockAssumptions[0]!, value: '8.50', version: 2 },
				mockAssumptions[1]!,
				mockAssumptions[2]!,
				mockAssumptions[3]!,
			]);

		const token = await makeToken({ role: 'BudgetOwner' });
		const res = await app.inject({
			method: 'PATCH',
			url: '/api/v1/master-data/assumptions',
			headers: authHeader(token),
			payload: {
				updates: [
					{ key: 'gosiPension', value: '8.50', version: 1 },
				],
			},
		});
		expect(res.statusCode).toBe(200);
	});

	it('returns 422 for invalid CURRENCY value (negative number)', async () => {
		const currencyAssumption = {
			...mockAssumptions[0]!,
			key: 'transportFee',
			valueType: 'CURRENCY' as AssumptionValueType,
			value: '5000',
		};
		vi.mocked(prisma.assumption.findMany).mockResolvedValueOnce(
			[currencyAssumption],
		);

		const token = await makeToken({ role: 'Editor' });
		const res = await app.inject({
			method: 'PATCH',
			url: '/api/v1/master-data/assumptions',
			headers: authHeader(token),
			payload: {
				updates: [
					{ key: 'transportFee', value: '-100', version: 1 },
				],
			},
		});

		expect(res.statusCode).toBe(422);
		const body = res.json();
		expect(body.code).toBe('VALIDATION_ERROR');
		expect(body.field_errors[0].field).toBe('transportFee');
		expect(body.field_errors[0].message).toBe('Must be a non-negative number');
	});

	it('accepts valid CURRENCY value (positive number)', async () => {
		const currencyAssumption = {
			...mockAssumptions[0]!,
			key: 'transportFee',
			valueType: 'CURRENCY' as AssumptionValueType,
			value: '5000',
		};
		vi.mocked(prisma.assumption.update).mockResolvedValue({
			...currencyAssumption,
			value: '6000',
			version: 2,
		});
		// First call: batch fetch; second call: refreshed list in transaction
		vi.mocked(prisma.assumption.findMany)
			.mockResolvedValueOnce([currencyAssumption])
			.mockResolvedValueOnce(mockAssumptions);

		const token = await makeToken({ role: 'Editor' });
		const res = await app.inject({
			method: 'PATCH',
			url: '/api/v1/master-data/assumptions',
			headers: authHeader(token),
			payload: {
				updates: [
					{ key: 'transportFee', value: '6000', version: 1 },
				],
			},
		});

		expect(res.statusCode).toBe(200);
	});

	it('returns 422 for invalid INTEGER value (decimal number)', async () => {
		const integerAssumption = {
			...mockAssumptions[0]!,
			key: 'academicWeeks',
			valueType: 'INTEGER' as AssumptionValueType,
			value: '36',
		};
		vi.mocked(prisma.assumption.findMany).mockResolvedValueOnce(
			[integerAssumption],
		);

		const token = await makeToken({ role: 'Editor' });
		const res = await app.inject({
			method: 'PATCH',
			url: '/api/v1/master-data/assumptions',
			headers: authHeader(token),
			payload: {
				updates: [
					{ key: 'academicWeeks', value: '3.5', version: 1 },
				],
			},
		});

		expect(res.statusCode).toBe(422);
		const body = res.json();
		expect(body.code).toBe('VALIDATION_ERROR');
		expect(body.field_errors[0].field).toBe('academicWeeks');
		expect(body.field_errors[0].message).toBe('Must be a whole number');
	});

	it('accepts valid INTEGER value', async () => {
		const integerAssumption = {
			...mockAssumptions[0]!,
			key: 'academicWeeks',
			valueType: 'INTEGER' as AssumptionValueType,
			value: '36',
		};
		vi.mocked(prisma.assumption.update).mockResolvedValue({
			...integerAssumption,
			value: '38',
			version: 2,
		});
		// First call: batch fetch; second call: refreshed list in transaction
		vi.mocked(prisma.assumption.findMany)
			.mockResolvedValueOnce([integerAssumption])
			.mockResolvedValueOnce(mockAssumptions);

		const token = await makeToken({ role: 'Editor' });
		const res = await app.inject({
			method: 'PATCH',
			url: '/api/v1/master-data/assumptions',
			headers: authHeader(token),
			payload: {
				updates: [
					{ key: 'academicWeeks', value: '38', version: 1 },
				],
			},
		});

		expect(res.statusCode).toBe(200);
	});

	it('returns 422 for invalid DECIMAL value (non-numeric string)', async () => {
		const decimalAssumption = {
			...mockAssumptions[0]!,
			key: 'exchangeRate',
			valueType: 'DECIMAL' as AssumptionValueType,
			value: '3.75',
		};
		vi.mocked(prisma.assumption.findMany).mockResolvedValueOnce(
			[decimalAssumption],
		);

		const token = await makeToken({ role: 'Editor' });
		const res = await app.inject({
			method: 'PATCH',
			url: '/api/v1/master-data/assumptions',
			headers: authHeader(token),
			payload: {
				updates: [
					{ key: 'exchangeRate', value: 'abc', version: 1 },
				],
			},
		});

		expect(res.statusCode).toBe(422);
		const body = res.json();
		expect(body.code).toBe('VALIDATION_ERROR');
		expect(body.field_errors[0].field).toBe('exchangeRate');
		expect(body.field_errors[0].message).toBe('Must be a valid number');
	});

	it('accepts valid DECIMAL value', async () => {
		const decimalAssumption = {
			...mockAssumptions[0]!,
			key: 'exchangeRate',
			valueType: 'DECIMAL' as AssumptionValueType,
			value: '3.75',
		};
		vi.mocked(prisma.assumption.update).mockResolvedValue({
			...decimalAssumption,
			value: '3.80',
			version: 2,
		});
		// First call: batch fetch; second call: refreshed list in transaction
		vi.mocked(prisma.assumption.findMany)
			.mockResolvedValueOnce([decimalAssumption])
			.mockResolvedValueOnce(mockAssumptions);

		const token = await makeToken({ role: 'Editor' });
		const res = await app.inject({
			method: 'PATCH',
			url: '/api/v1/master-data/assumptions',
			headers: authHeader(token),
			payload: {
				updates: [
					{ key: 'exchangeRate', value: '3.80', version: 1 },
				],
			},
		});

		expect(res.statusCode).toBe(200);
	});

	it('accepts any string for TEXT valueType', async () => {
		const textAssumption = {
			...mockAssumptions[0]!,
			key: 'schoolYear',
			valueType: 'TEXT' as AssumptionValueType,
			value: '2025-26',
		};
		vi.mocked(prisma.assumption.update).mockResolvedValue({
			...textAssumption,
			value: '2026-27',
			version: 2,
		});
		// First call: batch fetch; second call: refreshed list in transaction
		vi.mocked(prisma.assumption.findMany)
			.mockResolvedValueOnce([textAssumption])
			.mockResolvedValueOnce(mockAssumptions);

		const token = await makeToken({ role: 'Editor' });
		const res = await app.inject({
			method: 'PATCH',
			url: '/api/v1/master-data/assumptions',
			headers: authHeader(token),
			payload: {
				updates: [
					{ key: 'schoolYear', value: '2026-27', version: 1 },
				],
			},
		});

		expect(res.statusCode).toBe(200);
	});

	it('creates audit entry on update', async () => {
		vi.mocked(prisma.assumption.update).mockResolvedValue({
			...mockAssumptions[0]!,
			value: '10.00',
			version: 2,
		});
		// First call: batch fetch; second call: refreshed list in transaction
		vi.mocked(prisma.assumption.findMany)
			.mockResolvedValueOnce([mockAssumptions[0]!])
			.mockResolvedValueOnce(mockAssumptions);

		const token = await makeToken({ role: 'Admin' });
		await app.inject({
			method: 'PATCH',
			url: '/api/v1/master-data/assumptions',
			headers: authHeader(token),
			payload: {
				updates: [
					{ key: 'gosiPension', value: '10.00', version: 1 },
				],
			},
		});

		expect(prisma.auditEntry.create).toHaveBeenCalledOnce();
		const call = vi.mocked(prisma.auditEntry.create).mock.calls[0]![0];
		expect(call.data.operation).toBe('ASSUMPTION_UPDATED');
		expect(call.data.tableName).toBe('assumptions');
		expect(call.data.oldValues).toMatchObject({
			key: 'gosiPension',
			value: '9.00',
		});
		expect(call.data.newValues).toMatchObject({
			key: 'gosiPension',
			value: '10.00',
		});
	});
});

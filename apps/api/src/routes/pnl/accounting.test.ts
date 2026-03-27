/**
 * P&L Accounting route tests
 *
 * GET /pnl/accounting — IFRS-structured accounting P&L view
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { generateKeyPair } from 'jose';
import { setKeys, signAccessToken } from '../../services/token.js';
import { auth } from '../../plugins/auth.js';
import { pnlAccountingRoutes } from './accounting.js';

// -- Mock Prisma ------------------------------------------------------------

vi.mock('../../lib/prisma.js', () => {
	const mockPrisma = {
		budgetVersion: {
			findUnique: vi.fn(),
		},
		monthlyPnlLine: {
			findMany: vi.fn(),
		},
		pnlTemplate: {
			findFirst: vi.fn(),
		},
		historicalActual: {
			findMany: vi.fn(),
		},
	};
	return { prisma: mockPrisma };
});

import { prisma } from '../../lib/prisma.js';

const mockPrisma = prisma as unknown as {
	budgetVersion: {
		findUnique: ReturnType<typeof vi.fn>;
	};
	monthlyPnlLine: {
		findMany: ReturnType<typeof vi.fn>;
	};
	pnlTemplate: {
		findFirst: ReturnType<typeof vi.fn>;
	};
	historicalActual: {
		findMany: ReturnType<typeof vi.fn>;
	};
};

// -- Setup ------------------------------------------------------------------

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

const mockVersion = {
	id: 1,
	name: 'Budget v1',
	status: 'Draft',
	staleModules: [] as string[],
};

/** Build a MonthlyPnlLine row for mock data */
function makePnlRow(
	overrides: Partial<{
		sectionKey: string;
		categoryKey: string;
		lineItemKey: string;
		displayLabel: string;
		depth: number;
		displayOrder: number;
		month: number;
		amount: { toString(): string };
		isSubtotal: boolean;
		isSeparator: boolean;
	}> = {}
) {
	return {
		id: Math.floor(Math.random() * 10000),
		versionId: 1,
		sectionKey: overrides.sectionKey ?? 'REVENUE_CONTRACTS',
		categoryKey: overrides.categoryKey ?? 'TUITION_FEES',
		lineItemKey: overrides.lineItemKey ?? 'TUITION_GRADE_A',
		displayLabel: overrides.displayLabel ?? 'Grade A',
		depth: overrides.depth ?? 3,
		displayOrder: overrides.displayOrder ?? 111,
		month: overrides.month ?? 1,
		amount: overrides.amount ?? { toString: () => '10000.0000' },
		signConvention: 'POSITIVE',
		isSubtotal: overrides.isSubtotal ?? false,
		isSeparator: overrides.isSeparator ?? false,
		calculatedAt: new Date(),
	};
}

/** A minimal template matching the seed structure */
const mockTemplate = {
	id: 1,
	name: 'EFIR IFRS P&L',
	isDefault: true,
	isSystem: true,
	sections: [
		{
			id: 1,
			templateId: 1,
			sectionKey: 'REVENUE',
			displayLabel: 'Revenue',
			displayOrder: 10,
			isSubtotal: false,
			subtotalFormula: null,
			signConvention: 'POSITIVE',
			mappings: [
				{
					id: 1,
					sectionId: 1,
					analyticalKey: 'TUITION_FEES',
					analyticalKeyType: 'CATEGORY',
					accountCode: '701100',
					monthFilter: [],
					displayLabel: 'Tuition',
					visibility: 'SHOW',
					displayOrder: 10,
				},
			],
		},
		{
			id: 2,
			templateId: 1,
			sectionKey: 'COST_OF_SERVICE',
			displayLabel: 'Cost of Service',
			displayOrder: 20,
			isSubtotal: false,
			subtotalFormula: null,
			signConvention: 'NEGATIVE',
			mappings: [
				{
					id: 2,
					sectionId: 2,
					analyticalKey: 'OPEX_AEFE',
					analyticalKeyType: 'LINE_ITEM',
					accountCode: '648000',
					monthFilter: [],
					displayLabel: 'AEFE Fees',
					visibility: 'SHOW',
					displayOrder: 10,
				},
			],
		},
		{
			id: 3,
			templateId: 1,
			sectionKey: 'GROSS_PROFIT',
			displayLabel: 'Gross Profit',
			displayOrder: 30,
			isSubtotal: true,
			subtotalFormula: 'REVENUE - COST_OF_SERVICE',
			signConvention: 'POSITIVE',
			mappings: [],
		},
		{
			id: 4,
			templateId: 1,
			sectionKey: 'EBITDA',
			displayLabel: 'EBITDA',
			displayOrder: 40,
			isSubtotal: true,
			subtotalFormula: 'GROSS_PROFIT',
			signConvention: 'POSITIVE',
			mappings: [],
		},
		{
			id: 5,
			templateId: 1,
			sectionKey: 'NET_PROFIT',
			displayLabel: 'Net Profit',
			displayOrder: 50,
			isSubtotal: true,
			subtotalFormula: 'EBITDA',
			signConvention: 'POSITIVE',
			mappings: [],
		},
	],
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
	await app.register(pnlAccountingRoutes, { prefix: ROUTE_PREFIX });
	await app.ready();
});

// -- Tests ------------------------------------------------------------------

describe('GET /pnl/accounting', () => {
	it('returns IFRS P&L for a version', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockVersion);

		// 12 months of tuition detail lines
		const rows = Array.from({ length: 12 }, (_, i) => makePnlRow({ month: i + 1 }));
		mockPrisma.monthlyPnlLine.findMany.mockResolvedValue(rows);
		mockPrisma.pnlTemplate.findFirst.mockResolvedValue(mockTemplate);

		const token = await makeToken();

		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/pnl/accounting`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();

		// Should have sections
		expect(body.sections).toBeDefined();
		expect(body.sections.length).toBeGreaterThan(0);

		// REVENUE section should have tuition line
		const revenue = body.sections.find((s: { sectionKey: string }) => s.sectionKey === 'REVENUE');
		expect(revenue).toBeDefined();
		expect(revenue.lines).toHaveLength(1);
		expect(revenue.lines[0].displayLabel).toBe('Tuition');
		// 12 months * 10000 = 120000
		expect(revenue.lines[0].budgetAmount).toBe('120000.0000');

		// GROSS_PROFIT should be a subtotal section
		const gp = body.sections.find((s: { sectionKey: string }) => s.sectionKey === 'GROSS_PROFIT');
		expect(gp).toBeDefined();
		expect(gp.isSubtotal).toBe(true);
		// GP = REVENUE - COST_OF_SERVICE = 120000 - 0 = 120000
		expect(gp.budgetSubtotal).toBe('120000.0000');

		// KPIs should be present
		expect(body.kpis).toBeDefined();
		expect(body.kpis.revenue).toBe('120000.0000');
	});

	it('returns 409 when P&L not calculated', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockVersion);
		mockPrisma.monthlyPnlLine.findMany.mockResolvedValue([]);

		const token = await makeToken();

		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/pnl/accounting`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('PNL_NOT_CALCULATED');
	});

	it('returns comparison data when compareYear provided', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockVersion);

		const rows = Array.from({ length: 12 }, (_, i) => makePnlRow({ month: i + 1 }));
		mockPrisma.monthlyPnlLine.findMany.mockResolvedValue(rows);
		mockPrisma.pnlTemplate.findFirst.mockResolvedValue(mockTemplate);
		mockPrisma.historicalActual.findMany.mockResolvedValue([
			{
				id: 1,
				fiscalYear: 2025,
				accountCode: '701100',
				annualAmount: { toString: () => '100000.0000' },
				source: 'SEED',
				importedAt: new Date(),
			},
		]);

		const token = await makeToken();

		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/pnl/accounting?compareYear=2025`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();

		const revenue = body.sections.find((s: { sectionKey: string }) => s.sectionKey === 'REVENUE');
		expect(revenue).toBeDefined();

		// Line should have actual and variance
		expect(revenue.lines[0].actualAmount).toBe('100000.0000');
		expect(revenue.lines[0].variance).toBe('20000.0000');
		expect(revenue.lines[0].variancePct).toBe('20.00');

		// Section-level variance
		expect(revenue.actualSubtotal).toBe('100000.0000');
		expect(revenue.varianceSubtotal).toBe('20000.0000');
	});

	it('returns 404 for non-existent version', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(null);

		const token = await makeToken();

		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/pnl/accounting`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('VERSION_NOT_FOUND');
	});

	it('requires authentication', async () => {
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/pnl/accounting`,
		});

		expect(res.statusCode).toBe(401);
	});
});

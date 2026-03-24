/**
 * Story #244 — P&L results routes
 *
 * AC-11: GET /pnl returns IFRS P&L data with format filtering
 * AC-12: GET /pnl?comparison_version_id returns side-by-side with variances
 * AC-13: GET /pnl/kpis returns KPI card data
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { generateKeyPair } from 'jose';
import { setKeys, signAccessToken } from '../../services/token.js';
import { auth } from '../../plugins/auth.js';
import { pnlResultsRoutes } from './results.js';

// -- Mock Prisma ------------------------------------------------------------

vi.mock('../../lib/prisma.js', () => {
	const mockPrisma = {
		budgetVersion: {
			findUnique: vi.fn(),
		},
		monthlyPnlLine: {
			count: vi.fn(),
			findMany: vi.fn(),
		},
		monthlyBudgetSummary: {
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
		count: ReturnType<typeof vi.fn>;
		findMany: ReturnType<typeof vi.fn>;
	};
	monthlyBudgetSummary: {
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

/** Helper: build a MonthlyPnlLine row for a given month */
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
		sectionKey: overrides.sectionKey ?? 'TOTAL_REVENUE',
		categoryKey: overrides.categoryKey ?? 'TOTAL_REVENUE',
		lineItemKey: overrides.lineItemKey ?? 'TOTAL_REVENUE',
		displayLabel: overrides.displayLabel ?? 'Total Revenue',
		depth: overrides.depth ?? 1,
		displayOrder: overrides.displayOrder ?? 10,
		month: overrides.month ?? 1,
		amount: overrides.amount ?? { toString: () => '100000.0000' },
		signConvention: 'POSITIVE',
		isSubtotal: overrides.isSubtotal ?? true,
		isSeparator: overrides.isSeparator ?? false,
		calculatedAt: new Date(),
	};
}

/** Helper: build a MonthlyBudgetSummary row */
function makeSummaryRow(month: number) {
	return {
		id: month,
		versionId: 1,
		month,
		revenueHt: { toString: () => '500000.0000' },
		staffCosts: { toString: () => '300000.0000' },
		opexCosts: { toString: () => '50000.0000' },
		depreciation: { toString: () => '10000.0000' },
		impairment: { toString: () => '0.0000' },
		ebitda: { toString: () => '150000.0000' },
		operatingProfit: { toString: () => '140000.0000' },
		financeNet: { toString: () => '1000.0000' },
		profitBeforeZakat: { toString: () => '141000.0000' },
		zakatAmount: { toString: () => '3525.0000' },
		netProfit: { toString: () => '137475.0000' },
		calculatedAt: new Date('2026-03-24T10:00:00Z'),
	};
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
	await app.register(pnlResultsRoutes, { prefix: ROUTE_PREFIX });
	await app.ready();
});

// -- GET /pnl ---------------------------------------------------------------

describe('GET /pnl', () => {
	it('returns 404 when version not found', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(null);
		const token = await makeToken();

		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/pnl`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('VERSION_NOT_FOUND');
	});

	it('returns 404 when no P&L data exists', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockVersion);
		mockPrisma.monthlyPnlLine.count.mockResolvedValue(0);
		const token = await makeToken();

		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/pnl`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('PNL_NOT_CALCULATED');
	});

	it('returns data in ifrs format (all depths)', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockVersion);
		mockPrisma.monthlyPnlLine.count.mockResolvedValue(36);

		// 3 lines: depth 1, 2, 3 — each with 12 months
		const rows: ReturnType<typeof makePnlRow>[] = [];
		for (let m = 1; m <= 12; m++) {
			rows.push(makePnlRow({ depth: 1, displayOrder: 10, month: m }));
			rows.push(
				makePnlRow({
					sectionKey: 'REVENUE_CONTRACTS',
					categoryKey: 'TUITION_FEES',
					lineItemKey: 'TUITION_FEES',
					displayLabel: 'Tuition Fees',
					depth: 2,
					displayOrder: 20,
					month: m,
					amount: { toString: () => '80000.0000' },
				})
			);
			rows.push(
				makePnlRow({
					sectionKey: 'REVENUE_CONTRACTS',
					categoryKey: 'TUITION_FEES',
					lineItemKey: 'MATERNELLE_REDUIT',
					displayLabel: 'Maternelle - Tarif Reduit',
					depth: 3,
					displayOrder: 30,
					month: m,
					amount: { toString: () => '20000.0000' },
				})
			);
		}

		mockPrisma.monthlyPnlLine.findMany.mockResolvedValue(rows);
		mockPrisma.monthlyBudgetSummary.findMany.mockResolvedValue(
			Array.from({ length: 12 }, (_, i) => makeSummaryRow(i + 1))
		);

		const token = await makeToken();

		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/pnl`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.format).toBe('ifrs');
		expect(body.lines).toHaveLength(3);
		expect(body.lines[0].depth).toBe(1);
		expect(body.lines[1].depth).toBe(2);
		expect(body.lines[2].depth).toBe(3);
		expect(body.lines[0].monthlyAmounts).toHaveLength(12);
		expect(body.lines[0].annualTotal).toBe('1200000.0000');
		expect(body.kpis.totalRevenueHt).toBeDefined();
		expect(body.calculatedAt).toBeDefined();
	});

	it('returns only depth 1 rows for format=summary', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockVersion);
		mockPrisma.monthlyPnlLine.count.mockResolvedValue(36);

		const rows: ReturnType<typeof makePnlRow>[] = [];
		for (let m = 1; m <= 12; m++) {
			rows.push(makePnlRow({ depth: 1, displayOrder: 10, month: m }));
		}

		// Mock returns only depth <= 1 since query filters
		mockPrisma.monthlyPnlLine.findMany.mockResolvedValue(rows);
		mockPrisma.monthlyBudgetSummary.findMany.mockResolvedValue(
			Array.from({ length: 12 }, (_, i) => makeSummaryRow(i + 1))
		);

		const token = await makeToken();

		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/pnl?format=summary`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.format).toBe('summary');
		expect(body.lines).toHaveLength(1);
		expect(body.lines[0].depth).toBe(1);
	});

	it('returns depth 1 and 2 rows for format=detailed', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockVersion);
		mockPrisma.monthlyPnlLine.count.mockResolvedValue(36);

		const rows: ReturnType<typeof makePnlRow>[] = [];
		for (let m = 1; m <= 12; m++) {
			rows.push(makePnlRow({ depth: 1, displayOrder: 10, month: m }));
			rows.push(
				makePnlRow({
					sectionKey: 'REVENUE_CONTRACTS',
					categoryKey: 'TUITION_FEES',
					lineItemKey: 'TUITION_FEES',
					displayLabel: 'Tuition Fees',
					depth: 2,
					displayOrder: 20,
					month: m,
				})
			);
		}

		mockPrisma.monthlyPnlLine.findMany.mockResolvedValue(rows);
		mockPrisma.monthlyBudgetSummary.findMany.mockResolvedValue(
			Array.from({ length: 12 }, (_, i) => makeSummaryRow(i + 1))
		);

		const token = await makeToken();

		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/pnl?format=detailed`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.format).toBe('detailed');
		expect(body.lines).toHaveLength(2);
		expect(body.lines.every((l: { depth: number }) => l.depth <= 2)).toBe(true);
	});

	it('returns variance columns in comparison mode', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockVersion);
		mockPrisma.monthlyPnlLine.count.mockResolvedValue(12);

		const primaryRows: ReturnType<typeof makePnlRow>[] = [];
		const comparisonRows: ReturnType<typeof makePnlRow>[] = [];
		for (let m = 1; m <= 12; m++) {
			primaryRows.push(
				makePnlRow({
					depth: 1,
					displayOrder: 10,
					month: m,
					amount: { toString: () => '120000.0000' },
				})
			);
			comparisonRows.push(
				makePnlRow({
					depth: 1,
					displayOrder: 10,
					month: m,
					amount: { toString: () => '100000.0000' },
				})
			);
		}

		// First call: primary, Second call: comparison
		mockPrisma.monthlyPnlLine.findMany
			.mockResolvedValueOnce(primaryRows)
			.mockResolvedValueOnce(comparisonRows);
		mockPrisma.monthlyBudgetSummary.findMany.mockResolvedValue(
			Array.from({ length: 12 }, (_, i) => makeSummaryRow(i + 1))
		);

		const token = await makeToken();

		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/pnl?comparison_version_id=2`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		const line = body.lines[0];

		expect(line.comparisonMonthlyAmounts).toHaveLength(12);
		expect(line.comparisonAnnualTotal).toBeDefined();
		expect(line.varianceMonthlyAmounts).toHaveLength(12);
		expect(line.varianceMonthlyPercents).toHaveLength(12);
		expect(line.varianceAnnualTotal).toBe('240000.0000');
		expect(line.varianceAnnualPercent).toBe('20.00');
	});
});

// -- GET /pnl/kpis ----------------------------------------------------------

describe('GET /pnl/kpis', () => {
	it('returns 404 when version not found', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(null);
		const token = await makeToken();

		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/pnl/kpis`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('VERSION_NOT_FOUND');
	});

	it('returns 404 when no summary data exists', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockVersion);
		mockPrisma.monthlyBudgetSummary.findMany.mockResolvedValue([]);
		const token = await makeToken();

		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/pnl/kpis`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('PNL_NOT_CALCULATED');
	});

	it('returns correct KPI values summed across 12 months', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockVersion);
		mockPrisma.monthlyBudgetSummary.findMany.mockResolvedValue(
			Array.from({ length: 12 }, (_, i) => makeSummaryRow(i + 1))
		);
		const token = await makeToken();

		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/pnl/kpis`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();

		// 12 months * 500000 = 6000000
		expect(body.totalRevenueHt).toBe('6000000.0000');
		// 12 months * 150000 = 1800000
		expect(body.ebitda).toBe('1800000.0000');
		// 12 months * 137475 = 1649700
		expect(body.netProfit).toBe('1649700.0000');
		// margin = 1800000 / 6000000 * 100 = 30.00
		expect(body.ebitdaMarginPct).toBe('30.00');
	});

	it('handles zero revenue without division error', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockVersion);
		mockPrisma.monthlyBudgetSummary.findMany.mockResolvedValue([
			{
				...makeSummaryRow(1),
				revenueHt: { toString: () => '0.0000' },
				ebitda: { toString: () => '0.0000' },
				netProfit: { toString: () => '0.0000' },
			},
		]);
		const token = await makeToken();

		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/pnl/kpis`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.ebitdaMarginPct).toBe('0.00');
		expect(body.totalRevenueHt).toBe('0.0000');
	});
});

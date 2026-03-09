import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { generateKeyPair } from 'jose';
import { auth } from '../../plugins/auth.js';
import { revenueResultsRoutes } from './results.js';
import { setKeys, signAccessToken } from '../../services/token.js';

vi.mock('../../lib/prisma.js', () => {
	const mockPrisma = {
		budgetVersion: {
			findUnique: vi.fn(),
		},
		monthlyRevenue: {
			findMany: vi.fn(),
		},
		monthlyOtherRevenue: {
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
	monthlyRevenue: {
		findMany: ReturnType<typeof vi.fn>;
	};
	monthlyOtherRevenue: {
		findMany: ReturnType<typeof vi.fn>;
	};
};

let app: FastifyInstance;

async function makeToken(role = 'Viewer') {
	return signAccessToken({
		sub: 1,
		email: 'viewer@budfin.app',
		role,
		sessionId: 'revenue-session',
	});
}

function authHeader(token: string) {
	return { authorization: `Bearer ${token}` };
}

const ROUTE_PREFIX = '/api/v1/versions/:versionId';
const URL_PREFIX = '/api/v1/versions/1';

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
	await app.register(revenueResultsRoutes, { prefix: ROUTE_PREFIX });
	await app.ready();
});

describe('GET /revenue', () => {
	it('returns workbook-style reporting views and excludes non-executive lines from totals', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue({
			id: 1,
			name: 'Validation FY2026',
			status: 'Draft',
		});
		mockPrisma.monthlyRevenue.findMany.mockResolvedValue([
			{
				academicPeriod: 'AY1',
				gradeLevel: 'PS',
				nationality: 'Francais',
				tariff: 'Plein',
				month: 1,
				grossRevenueHt: '1000.0000',
				discountAmount: '100.0000',
				scholarshipDeduction: '0.0000',
				netRevenueHt: '900.0000',
				vatAmount: '150.0000',
			},
			{
				academicPeriod: 'AY2',
				gradeLevel: 'CP',
				nationality: 'Nationaux',
				tariff: 'Plein',
				month: 9,
				grossRevenueHt: '800.0000',
				discountAmount: '50.0000',
				scholarshipDeduction: '0.0000',
				netRevenueHt: '750.0000',
				vatAmount: '0.0000',
			},
		]);
		mockPrisma.monthlyOtherRevenue.findMany.mockResolvedValue([
			{
				lineItemName: 'Frais de Dossier AY1',
				ifrsCategory: 'Registration Fees',
				executiveCategory: 'REGISTRATION_FEES',
				month: 1,
				amount: '200.0000',
			},
			{
				lineItemName: 'Evaluation Tests AY1',
				ifrsCategory: 'Registration Fees',
				executiveCategory: 'REGISTRATION_FEES',
				month: 1,
				amount: '50.0000',
			},
			{
				lineItemName: 'After-School Activities (APS)',
				ifrsCategory: 'Activities & Services',
				executiveCategory: 'ACTIVITIES_SERVICES',
				month: 9,
				amount: '75.0000',
			},
			{
				lineItemName: 'PSG Academy Rental',
				ifrsCategory: 'Other Revenue',
				executiveCategory: null,
				month: 2,
				amount: '999.0000',
			},
		]);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/revenue`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);

		const body = res.json();
		expect(body.summary).toHaveLength(2);
		expect(body.totals.grossRevenueHt).toBe('1800.0000');
		expect(body.totals.discountAmount).toBe('150.0000');
		expect(body.totals.netRevenueHt).toBe('1650.0000');
		expect(body.totals.otherRevenueAmount).toBe('375.0000');
		expect(body.totals.totalOperatingRevenue).toBe('2025.0000');

		expect(
			body.otherRevenueEntries.find(
				(entry: { lineItemName: string; includeInExecutiveSummary: boolean }) =>
					entry.lineItemName === 'PSG Academy Rental'
			)?.includeInExecutiveSummary
		).toBe(false);

		expect(
			body.revenueEngine.rows.find(
				(row: { label: string; annualTotal: string }) => row.label === 'Evaluation Tests'
			)?.annualTotal
		).toBe('50.0000');
		expect(
			body.executiveSummary.rows.find(
				(row: { label: string; annualTotal: string }) => row.label === 'Registration Fees'
			)?.annualTotal
		).toBe('300.0000');
		expect(
			body.executiveSummary.rows.find(
				(row: { label: string; annualTotal: string }) => row.label === 'TOTAL OPERATING REVENUE'
			)?.annualTotal
		).toBe('2025.0000');
	});

	it('filters tuition rows by academic period while keeping other revenue available for reporting', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue({
			id: 1,
			name: 'Validation FY2026',
			status: 'Draft',
		});
		mockPrisma.monthlyRevenue.findMany.mockResolvedValue([]);
		mockPrisma.monthlyOtherRevenue.findMany.mockResolvedValue([]);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/revenue?academic_period=AY1&group_by=grade`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		expect(mockPrisma.monthlyRevenue.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					versionId: 1,
					scenarioName: 'Base',
					academicPeriod: 'AY1',
				},
			})
		);
		expect(mockPrisma.monthlyOtherRevenue.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					versionId: 1,
					scenarioName: 'Base',
				},
			})
		);
	});

	it('returns 404 when the version does not exist', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(null);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/revenue`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('VERSION_NOT_FOUND');
	});

	it('returns 401 without authentication', async () => {
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/revenue`,
		});

		expect(res.statusCode).toBe(401);
	});
});

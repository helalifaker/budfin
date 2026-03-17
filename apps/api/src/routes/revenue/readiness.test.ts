import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { generateKeyPair } from 'jose';
import { auth } from '../../plugins/auth.js';
import { revenueReadinessRoutes } from './readiness.js';
import { setKeys, signAccessToken } from '../../services/token.js';

vi.mock('../../lib/prisma.js', () => {
	const mockPrisma = {
		budgetVersion: {
			findUnique: vi.fn(),
		},
		feeGrid: {
			count: vi.fn(),
			findMany: vi.fn(),
		},
		otherRevenueItem: {
			findMany: vi.fn(),
		},
		versionRevenueSettings: {
			findUnique: vi.fn(),
		},
		enrollmentDetail: {
			findMany: vi.fn(),
		},
	};
	return { prisma: mockPrisma };
});

import { prisma } from '../../lib/prisma.js';

const mockPrisma = prisma as unknown as {
	budgetVersion: { findUnique: ReturnType<typeof vi.fn> };
	feeGrid: { count: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
	otherRevenueItem: { findMany: ReturnType<typeof vi.fn> };
	versionRevenueSettings: { findUnique: ReturnType<typeof vi.fn> };
	enrollmentDetail: { findMany: ReturnType<typeof vi.fn> };
};

let app: FastifyInstance;

async function makeToken(role = 'Admin') {
	return signAccessToken({
		sub: 1,
		email: 'admin@budfin.app',
		role,
		sessionId: 'readiness-session',
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
	await app.register(revenueReadinessRoutes, { prefix: ROUTE_PREFIX });
	await app.ready();

	mockPrisma.budgetVersion.findUnique.mockResolvedValue({ id: 1 });
	mockPrisma.feeGrid.count.mockResolvedValue(0);
	mockPrisma.feeGrid.findMany.mockResolvedValue([]);
	mockPrisma.otherRevenueItem.findMany.mockResolvedValue([]);
	mockPrisma.versionRevenueSettings.findUnique.mockResolvedValue({
		id: 1,
		flatDiscountPct: '0.000000',
	});
	mockPrisma.enrollmentDetail.findMany.mockResolvedValue([]);
});

describe('GET /revenue/readiness', () => {
	it('returns overallReady true when all three areas are configured', async () => {
		mockPrisma.feeGrid.count.mockResolvedValue(90);
		mockPrisma.otherRevenueItem.findMany.mockResolvedValue([
			{
				lineItemName: 'APS',
				annualAmount: '1230000.0000',
				distributionMethod: 'ACADEMIC_10',
				weightArray: null,
				specificMonths: [],
				ifrsCategory: 'Activities & Services',
				computeMethod: null,
			},
			{
				lineItemName: 'DAI - Francais',
				annualAmount: '0.0000',
				distributionMethod: 'SPECIFIC_PERIOD',
				weightArray: null,
				specificMonths: [5, 6],
				ifrsCategory: 'Registration Fees',
				computeMethod: 'DAI',
			},
			{
				lineItemName: 'DAI - Nationaux',
				annualAmount: '0.0000',
				distributionMethod: 'SPECIFIC_PERIOD',
				weightArray: null,
				specificMonths: [5, 6],
				ifrsCategory: 'Registration Fees',
				computeMethod: 'DAI',
			},
			{
				lineItemName: 'DAI - Autres',
				annualAmount: '0.0000',
				distributionMethod: 'SPECIFIC_PERIOD',
				weightArray: null,
				specificMonths: [5, 6],
				ifrsCategory: 'Registration Fees',
				computeMethod: 'DAI',
			},
			{
				lineItemName: 'DPI - Francais',
				annualAmount: '0.0000',
				distributionMethod: 'SPECIFIC_PERIOD',
				weightArray: null,
				specificMonths: [5, 6],
				ifrsCategory: 'Registration Fees',
				computeMethod: 'DPI',
			},
			{
				lineItemName: 'DPI - Nationaux',
				annualAmount: '0.0000',
				distributionMethod: 'SPECIFIC_PERIOD',
				weightArray: null,
				specificMonths: [5, 6],
				ifrsCategory: 'Registration Fees',
				computeMethod: 'DPI',
			},
			{
				lineItemName: 'DPI - Autres',
				annualAmount: '0.0000',
				distributionMethod: 'SPECIFIC_PERIOD',
				weightArray: null,
				specificMonths: [5, 6],
				ifrsCategory: 'Registration Fees',
				computeMethod: 'DPI',
			},
			{
				lineItemName: 'Frais de Dossier - Francais',
				annualAmount: '0.0000',
				distributionMethod: 'SPECIFIC_PERIOD',
				weightArray: null,
				specificMonths: [5, 6],
				ifrsCategory: 'Registration Fees',
				computeMethod: 'FRAIS_DOSSIER',
			},
			{
				lineItemName: 'Frais de Dossier - Nationaux',
				annualAmount: '0.0000',
				distributionMethod: 'SPECIFIC_PERIOD',
				weightArray: null,
				specificMonths: [5, 6],
				ifrsCategory: 'Registration Fees',
				computeMethod: 'FRAIS_DOSSIER',
			},
			{
				lineItemName: 'Frais de Dossier - Autres',
				annualAmount: '0.0000',
				distributionMethod: 'SPECIFIC_PERIOD',
				weightArray: null,
				specificMonths: [5, 6],
				ifrsCategory: 'Registration Fees',
				computeMethod: 'FRAIS_DOSSIER',
			},
			{
				lineItemName: 'BAC',
				annualAmount: '0.0000',
				distributionMethod: 'SPECIFIC_PERIOD',
				weightArray: null,
				specificMonths: [4, 5],
				ifrsCategory: 'Examination Fees',
				computeMethod: 'EXAM_BAC',
			},
			{
				lineItemName: 'DNB',
				annualAmount: '0.0000',
				distributionMethod: 'SPECIFIC_PERIOD',
				weightArray: null,
				specificMonths: [4, 5],
				ifrsCategory: 'Examination Fees',
				computeMethod: 'EXAM_DNB',
			},
			{
				lineItemName: 'EAF',
				annualAmount: '0.0000',
				distributionMethod: 'SPECIFIC_PERIOD',
				weightArray: null,
				specificMonths: [4, 5],
				ifrsCategory: 'Examination Fees',
				computeMethod: 'EXAM_EAF',
			},
			{
				lineItemName: 'Evaluation - Primaire',
				annualAmount: '0.0000',
				distributionMethod: 'SPECIFIC_PERIOD',
				weightArray: null,
				specificMonths: [10, 11],
				ifrsCategory: 'Registration Fees',
				computeMethod: 'EVAL_PRIMAIRE',
			},
			{
				lineItemName: 'Evaluation - College+Lycee',
				annualAmount: '0.0000',
				distributionMethod: 'SPECIFIC_PERIOD',
				weightArray: null,
				specificMonths: [10, 11],
				ifrsCategory: 'Registration Fees',
				computeMethod: 'EVAL_SECONDAIRE',
			},
		]);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/revenue/readiness`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.feeGrid).toEqual({ total: 90, complete: 90, settingsExist: true, ready: true });
		expect(body.discounts).toEqual({ flatRate: '0.000000', ready: true });
		expect(body.otherRevenue).toEqual({ total: 15, configured: 15, ready: true });
		expect(body.overallReady).toBe(true);
		expect(body.readyCount).toBe(2);
		expect(body.totalCount).toBe(2);
		expect(body.enrollmentFeeGridAlignment).toEqual({
			totalSegments: 0,
			matchedSegments: 0,
			unmatchedSegments: [],
		});
	});

	it('returns all areas not ready when nothing is configured', async () => {
		mockPrisma.versionRevenueSettings.findUnique.mockResolvedValue(null);

		const token = await makeToken('Viewer');
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/revenue/readiness`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.feeGrid).toEqual({ total: 0, complete: 0, settingsExist: false, ready: false });
		expect(body.discounts).toEqual({ flatRate: null, ready: false });
		expect(body.otherRevenue).toEqual({ total: 0, configured: 0, ready: false });
		expect(body.overallReady).toBe(false);
		expect(body.readyCount).toBe(0);
		expect(body.totalCount).toBe(2);
	});

	it('returns partial readiness when only discounts are configured', async () => {
		mockPrisma.otherRevenueItem.findMany.mockResolvedValue([
			{
				lineItemName: 'APS',
				annualAmount: '5000.0000',
				distributionMethod: 'ACADEMIC_10',
				weightArray: null,
				specificMonths: [],
				ifrsCategory: 'Activities & Services',
				computeMethod: null,
			},
			{
				lineItemName: 'Garderie',
				annualAmount: '5000.0000',
				distributionMethod: 'YEAR_ROUND_12',
				weightArray: null,
				specificMonths: [],
				ifrsCategory: 'Activities & Services',
				computeMethod: null,
			},
		]);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/revenue/readiness`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.overallReady).toBe(false);
		expect(body.readyCount).toBe(0);
		expect(body.feeGrid.ready).toBe(false);
		expect(body.discounts.ready).toBe(true);
		expect(body.otherRevenue.ready).toBe(false);
		expect(body.totalCount).toBe(2);
	});

	it('returns 404 for a missing version', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(null);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/revenue/readiness`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('VERSION_NOT_FOUND');
	});

	it('allows Viewer access', async () => {
		const token = await makeToken('Viewer');
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/revenue/readiness`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
	});
});

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { generateKeyPair } from 'jose';
import { auth } from '../../plugins/auth.js';
import { staffingSettingsRoutes } from './settings.js';
import { setKeys, signAccessToken } from '../../services/token.js';

vi.mock('../../lib/prisma.js', () => {
	const mockPrisma = {
		budgetVersion: {
			findUnique: vi.fn(),
			update: vi.fn(),
		},
		versionStaffingSettings: {
			findUnique: vi.fn(),
			create: vi.fn(),
			upsert: vi.fn(),
		},
		versionServiceProfileOverride: {
			findMany: vi.fn(),
			deleteMany: vi.fn(),
			createMany: vi.fn(),
		},
		versionStaffingCostAssumption: {
			findMany: vi.fn(),
			deleteMany: vi.fn(),
			createMany: vi.fn(),
		},
		versionLyceeGroupAssumption: {
			findMany: vi.fn(),
			deleteMany: vi.fn(),
			createMany: vi.fn(),
		},
		demandOverride: {
			findMany: vi.fn(),
			findFirst: vi.fn(),
			deleteMany: vi.fn(),
			createMany: vi.fn(),
			delete: vi.fn(),
		},
		teachingRequirementLine: {
			findMany: vi.fn(),
		},
		teachingRequirementSource: {
			findMany: vi.fn(),
		},
		staffingAssignment: {
			findMany: vi.fn().mockResolvedValue([]),
		},
		auditEntry: {
			create: vi.fn().mockResolvedValue({ id: 1 }),
		},
		$transaction: vi
			.fn()
			.mockImplementation((fn: (tx: Record<string, unknown>) => unknown) => fn(mockPrisma)),
	};
	return { prisma: mockPrisma };
});

import { prisma } from '../../lib/prisma.js';

const mockPrisma = prisma as unknown as {
	budgetVersion: {
		findUnique: ReturnType<typeof vi.fn>;
		update: ReturnType<typeof vi.fn>;
	};
	versionStaffingSettings: {
		findUnique: ReturnType<typeof vi.fn>;
		create: ReturnType<typeof vi.fn>;
		upsert: ReturnType<typeof vi.fn>;
	};
	versionServiceProfileOverride: {
		findMany: ReturnType<typeof vi.fn>;
		deleteMany: ReturnType<typeof vi.fn>;
		createMany: ReturnType<typeof vi.fn>;
	};
	versionStaffingCostAssumption: {
		findMany: ReturnType<typeof vi.fn>;
		deleteMany: ReturnType<typeof vi.fn>;
		createMany: ReturnType<typeof vi.fn>;
	};
	versionLyceeGroupAssumption: {
		findMany: ReturnType<typeof vi.fn>;
		deleteMany: ReturnType<typeof vi.fn>;
		createMany: ReturnType<typeof vi.fn>;
	};
	demandOverride: {
		findMany: ReturnType<typeof vi.fn>;
		findFirst: ReturnType<typeof vi.fn>;
		deleteMany: ReturnType<typeof vi.fn>;
		createMany: ReturnType<typeof vi.fn>;
		delete: ReturnType<typeof vi.fn>;
	};
	teachingRequirementLine: {
		findMany: ReturnType<typeof vi.fn>;
	};
	teachingRequirementSource: {
		findMany: ReturnType<typeof vi.fn>;
	};
	auditEntry: { create: ReturnType<typeof vi.fn> };
	$transaction: ReturnType<typeof vi.fn>;
};

let app: FastifyInstance;

async function makeToken(role = 'Admin') {
	return signAccessToken({
		sub: 1,
		email: 'admin@budfin.app',
		role,
		sessionId: 'staffing-settings-session',
	});
}

function authHeader(token: string) {
	return { authorization: `Bearer ${token}` };
}

const ROUTE_PREFIX = '/api/v1/versions/:versionId';
const URL_PREFIX = '/api/v1/versions/1';

const mockVersion = {
	id: 1,
	status: 'Draft',
	staleModules: [] as string[],
	fiscalYear: 2026,
};

const mockSettings = {
	id: 1,
	versionId: 1,
	hsaTargetHours: { toString: () => '1.50' },
	hsaFirstHourRate: { toString: () => '500.00' },
	hsaAdditionalHourRate: { toString: () => '400.00' },
	hsaMonths: 10,
	academicWeeks: 36,
	ajeerAnnualLevy: { toString: () => '9500.0000' },
	ajeerMonthlyFee: { toString: () => '160.0000' },
	reconciliationBaseline: null,
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
	await app.register(staffingSettingsRoutes, { prefix: ROUTE_PREFIX });
	await app.ready();

	mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockVersion);
	mockPrisma.budgetVersion.update.mockResolvedValue({});
});

// ── Staffing Settings ────────────────────────────────────────────────────────

describe('GET /staffing-settings', () => {
	it('returns existing staffing settings', async () => {
		mockPrisma.versionStaffingSettings.findUnique.mockResolvedValue(mockSettings);

		const token = await makeToken('Viewer');
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/staffing-settings`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.data.hsaTargetHours).toBe('1.50');
		expect(body.data.hsaMonths).toBe(10);
		expect(body.data.academicWeeks).toBe(36);
	});

	it('auto-creates settings with defaults when not found', async () => {
		mockPrisma.versionStaffingSettings.findUnique.mockResolvedValue(null);
		mockPrisma.versionStaffingSettings.create.mockResolvedValue(mockSettings);

		const token = await makeToken('Viewer');
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/staffing-settings`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		expect(mockPrisma.versionStaffingSettings.create).toHaveBeenCalledWith({
			data: { versionId: 1 },
		});
	});

	it('returns 404 when version does not exist', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(null);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/staffing-settings`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('VERSION_NOT_FOUND');
	});
});

describe('PUT /staffing-settings', () => {
	const payload = {
		hsaTargetHours: '2.00',
		hsaFirstHourRate: '600.00',
		hsaAdditionalHourRate: '500.00',
		hsaMonths: 10,
		academicWeeks: 36,
		ajeerAnnualLevy: '9500.0000',
		ajeerMonthlyFee: '160.0000',
	};

	it('updates staffing settings and marks STAFFING stale', async () => {
		mockPrisma.versionStaffingSettings.upsert.mockResolvedValue(mockSettings);

		const token = await makeToken('Editor');
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/staffing-settings`,
			headers: authHeader(token),
			payload,
		});

		expect(res.statusCode).toBe(200);
		expect(mockPrisma.versionStaffingSettings.upsert).toHaveBeenCalled();
		expect(mockPrisma.budgetVersion.update).toHaveBeenCalledWith({
			where: { id: 1 },
			data: { staleModules: ['STAFFING'] },
		});
	});

	it('skips stale marking when STAFFING already stale', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue({
			...mockVersion,
			staleModules: ['STAFFING'],
		});
		mockPrisma.versionStaffingSettings.upsert.mockResolvedValue(mockSettings);

		const token = await makeToken('Editor');
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/staffing-settings`,
			headers: authHeader(token),
			payload,
		});

		expect(res.statusCode).toBe(200);
		expect(mockPrisma.budgetVersion.update).not.toHaveBeenCalled();
	});

	it('returns 409 for non-draft versions', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue({
			...mockVersion,
			status: 'Published',
		});

		const token = await makeToken();
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/staffing-settings`,
			headers: authHeader(token),
			payload,
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('VERSION_LOCKED');
	});

	it('returns 403 for Viewer role', async () => {
		const token = await makeToken('Viewer');
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/staffing-settings`,
			headers: authHeader(token),
			payload,
		});

		expect(res.statusCode).toBe(403);
		expect(res.json().code).toBe('FORBIDDEN');
	});

	it('returns 401 without authentication', async () => {
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/staffing-settings`,
			payload,
		});

		expect(res.statusCode).toBe(401);
	});
});

// ── Service Profile Overrides ────────────────────────────────────────────────

describe('GET /service-profile-overrides', () => {
	it('returns overrides with profile data', async () => {
		const mockOverrides = [
			{
				id: 1,
				versionId: 1,
				serviceProfileId: 2,
				serviceProfile: { code: 'ENS2D', name: 'Enseignant 2nd degre', sortOrder: 2 },
				weeklyServiceHours: { toString: () => '15.0' },
				hsaEligible: true,
			},
		];
		mockPrisma.versionServiceProfileOverride.findMany.mockResolvedValue(mockOverrides);

		const token = await makeToken('Viewer');
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/service-profile-overrides`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.data).toHaveLength(1);
		expect(body.data[0].serviceProfileCode).toBe('ENS2D');
		expect(body.data[0].weeklyServiceHours).toBe('15.0');
	});
});

describe('PUT /service-profile-overrides', () => {
	it('replaces overrides and marks STAFFING stale', async () => {
		mockPrisma.versionServiceProfileOverride.deleteMany.mockResolvedValue({ count: 0 });
		mockPrisma.versionServiceProfileOverride.createMany.mockResolvedValue({ count: 1 });
		mockPrisma.versionServiceProfileOverride.findMany.mockResolvedValue([
			{
				id: 10,
				versionId: 1,
				serviceProfileId: 2,
				serviceProfile: { code: 'ENS2D', name: 'Enseignant 2nd degre', sortOrder: 2 },
				weeklyServiceHours: { toString: () => '15.0' },
				hsaEligible: true,
			},
		]);

		const token = await makeToken('Editor');
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/service-profile-overrides`,
			headers: authHeader(token),
			payload: {
				overrides: [
					{
						serviceProfileId: 2,
						weeklyServiceHours: '15.0',
						hsaEligible: true,
					},
				],
			},
		});

		expect(res.statusCode).toBe(200);
		expect(mockPrisma.versionServiceProfileOverride.deleteMany).toHaveBeenCalledWith({
			where: { versionId: 1 },
		});
		expect(mockPrisma.versionServiceProfileOverride.createMany).toHaveBeenCalled();
		expect(mockPrisma.budgetVersion.update).toHaveBeenCalledWith({
			where: { id: 1 },
			data: { staleModules: ['STAFFING'] },
		});
	});

	it('returns 403 for Viewer role', async () => {
		const token = await makeToken('Viewer');
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/service-profile-overrides`,
			headers: authHeader(token),
			payload: { overrides: [] },
		});

		expect(res.statusCode).toBe(403);
	});
});

// ── Cost Assumptions ─────────────────────────────────────────────────────────

describe('GET /cost-assumptions', () => {
	it('returns cost assumptions', async () => {
		const mockAssumptions = [
			{
				id: 1,
				versionId: 1,
				category: 'REMPLACEMENTS',
				calculationMode: 'PERCENT_OF_PAYROLL',
				value: { toString: () => '0.0975' },
			},
		];
		mockPrisma.versionStaffingCostAssumption.findMany.mockResolvedValue(mockAssumptions);

		const token = await makeToken('Viewer');
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/cost-assumptions`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.data).toHaveLength(1);
		expect(body.data[0].category).toBe('REMPLACEMENTS');
		expect(body.data[0].value).toBe('0.0975');
	});
});

describe('PUT /cost-assumptions', () => {
	it('replaces assumptions and marks STAFFING stale', async () => {
		mockPrisma.versionStaffingCostAssumption.deleteMany.mockResolvedValue({ count: 0 });
		mockPrisma.versionStaffingCostAssumption.createMany.mockResolvedValue({ count: 1 });
		mockPrisma.versionStaffingCostAssumption.findMany.mockResolvedValue([
			{
				id: 10,
				versionId: 1,
				category: 'REMPLACEMENTS',
				calculationMode: 'PERCENT_OF_PAYROLL',
				value: { toString: () => '0.0975' },
			},
		]);

		const token = await makeToken('Editor');
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/cost-assumptions`,
			headers: authHeader(token),
			payload: {
				assumptions: [
					{
						category: 'REMPLACEMENTS',
						calculationMode: 'PERCENT_OF_PAYROLL',
						value: '0.0975',
					},
				],
			},
		});

		expect(res.statusCode).toBe(200);
		expect(mockPrisma.versionStaffingCostAssumption.deleteMany).toHaveBeenCalledWith({
			where: { versionId: 1 },
		});
		expect(mockPrisma.budgetVersion.update).toHaveBeenCalled();
	});
});

// ── Lycee Group Assumptions ──────────────────────────────────────────────────

describe('GET /lycee-group-assumptions', () => {
	it('returns lycee group assumptions with discipline data', async () => {
		const mockAssumptions = [
			{
				id: 1,
				versionId: 1,
				gradeLevel: '2NDE',
				disciplineId: 1,
				discipline: { code: 'MATH', name: 'Mathematiques' },
				groupCount: 3,
				hoursPerGroup: { toString: () => '4.00' },
			},
		];
		mockPrisma.versionLyceeGroupAssumption.findMany.mockResolvedValue(mockAssumptions);

		const token = await makeToken('Viewer');
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/lycee-group-assumptions`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.data).toHaveLength(1);
		expect(body.data[0].disciplineCode).toBe('MATH');
		expect(body.data[0].groupCount).toBe(3);
		expect(body.data[0].hoursPerGroup).toBe('4.00');
	});
});

describe('PUT /lycee-group-assumptions', () => {
	it('replaces assumptions and marks STAFFING stale', async () => {
		mockPrisma.versionLyceeGroupAssumption.deleteMany.mockResolvedValue({ count: 0 });
		mockPrisma.versionLyceeGroupAssumption.createMany.mockResolvedValue({ count: 1 });
		mockPrisma.versionLyceeGroupAssumption.findMany.mockResolvedValue([
			{
				id: 10,
				versionId: 1,
				gradeLevel: '2NDE',
				disciplineId: 1,
				discipline: { code: 'MATH', name: 'Mathematiques' },
				groupCount: 3,
				hoursPerGroup: { toString: () => '4.00' },
			},
		]);

		const token = await makeToken('Editor');
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/lycee-group-assumptions`,
			headers: authHeader(token),
			payload: {
				assumptions: [
					{
						gradeLevel: '2NDE',
						disciplineId: 1,
						groupCount: 3,
						hoursPerGroup: '4.00',
					},
				],
			},
		});

		expect(res.statusCode).toBe(200);
		expect(mockPrisma.versionLyceeGroupAssumption.deleteMany).toHaveBeenCalledWith({
			where: { versionId: 1 },
		});
		expect(mockPrisma.budgetVersion.update).toHaveBeenCalled();
	});
});

// ── Demand Overrides ─────────────────────────────────────────────────────────

describe('GET /demand-overrides', () => {
	it('returns demand overrides with discipline data', async () => {
		const mockOverrides = [
			{
				id: 1,
				versionId: 1,
				band: 'ELEMENTAIRE',
				disciplineId: 1,
				discipline: { code: 'MATH', name: 'Mathematiques' },
				lineType: 'STRUCTURAL',
				overrideFte: { toString: () => '2.5000' },
				reasonCode: 'CURRICULUM_CHANGE',
				note: 'New programme',
			},
		];
		mockPrisma.demandOverride.findMany.mockResolvedValue(mockOverrides);

		const token = await makeToken('Viewer');
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/demand-overrides`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.data).toHaveLength(1);
		expect(body.data[0].band).toBe('ELEMENTAIRE');
		expect(body.data[0].overrideFte).toBe('2.5000');
		expect(body.data[0].reasonCode).toBe('CURRICULUM_CHANGE');
	});
});

describe('PUT /demand-overrides', () => {
	it('replaces overrides and marks STAFFING stale', async () => {
		mockPrisma.demandOverride.deleteMany.mockResolvedValue({ count: 0 });
		mockPrisma.demandOverride.createMany.mockResolvedValue({ count: 1 });
		mockPrisma.demandOverride.findMany.mockResolvedValue([
			{
				id: 10,
				versionId: 1,
				band: 'ELEMENTAIRE',
				disciplineId: 1,
				discipline: { code: 'MATH', name: 'Mathematiques' },
				lineType: 'STRUCTURAL',
				overrideFte: { toString: () => '2.5000' },
				reasonCode: 'CURRICULUM_CHANGE',
				note: null,
			},
		]);

		const token = await makeToken('Editor');
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/demand-overrides`,
			headers: authHeader(token),
			payload: {
				overrides: [
					{
						band: 'ELEMENTAIRE',
						disciplineId: 1,
						lineType: 'STRUCTURAL',
						overrideFte: '2.5000',
						reasonCode: 'CURRICULUM_CHANGE',
					},
				],
			},
		});

		expect(res.statusCode).toBe(200);
		expect(mockPrisma.demandOverride.deleteMany).toHaveBeenCalledWith({
			where: { versionId: 1 },
		});
		expect(mockPrisma.budgetVersion.update).toHaveBeenCalled();
	});
});

describe('DELETE /demand-overrides/:id', () => {
	it('deletes a demand override and marks STAFFING stale', async () => {
		mockPrisma.demandOverride.findFirst.mockResolvedValue({
			id: 5,
			versionId: 1,
			band: 'ELEMENTAIRE',
			disciplineId: 1,
			lineType: 'STRUCTURAL',
		});
		mockPrisma.demandOverride.delete.mockResolvedValue({});

		const token = await makeToken('Editor');
		const res = await app.inject({
			method: 'DELETE',
			url: `${URL_PREFIX}/demand-overrides/5`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(204);
		expect(mockPrisma.demandOverride.delete).toHaveBeenCalledWith({ where: { id: 5 } });
		expect(mockPrisma.budgetVersion.update).toHaveBeenCalled();
	});

	it('returns 404 when override does not exist', async () => {
		mockPrisma.demandOverride.findFirst.mockResolvedValue(null);

		const token = await makeToken();
		const res = await app.inject({
			method: 'DELETE',
			url: `${URL_PREFIX}/demand-overrides/999`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('DEMAND_OVERRIDE_NOT_FOUND');
	});

	it('returns 409 for non-draft versions', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue({
			...mockVersion,
			status: 'Locked',
		});

		const token = await makeToken();
		const res = await app.inject({
			method: 'DELETE',
			url: `${URL_PREFIX}/demand-overrides/5`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('VERSION_LOCKED');
	});

	it('returns 403 for Viewer role', async () => {
		const token = await makeToken('Viewer');
		const res = await app.inject({
			method: 'DELETE',
			url: `${URL_PREFIX}/demand-overrides/5`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(403);
	});
});

// ── Teaching Requirements ────────────────────────────────────────────────────

describe('GET /teaching-requirements', () => {
	it('returns teaching requirement lines', async () => {
		const mockLines = [
			{
				id: 1,
				versionId: 1,
				band: 'ELEMENTAIRE',
				disciplineCode: 'MATH',
				lineLabel: 'Mathematiques - Structural',
				lineType: 'STRUCTURAL',
				driverType: 'HOURS',
				serviceProfileCode: 'ENS1D',
				totalDriverUnits: 6,
				totalWeeklyHours: { toString: () => '30.0000' },
				baseOrs: { toString: () => '24.00' },
				effectiveOrs: { toString: () => '24.00' },
				requiredFteRaw: { toString: () => '1.2500' },
				requiredFtePlanned: { toString: () => '1.5000' },
				recommendedPositions: 2,
				coveredFte: { toString: () => '1.0000' },
				gapFte: { toString: () => '0.5000' },
				coverageStatus: 'PARTIAL',
				assignedStaffCount: 1,
				vacancyCount: 1,
				directCostAnnual: { toString: () => '120000.0000' },
				hsaCostAnnual: { toString: () => '5000.0000' },
				calculatedAt: '2026-03-17T10:00:00.000Z',
			},
		];
		mockPrisma.teachingRequirementLine.findMany.mockResolvedValue(mockLines);

		// Use Admin role to get cost fields in response
		const token = await makeToken('Admin');
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/teaching-requirements`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.lines).toHaveLength(1);
		expect(body.lines[0].band).toBe('ELEMENTAIRE');
		expect(body.lines[0].requiredFtePlanned).toBe('1.5000');
		expect(body.lines[0].coverageStatus).toBe('PARTIAL');
		expect(body.lines[0].directCostAnnual).toBe('120000.0000');
		expect(body.lines[0].hsaCostAnnual).toBe('5000.0000');
		expect(body.lines[0].assignedEmployees).toEqual([]);
	});

	it('strips cost fields for Viewer role (no salary:view)', async () => {
		const mockLines = [
			{
				id: 1,
				versionId: 1,
				band: 'ELEMENTAIRE',
				disciplineCode: 'MATH',
				lineLabel: 'Mathematiques - Structural',
				lineType: 'STRUCTURAL',
				driverType: 'HOURS',
				serviceProfileCode: 'ENS1D',
				totalDriverUnits: 6,
				totalWeeklyHours: { toString: () => '30.0000' },
				baseOrs: { toString: () => '24.00' },
				effectiveOrs: { toString: () => '24.00' },
				requiredFteRaw: { toString: () => '1.2500' },
				requiredFtePlanned: { toString: () => '1.5000' },
				recommendedPositions: 2,
				coveredFte: { toString: () => '1.0000' },
				gapFte: { toString: () => '0.5000' },
				coverageStatus: 'PARTIAL',
				assignedStaffCount: 1,
				vacancyCount: 1,
				directCostAnnual: { toString: () => '120000.0000' },
				hsaCostAnnual: { toString: () => '5000.0000' },
				calculatedAt: '2026-03-17T10:00:00.000Z',
			},
		];
		mockPrisma.teachingRequirementLine.findMany.mockResolvedValue(mockLines);

		const token = await makeToken('Viewer');
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/teaching-requirements`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.lines).toHaveLength(1);
		// Viewer lacks salary:view — cost fields should be null
		expect(body.lines[0].directCostAnnual).toBeNull();
		expect(body.lines[0].hsaCostAnnual).toBeNull();
		// Non-cost fields should still be present
		expect(body.lines[0].band).toBe('ELEMENTAIRE');
		expect(body.lines[0].requiredFtePlanned).toBe('1.5000');
	});

	it('returns 409 when STAFFING is stale', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue({
			...mockVersion,
			staleModules: ['STAFFING'],
		});

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/teaching-requirements`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('STALE_DATA');
	});
});

describe('GET /teaching-requirement-sources', () => {
	it('returns teaching requirement sources with discipline data', async () => {
		const mockSources = [
			{
				id: 1,
				versionId: 1,
				gradeLevel: 'CP',
				disciplineId: 1,
				discipline: { code: 'MATH', name: 'Mathematiques' },
				lineType: 'STRUCTURAL',
				driverType: 'HOURS',
				headcount: 25,
				maxClassSize: 28,
				driverUnits: 1,
				hoursPerUnit: { toString: () => '5.00' },
				totalWeeklyHours: { toString: () => '5.0000' },
				calculatedAt: '2026-03-17T10:00:00.000Z',
			},
		];
		mockPrisma.teachingRequirementSource.findMany.mockResolvedValue(mockSources);

		const token = await makeToken('Viewer');
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/teaching-requirement-sources`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.data).toHaveLength(1);
		expect(body.data[0].gradeLevel).toBe('CP');
		expect(body.data[0].disciplineCode).toBe('MATH');
		expect(body.data[0].headcount).toBe(25);
	});

	it('returns 409 when STAFFING is stale', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue({
			...mockVersion,
			staleModules: ['STAFFING'],
		});

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/teaching-requirement-sources`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('STALE_DATA');
	});

	it('returns 404 when version does not exist', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(null);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/teaching-requirement-sources`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('VERSION_NOT_FOUND');
	});
});

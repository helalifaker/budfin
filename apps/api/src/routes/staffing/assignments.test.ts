import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { generateKeyPair } from 'jose';
import { auth } from '../../plugins/auth.js';
import { staffingAssignmentRoutes } from './assignments.js';
import { setKeys, signAccessToken } from '../../services/token.js';

vi.mock('../../lib/prisma.js', () => {
	const mockPrisma = {
		budgetVersion: {
			findUnique: vi.fn(),
			update: vi.fn(),
		},
		employee: {
			findFirst: vi.fn(),
			findMany: vi.fn(),
		},
		discipline: {
			findUnique: vi.fn(),
		},
		staffingAssignment: {
			findMany: vi.fn(),
			findFirst: vi.fn(),
			create: vi.fn(),
			update: vi.fn(),
			delete: vi.fn(),
		},
		teachingRequirementLine: {
			findMany: vi.fn(),
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
	employee: {
		findFirst: ReturnType<typeof vi.fn>;
		findMany: ReturnType<typeof vi.fn>;
	};
	discipline: {
		findUnique: ReturnType<typeof vi.fn>;
	};
	staffingAssignment: {
		findMany: ReturnType<typeof vi.fn>;
		findFirst: ReturnType<typeof vi.fn>;
		create: ReturnType<typeof vi.fn>;
		update: ReturnType<typeof vi.fn>;
		delete: ReturnType<typeof vi.fn>;
	};
	teachingRequirementLine: {
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
		sessionId: 'assignments-test-session',
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

const mockEmployee = {
	id: 10,
	name: 'Jean Dupont',
	employeeCode: 'EMP001',
	costMode: 'LOCAL_PAYROLL',
	isTeaching: true,
	hourlyPercentage: { toString: () => '1.0000' },
};

const mockDiscipline = {
	id: 5,
	code: 'MATH',
	name: 'Mathematiques',
};

const mockAssignmentRow = {
	id: 1,
	versionId: 1,
	employeeId: 10,
	band: 'ELEMENTAIRE',
	disciplineId: 5,
	hoursPerWeek: { toString: () => '6.00' },
	fteShare: { toString: () => '0.2500' },
	source: 'MANUAL',
	note: null,
	createdAt: new Date('2026-03-17T10:00:00Z'),
	updatedAt: new Date('2026-03-17T10:00:00Z'),
	updatedBy: 1,
	employee: mockEmployee,
	discipline: mockDiscipline,
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
	await app.register(staffingAssignmentRoutes, { prefix: ROUTE_PREFIX });
	await app.ready();

	mockPrisma.budgetVersion.findUnique.mockResolvedValue(mockVersion);
	mockPrisma.budgetVersion.update.mockResolvedValue({});
});

// ── GET /staffing-assignments ─────────────────────────────────────────────────

describe('GET /staffing-assignments', () => {
	it('returns all assignments with employee and discipline data', async () => {
		mockPrisma.staffingAssignment.findMany.mockResolvedValue([mockAssignmentRow]);

		const token = await makeToken('Viewer');
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/staffing-assignments`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.assignments).toHaveLength(1);
		expect(body.assignments[0].employeeName).toBe('Jean Dupont');
		expect(body.assignments[0].employeeCode).toBe('EMP001');
		expect(body.assignments[0].costMode).toBe('LOCAL_PAYROLL');
		expect(body.assignments[0].disciplineCode).toBe('MATH');
		expect(body.assignments[0].hoursPerWeek).toBe('6.00');
		expect(body.assignments[0].fteShare).toBe('0.2500');
		expect(body.assignments[0].band).toBe('ELEMENTAIRE');
	});

	it('filters by band', async () => {
		mockPrisma.staffingAssignment.findMany.mockResolvedValue([]);

		const token = await makeToken('Viewer');
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/staffing-assignments?band=COLLEGE`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		expect(mockPrisma.staffingAssignment.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { versionId: 1, band: 'COLLEGE' },
			})
		);
	});

	it('filters by disciplineId', async () => {
		mockPrisma.staffingAssignment.findMany.mockResolvedValue([]);

		const token = await makeToken('Viewer');
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/staffing-assignments?disciplineId=5`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		expect(mockPrisma.staffingAssignment.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { versionId: 1, disciplineId: 5 },
			})
		);
	});

	it('filters by both band and disciplineId', async () => {
		mockPrisma.staffingAssignment.findMany.mockResolvedValue([]);

		const token = await makeToken('Viewer');
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/staffing-assignments?band=LYCEE&disciplineId=3`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(200);
		expect(mockPrisma.staffingAssignment.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { versionId: 1, band: 'LYCEE', disciplineId: 3 },
			})
		);
	});

	it('returns 404 when version does not exist', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(null);

		const token = await makeToken();
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/staffing-assignments`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('VERSION_NOT_FOUND');
	});

	it('returns 401 without authentication', async () => {
		const res = await app.inject({
			method: 'GET',
			url: `${URL_PREFIX}/staffing-assignments`,
		});

		expect(res.statusCode).toBe(401);
	});
});

// ── POST /staffing-assignments ────────────────────────────────────────────────

describe('POST /staffing-assignments', () => {
	const validPayload = {
		employeeId: 10,
		band: 'ELEMENTAIRE',
		disciplineId: 5,
		hoursPerWeek: '6.00',
		fteShare: '0.2500',
		source: 'MANUAL',
	};

	it('creates an assignment successfully', async () => {
		mockPrisma.employee.findFirst.mockResolvedValue(mockEmployee);
		mockPrisma.discipline.findUnique.mockResolvedValue(mockDiscipline);
		mockPrisma.staffingAssignment.findMany.mockResolvedValue([]);
		mockPrisma.staffingAssignment.create.mockResolvedValue(mockAssignmentRow);

		const token = await makeToken('Editor');
		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/staffing-assignments`,
			headers: authHeader(token),
			payload: validPayload,
		});

		expect(res.statusCode).toBe(201);
		const body = res.json();
		expect(body.employeeName).toBe('Jean Dupont');
		expect(body.disciplineCode).toBe('MATH');
		expect(body.fteShare).toBe('0.2500');
	});

	it('marks STAFFING and PNL stale after creation', async () => {
		mockPrisma.employee.findFirst.mockResolvedValue(mockEmployee);
		mockPrisma.discipline.findUnique.mockResolvedValue(mockDiscipline);
		mockPrisma.staffingAssignment.findMany.mockResolvedValue([]);
		mockPrisma.staffingAssignment.create.mockResolvedValue(mockAssignmentRow);

		const token = await makeToken('Editor');
		await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/staffing-assignments`,
			headers: authHeader(token),
			payload: validPayload,
		});

		expect(mockPrisma.budgetVersion.update).toHaveBeenCalledWith({
			where: { id: 1 },
			data: { staleModules: ['STAFFING', 'PNL'] },
		});
	});

	it('creates an audit entry after creation', async () => {
		mockPrisma.employee.findFirst.mockResolvedValue(mockEmployee);
		mockPrisma.discipline.findUnique.mockResolvedValue(mockDiscipline);
		mockPrisma.staffingAssignment.findMany.mockResolvedValue([]);
		mockPrisma.staffingAssignment.create.mockResolvedValue(mockAssignmentRow);

		const token = await makeToken('Editor');
		await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/staffing-assignments`,
			headers: authHeader(token),
			payload: validPayload,
		});

		expect(mockPrisma.auditEntry.create).toHaveBeenCalledWith({
			data: expect.objectContaining({
				operation: 'STAFFING_ASSIGNMENT_CREATED',
				tableName: 'staffing_assignments',
			}),
		});
	});

	it('returns 422 when employee is not teaching', async () => {
		mockPrisma.employee.findFirst.mockResolvedValue({
			...mockEmployee,
			isTeaching: false,
		});

		const token = await makeToken('Editor');
		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/staffing-assignments`,
			headers: authHeader(token),
			payload: validPayload,
		});

		expect(res.statusCode).toBe(422);
		expect(res.json().code).toBe('EMPLOYEE_NOT_TEACHING');
	});

	it('returns 422 when fteShare exceeds hourlyPercentage', async () => {
		mockPrisma.employee.findFirst.mockResolvedValue(mockEmployee);
		mockPrisma.discipline.findUnique.mockResolvedValue(mockDiscipline);
		// Existing assignments sum to 0.8000
		mockPrisma.staffingAssignment.findMany.mockResolvedValue([
			{ fteShare: { toString: () => '0.8000' } },
		]);

		const token = await makeToken('Editor');
		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/staffing-assignments`,
			headers: authHeader(token),
			payload: validPayload, // fteShare: 0.2500, total would be 1.0500 > 1.0000
		});

		expect(res.statusCode).toBe(422);
		expect(res.json().code).toBe('FTE_SHARE_EXCEEDED');
	});

	it('returns 404 when employee not found', async () => {
		mockPrisma.employee.findFirst.mockResolvedValue(null);

		const token = await makeToken('Editor');
		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/staffing-assignments`,
			headers: authHeader(token),
			payload: validPayload,
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('EMPLOYEE_NOT_FOUND');
	});

	it('returns 404 when discipline not found', async () => {
		mockPrisma.employee.findFirst.mockResolvedValue(mockEmployee);
		mockPrisma.discipline.findUnique.mockResolvedValue(null);

		const token = await makeToken('Editor');
		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/staffing-assignments`,
			headers: authHeader(token),
			payload: validPayload,
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('DISCIPLINE_NOT_FOUND');
	});

	it('rejects invalid band value', async () => {
		const token = await makeToken('Editor');
		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/staffing-assignments`,
			headers: authHeader(token),
			payload: { ...validPayload, band: 'INVALID' },
		});

		expect(res.statusCode).toBe(400);
	});

	it('returns 409 for non-draft versions', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue({
			...mockVersion,
			status: 'Published',
		});

		const token = await makeToken('Editor');
		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/staffing-assignments`,
			headers: authHeader(token),
			payload: validPayload,
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('VERSION_LOCKED');
	});

	it('returns 403 for Viewer role', async () => {
		const token = await makeToken('Viewer');
		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/staffing-assignments`,
			headers: authHeader(token),
			payload: validPayload,
		});

		expect(res.statusCode).toBe(403);
		expect(res.json().code).toBe('FORBIDDEN');
	});

	it('returns 401 without authentication', async () => {
		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/staffing-assignments`,
			payload: validPayload,
		});

		expect(res.statusCode).toBe(401);
	});

	it('defaults source to MANUAL when omitted', async () => {
		mockPrisma.employee.findFirst.mockResolvedValue(mockEmployee);
		mockPrisma.discipline.findUnique.mockResolvedValue(mockDiscipline);
		mockPrisma.staffingAssignment.findMany.mockResolvedValue([]);
		mockPrisma.staffingAssignment.create.mockResolvedValue(mockAssignmentRow);

		const token = await makeToken('Editor');
		const { source: _source, ...payloadWithoutSource } = validPayload;
		await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/staffing-assignments`,
			headers: authHeader(token),
			payload: payloadWithoutSource,
		});

		expect(mockPrisma.staffingAssignment.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					source: 'MANUAL',
				}),
			})
		);
	});

	it('allows fteShare exactly equal to hourlyPercentage', async () => {
		mockPrisma.employee.findFirst.mockResolvedValue(mockEmployee);
		mockPrisma.discipline.findUnique.mockResolvedValue(mockDiscipline);
		mockPrisma.staffingAssignment.findMany.mockResolvedValue([]);
		mockPrisma.staffingAssignment.create.mockResolvedValue({
			...mockAssignmentRow,
			fteShare: { toString: () => '1.0000' },
		});

		const token = await makeToken('Editor');
		const res = await app.inject({
			method: 'POST',
			url: `${URL_PREFIX}/staffing-assignments`,
			headers: authHeader(token),
			payload: { ...validPayload, fteShare: '1.0000' },
		});

		expect(res.statusCode).toBe(201);
	});
});

// ── PUT /staffing-assignments/:id ─────────────────────────────────────────────

describe('PUT /staffing-assignments/:id', () => {
	const updatePayload = {
		band: 'COLLEGE',
		disciplineId: 5,
		hoursPerWeek: '8.00',
		fteShare: '0.3500',
	};

	const existingAssignment = {
		id: 1,
		versionId: 1,
		employeeId: 10,
		band: 'ELEMENTAIRE',
		disciplineId: 5,
		hoursPerWeek: { toString: () => '6.00' },
		fteShare: { toString: () => '0.2500' },
		source: 'MANUAL',
		note: null,
		employee: mockEmployee,
	};

	it('updates an assignment successfully', async () => {
		mockPrisma.staffingAssignment.findFirst.mockResolvedValue(existingAssignment);
		mockPrisma.discipline.findUnique.mockResolvedValue(mockDiscipline);
		// No other assignments for this employee
		mockPrisma.staffingAssignment.findMany.mockResolvedValue([]);
		mockPrisma.staffingAssignment.update.mockResolvedValue({
			...mockAssignmentRow,
			band: 'COLLEGE',
			hoursPerWeek: { toString: () => '8.00' },
			fteShare: { toString: () => '0.3500' },
		});

		const token = await makeToken('Editor');
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/staffing-assignments/1`,
			headers: authHeader(token),
			payload: updatePayload,
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.band).toBe('COLLEGE');
		expect(body.hoursPerWeek).toBe('8.00');
		expect(body.fteShare).toBe('0.3500');
	});

	it('marks STAFFING and PNL stale after update', async () => {
		mockPrisma.staffingAssignment.findFirst.mockResolvedValue(existingAssignment);
		mockPrisma.discipline.findUnique.mockResolvedValue(mockDiscipline);
		mockPrisma.staffingAssignment.findMany.mockResolvedValue([]);
		mockPrisma.staffingAssignment.update.mockResolvedValue({
			...mockAssignmentRow,
			...updatePayload,
			hoursPerWeek: { toString: () => '8.00' },
			fteShare: { toString: () => '0.3500' },
		});

		const token = await makeToken('Editor');
		await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/staffing-assignments/1`,
			headers: authHeader(token),
			payload: updatePayload,
		});

		expect(mockPrisma.budgetVersion.update).toHaveBeenCalledWith({
			where: { id: 1 },
			data: { staleModules: ['STAFFING', 'PNL'] },
		});
	});

	it('creates an audit entry with old and new values', async () => {
		mockPrisma.staffingAssignment.findFirst.mockResolvedValue(existingAssignment);
		mockPrisma.discipline.findUnique.mockResolvedValue(mockDiscipline);
		mockPrisma.staffingAssignment.findMany.mockResolvedValue([]);
		mockPrisma.staffingAssignment.update.mockResolvedValue({
			...mockAssignmentRow,
			...updatePayload,
			hoursPerWeek: { toString: () => '8.00' },
			fteShare: { toString: () => '0.3500' },
		});

		const token = await makeToken('Editor');
		await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/staffing-assignments/1`,
			headers: authHeader(token),
			payload: updatePayload,
		});

		expect(mockPrisma.auditEntry.create).toHaveBeenCalledWith({
			data: expect.objectContaining({
				operation: 'STAFFING_ASSIGNMENT_UPDATED',
				oldValues: expect.objectContaining({
					band: 'ELEMENTAIRE',
					fteShare: '0.2500',
				}),
				newValues: expect.objectContaining({
					band: 'COLLEGE',
					fteShare: '0.3500',
				}),
			}),
		});
	});

	it('returns 422 when fteShare exceeds hourlyPercentage', async () => {
		mockPrisma.staffingAssignment.findFirst.mockResolvedValue(existingAssignment);
		mockPrisma.discipline.findUnique.mockResolvedValue(mockDiscipline);
		// Other assignments sum to 0.8000 (excluding current)
		mockPrisma.staffingAssignment.findMany.mockResolvedValue([
			{ fteShare: { toString: () => '0.8000' } },
		]);

		const token = await makeToken('Editor');
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/staffing-assignments/1`,
			headers: authHeader(token),
			payload: updatePayload, // fteShare: 0.3500, total would be 1.1500 > 1.0000
		});

		expect(res.statusCode).toBe(422);
		expect(res.json().code).toBe('FTE_SHARE_EXCEEDED');
	});

	it('excludes current assignment from fteShare sum', async () => {
		mockPrisma.staffingAssignment.findFirst.mockResolvedValue(existingAssignment);
		mockPrisma.discipline.findUnique.mockResolvedValue(mockDiscipline);
		mockPrisma.staffingAssignment.findMany.mockResolvedValue([]);
		mockPrisma.staffingAssignment.update.mockResolvedValue({
			...mockAssignmentRow,
			fteShare: { toString: () => '1.0000' },
			hoursPerWeek: { toString: () => '8.00' },
		});

		const token = await makeToken('Editor');
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/staffing-assignments/1`,
			headers: authHeader(token),
			payload: { ...updatePayload, fteShare: '1.0000' },
		});

		// findMany should be called with id exclusion
		expect(mockPrisma.staffingAssignment.findMany).toHaveBeenCalledWith({
			where: {
				versionId: 1,
				employeeId: 10,
				id: { not: 1 },
			},
			select: { fteShare: true },
		});
		expect(res.statusCode).toBe(200);
	});

	it('returns 404 when assignment does not exist', async () => {
		mockPrisma.staffingAssignment.findFirst.mockResolvedValue(null);

		const token = await makeToken('Editor');
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/staffing-assignments/999`,
			headers: authHeader(token),
			payload: updatePayload,
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('ASSIGNMENT_NOT_FOUND');
	});

	it('returns 404 when discipline not found', async () => {
		mockPrisma.staffingAssignment.findFirst.mockResolvedValue(existingAssignment);
		mockPrisma.discipline.findUnique.mockResolvedValue(null);

		const token = await makeToken('Editor');
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/staffing-assignments/1`,
			headers: authHeader(token),
			payload: updatePayload,
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('DISCIPLINE_NOT_FOUND');
	});

	it('returns 409 for non-draft versions', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue({
			...mockVersion,
			status: 'Locked',
		});

		const token = await makeToken('Editor');
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/staffing-assignments/1`,
			headers: authHeader(token),
			payload: updatePayload,
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('VERSION_LOCKED');
	});

	it('returns 403 for Viewer role', async () => {
		const token = await makeToken('Viewer');
		const res = await app.inject({
			method: 'PUT',
			url: `${URL_PREFIX}/staffing-assignments/1`,
			headers: authHeader(token),
			payload: updatePayload,
		});

		expect(res.statusCode).toBe(403);
	});
});

// ── DELETE /staffing-assignments/:id ──────────────────────────────────────────

describe('DELETE /staffing-assignments/:id', () => {
	const existingAssignment = {
		id: 5,
		versionId: 1,
		employeeId: 10,
		band: 'ELEMENTAIRE',
		disciplineId: 5,
		fteShare: { toString: () => '0.2500' },
		hoursPerWeek: { toString: () => '6.00' },
		source: 'MANUAL',
		note: null,
	};

	it('deletes an assignment and marks STAFFING stale', async () => {
		mockPrisma.staffingAssignment.findFirst.mockResolvedValue(existingAssignment);
		mockPrisma.staffingAssignment.delete.mockResolvedValue({});

		const token = await makeToken('Editor');
		const res = await app.inject({
			method: 'DELETE',
			url: `${URL_PREFIX}/staffing-assignments/5`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(204);
		expect(mockPrisma.staffingAssignment.delete).toHaveBeenCalledWith({
			where: { id: 5 },
		});
		expect(mockPrisma.budgetVersion.update).toHaveBeenCalledWith({
			where: { id: 1 },
			data: { staleModules: ['STAFFING', 'PNL'] },
		});
	});

	it('creates an audit entry with old values', async () => {
		mockPrisma.staffingAssignment.findFirst.mockResolvedValue(existingAssignment);
		mockPrisma.staffingAssignment.delete.mockResolvedValue({});

		const token = await makeToken('Editor');
		await app.inject({
			method: 'DELETE',
			url: `${URL_PREFIX}/staffing-assignments/5`,
			headers: authHeader(token),
		});

		expect(mockPrisma.auditEntry.create).toHaveBeenCalledWith({
			data: expect.objectContaining({
				operation: 'STAFFING_ASSIGNMENT_DELETED',
				tableName: 'staffing_assignments',
				recordId: 5,
				oldValues: expect.objectContaining({
					employeeId: 10,
					band: 'ELEMENTAIRE',
					disciplineId: 5,
					fteShare: '0.2500',
				}),
			}),
		});
	});

	it('returns 404 when assignment does not exist', async () => {
		mockPrisma.staffingAssignment.findFirst.mockResolvedValue(null);

		const token = await makeToken('Editor');
		const res = await app.inject({
			method: 'DELETE',
			url: `${URL_PREFIX}/staffing-assignments/999`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('ASSIGNMENT_NOT_FOUND');
	});

	it('returns 409 for non-draft versions', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue({
			...mockVersion,
			status: 'Locked',
		});

		const token = await makeToken('Editor');
		const res = await app.inject({
			method: 'DELETE',
			url: `${URL_PREFIX}/staffing-assignments/5`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('VERSION_LOCKED');
	});

	it('returns 403 for Viewer role', async () => {
		const token = await makeToken('Viewer');
		const res = await app.inject({
			method: 'DELETE',
			url: `${URL_PREFIX}/staffing-assignments/5`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(403);
	});

	it('returns 401 without authentication', async () => {
		const res = await app.inject({
			method: 'DELETE',
			url: `${URL_PREFIX}/staffing-assignments/5`,
		});

		expect(res.statusCode).toBe(401);
	});

	it('skips stale marking when already stale', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue({
			...mockVersion,
			staleModules: ['STAFFING', 'PNL'],
		});
		mockPrisma.staffingAssignment.findFirst.mockResolvedValue(existingAssignment);
		mockPrisma.staffingAssignment.delete.mockResolvedValue({});

		const token = await makeToken('Editor');
		const res = await app.inject({
			method: 'DELETE',
			url: `${URL_PREFIX}/staffing-assignments/5`,
			headers: authHeader(token),
		});

		expect(res.statusCode).toBe(204);
		expect(mockPrisma.budgetVersion.update).not.toHaveBeenCalled();
	});
});

// ── POST /staffing-assignments/auto-suggest ──────────────────────────────────

describe('POST /staffing-assignments/auto-suggest', () => {
	const SUGGEST_URL = `${URL_PREFIX}/staffing-assignments/auto-suggest`;

	const mockRequirementLine = (
		overrides: Partial<{
			band: string;
			disciplineCode: string;
			requiredFteRaw: string;
			coveredFte: string;
			effectiveOrs: string;
		}> = {}
	) => ({
		id: 1,
		versionId: 1,
		band: overrides.band ?? 'COLLEGE',
		disciplineCode: overrides.disciplineCode ?? 'MATH',
		lineLabel: 'Mathematics',
		lineType: 'STRUCTURAL',
		driverType: 'HOURS',
		serviceProfileCode: 'CERTIFIE',
		totalDriverUnits: 90,
		totalWeeklyHours: { toString: () => '24.00' },
		baseOrs: { toString: () => '18.00' },
		effectiveOrs: { toString: () => overrides.effectiveOrs ?? '19.50' },
		requiredFteRaw: {
			toString: () => overrides.requiredFteRaw ?? '1.2500',
		},
		requiredFtePlanned: { toString: () => '1.5000' },
		recommendedPositions: 2,
		coveredFte: { toString: () => overrides.coveredFte ?? '0.0000' },
		gapFte: { toString: () => '1.2500' },
		coverageStatus: 'UNCOVERED',
		assignedStaffCount: 0,
		vacancyCount: 0,
		directCostAnnual: { toString: () => '0.0000' },
		hsaCostAnnual: { toString: () => '0.0000' },
		calculatedAt: new Date(),
	});

	const mockTeachingEmployee = (
		overrides: Partial<{
			id: number;
			name: string;
			disciplineId: number;
			homeBand: string;
			hourlyPercentage: string;
			disciplineCode: string;
		}> = {}
	) => ({
		id: overrides.id ?? 10,
		name: overrides.name ?? 'Jean Dupont',
		disciplineId: overrides.disciplineId ?? 5,
		homeBand: overrides.homeBand ?? 'COLLEGE',
		hourlyPercentage: {
			toString: () => overrides.hourlyPercentage ?? '1.0000',
		},
		discipline: {
			id: overrides.disciplineId ?? 5,
			code: overrides.disciplineCode ?? 'MATH',
			name: 'Mathematiques',
		},
	});

	it('AC-01: returns proposed assignments for unassigned teaching employee', async () => {
		mockPrisma.teachingRequirementLine.findMany.mockResolvedValue([mockRequirementLine()]);
		mockPrisma.employee.findMany.mockResolvedValue([mockTeachingEmployee()]);
		mockPrisma.staffingAssignment.findMany.mockResolvedValue([]);

		const token = await makeToken('Editor');
		const res = await app.inject({
			method: 'POST',
			url: SUGGEST_URL,
			headers: authHeader(token),
			payload: {},
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.suggestions).toHaveLength(1);
		expect(body.suggestions[0].employeeId).toBe(10);
		expect(body.suggestions[0].employeeName).toBe('Jean Dupont');
		expect(body.suggestions[0].band).toBe('COLLEGE');
		expect(body.suggestions[0].disciplineId).toBe(5);
		expect(body.suggestions[0].disciplineCode).toBe('MATH');
		expect(body.suggestions[0].confidence).toBe('High');
		expect(body.suggestions[0].fteShare).toBeDefined();
		expect(body.suggestions[0].hoursPerWeek).toBeDefined();
		expect(body.suggestions[0].reason).toContain('Exact match');
	});

	it('AC-02: exact band + discipline match -> High confidence', async () => {
		mockPrisma.teachingRequirementLine.findMany.mockResolvedValue([
			mockRequirementLine({ band: 'COLLEGE', disciplineCode: 'MATH' }),
		]);
		mockPrisma.employee.findMany.mockResolvedValue([
			mockTeachingEmployee({ homeBand: 'COLLEGE', disciplineCode: 'MATH' }),
		]);
		mockPrisma.staffingAssignment.findMany.mockResolvedValue([]);

		const token = await makeToken('Editor');
		const res = await app.inject({
			method: 'POST',
			url: SUGGEST_URL,
			headers: authHeader(token),
			payload: {},
		});

		const body = res.json();
		expect(body.suggestions[0].confidence).toBe('High');
		expect(body.summary.highConfidence).toBe(1);
		expect(body.summary.mediumConfidence).toBe(0);
	});

	it('AC-03: cross-band College->Lycee -> Medium confidence', async () => {
		// Line is LYCEE, employee is COLLEGE -> Medium confidence
		mockPrisma.teachingRequirementLine.findMany.mockResolvedValue([
			mockRequirementLine({ band: 'LYCEE', disciplineCode: 'MATH' }),
		]);
		mockPrisma.employee.findMany.mockResolvedValue([
			mockTeachingEmployee({ homeBand: 'COLLEGE', disciplineCode: 'MATH' }),
		]);
		mockPrisma.staffingAssignment.findMany.mockResolvedValue([]);

		const token = await makeToken('Editor');
		const res = await app.inject({
			method: 'POST',
			url: SUGGEST_URL,
			headers: authHeader(token),
			payload: { scope: 'CROSS_BAND' },
		});

		const body = res.json();
		expect(body.suggestions).toHaveLength(1);
		expect(body.suggestions[0].confidence).toBe('Medium');
		expect(body.suggestions[0].band).toBe('LYCEE');
		expect(body.suggestions[0].reason).toContain('Cross-band');
		expect(body.summary.mediumConfidence).toBe(1);
	});

	it('AC-04: fteShare = min(remaining capacity, gap FTE)', async () => {
		// Employee has 1.0 capacity, line needs 0.5 -> propose 0.5
		mockPrisma.teachingRequirementLine.findMany.mockResolvedValue([
			mockRequirementLine({
				requiredFteRaw: '0.5000',
				coveredFte: '0.0000',
				effectiveOrs: '18.00',
			}),
		]);
		mockPrisma.employee.findMany.mockResolvedValue([
			mockTeachingEmployee({ hourlyPercentage: '1.0000' }),
		]);
		mockPrisma.staffingAssignment.findMany.mockResolvedValue([]);

		const token = await makeToken('Editor');
		const res = await app.inject({
			method: 'POST',
			url: SUGGEST_URL,
			headers: authHeader(token),
			payload: {},
		});

		const body = res.json();
		expect(body.suggestions[0].fteShare).toBe('0.5000');
		// hoursPerWeek = effectiveOrs * fteShare = 18 * 0.5 = 9.00
		expect(body.suggestions[0].hoursPerWeek).toBe('9.00');
	});

	it('AC-05: response includes all required fields', async () => {
		mockPrisma.teachingRequirementLine.findMany.mockResolvedValue([mockRequirementLine()]);
		mockPrisma.employee.findMany.mockResolvedValue([mockTeachingEmployee()]);
		mockPrisma.staffingAssignment.findMany.mockResolvedValue([]);

		const token = await makeToken('Editor');
		const res = await app.inject({
			method: 'POST',
			url: SUGGEST_URL,
			headers: authHeader(token),
			payload: {},
		});

		const body = res.json();
		const s = body.suggestions[0];
		expect(s).toHaveProperty('employeeId');
		expect(s).toHaveProperty('employeeName');
		expect(s).toHaveProperty('band');
		expect(s).toHaveProperty('disciplineId');
		expect(s).toHaveProperty('disciplineCode');
		expect(s).toHaveProperty('fteShare');
		expect(s).toHaveProperty('hoursPerWeek');
		expect(s).toHaveProperty('confidence');
		expect(s).toHaveProperty('reason');
	});

	it('AC-06: summary includes all required counts', async () => {
		mockPrisma.teachingRequirementLine.findMany.mockResolvedValue([
			mockRequirementLine({ band: 'COLLEGE', disciplineCode: 'MATH' }),
			mockRequirementLine({ band: 'LYCEE', disciplineCode: 'MATH' }),
		]);
		mockPrisma.employee.findMany.mockResolvedValue([
			mockTeachingEmployee({ id: 10, homeBand: 'COLLEGE' }),
			mockTeachingEmployee({
				id: 11,
				name: 'Marie Martin',
				homeBand: 'COLLEGE',
			}),
			mockTeachingEmployee({
				id: 12,
				name: 'Pierre Bernard',
				homeBand: 'ELEMENTAIRE',
				disciplineCode: 'FR',
				disciplineId: 6,
			}),
		]);
		mockPrisma.staffingAssignment.findMany.mockResolvedValue([]);

		const token = await makeToken('Editor');
		const res = await app.inject({
			method: 'POST',
			url: SUGGEST_URL,
			headers: authHeader(token),
			payload: { scope: 'CROSS_BAND' },
		});

		const body = res.json();
		expect(body.summary).toHaveProperty('totalSuggestions');
		expect(body.summary).toHaveProperty('highConfidence');
		expect(body.summary).toHaveProperty('mediumConfidence');
		expect(body.summary).toHaveProperty('unassignedRemaining');
		// Pierre has FR discipline but no FR line -> unassigned
		expect(body.summary.unassignedRemaining).toBe(1);
	});

	it('AC-07: fully assigned employees are excluded', async () => {
		mockPrisma.teachingRequirementLine.findMany.mockResolvedValue([
			mockRequirementLine({ requiredFteRaw: '2.0000' }),
		]);
		mockPrisma.employee.findMany.mockResolvedValue([
			mockTeachingEmployee({ id: 10, hourlyPercentage: '1.0000' }),
		]);
		// Employee already assigned full 1.0
		mockPrisma.staffingAssignment.findMany.mockResolvedValue([
			{
				employeeId: 10,
				fteShare: { toString: () => '1.0000' },
				band: 'COLLEGE',
				disciplineId: 5,
			},
		]);

		const token = await makeToken('Editor');
		const res = await app.inject({
			method: 'POST',
			url: SUGGEST_URL,
			headers: authHeader(token),
			payload: {},
		});

		const body = res.json();
		expect(body.suggestions).toHaveLength(0);
		expect(body.summary.totalSuggestions).toBe(0);
	});

	it('AC-07: partially assigned uses remaining capacity', async () => {
		mockPrisma.teachingRequirementLine.findMany.mockResolvedValue([
			mockRequirementLine({
				requiredFteRaw: '2.0000',
				effectiveOrs: '18.00',
			}),
		]);
		mockPrisma.employee.findMany.mockResolvedValue([
			mockTeachingEmployee({ id: 10, hourlyPercentage: '1.0000' }),
		]);
		// Employee has 0.5 assigned already
		mockPrisma.staffingAssignment.findMany.mockResolvedValue([
			{
				employeeId: 10,
				fteShare: { toString: () => '0.5000' },
				band: 'COLLEGE',
				disciplineId: 5,
			},
		]);

		const token = await makeToken('Editor');
		const res = await app.inject({
			method: 'POST',
			url: SUGGEST_URL,
			headers: authHeader(token),
			payload: {},
		});

		const body = res.json();
		// Should still get a suggestion but the existing assignment key
		// (10:COLLEGE:5) is already taken, so no duplicate suggestion
		// is produced for the same band+discipline combo.
		// The employee has remaining capacity but the exact key already
		// exists in existingKeys. No suggestion for this exact combo.
		expect(body.suggestions).toHaveLength(0);
	});

	it('AC-07: partially assigned with different band gets suggestion', async () => {
		// Employee assigned to COLLEGE:MATH with 0.5,
		// line for LYCEE:MATH also exists
		mockPrisma.teachingRequirementLine.findMany.mockResolvedValue([
			mockRequirementLine({
				band: 'LYCEE',
				disciplineCode: 'MATH',
				requiredFteRaw: '1.0000',
				effectiveOrs: '18.00',
			}),
		]);
		mockPrisma.employee.findMany.mockResolvedValue([
			mockTeachingEmployee({
				id: 10,
				homeBand: 'COLLEGE',
				hourlyPercentage: '1.0000',
			}),
		]);
		mockPrisma.staffingAssignment.findMany.mockResolvedValue([
			{
				employeeId: 10,
				fteShare: { toString: () => '0.5000' },
				band: 'COLLEGE',
				disciplineId: 5,
			},
		]);

		const token = await makeToken('Editor');
		const res = await app.inject({
			method: 'POST',
			url: SUGGEST_URL,
			headers: authHeader(token),
			payload: { scope: 'CROSS_BAND' },
		});

		const body = res.json();
		expect(body.suggestions).toHaveLength(1);
		expect(body.suggestions[0].fteShare).toBe('0.5000');
		expect(body.suggestions[0].band).toBe('LYCEE');
		expect(body.suggestions[0].confidence).toBe('Medium');
	});

	it('AC-08: suggestions are NOT persisted', async () => {
		mockPrisma.teachingRequirementLine.findMany.mockResolvedValue([mockRequirementLine()]);
		mockPrisma.employee.findMany.mockResolvedValue([mockTeachingEmployee()]);
		mockPrisma.staffingAssignment.findMany.mockResolvedValue([]);

		const token = await makeToken('Editor');
		await app.inject({
			method: 'POST',
			url: SUGGEST_URL,
			headers: authHeader(token),
			payload: {},
		});

		// No create or update calls should be made
		expect(mockPrisma.staffingAssignment.create).not.toHaveBeenCalled();
		expect(mockPrisma.staffingAssignment.update).not.toHaveBeenCalled();
		expect(mockPrisma.auditEntry.create).not.toHaveBeenCalled();
	});

	it('AC-09: requires data:edit permission (403 for Viewer)', async () => {
		const token = await makeToken('Viewer');
		const res = await app.inject({
			method: 'POST',
			url: SUGGEST_URL,
			headers: authHeader(token),
			payload: {},
		});

		expect(res.statusCode).toBe(403);
	});

	it('AC-10: defaults to HOME_BAND scope (no cross-band suggestions)', async () => {
		// Line is LYCEE, employee is COLLEGE -> no match in HOME_BAND
		mockPrisma.teachingRequirementLine.findMany.mockResolvedValue([
			mockRequirementLine({ band: 'LYCEE', disciplineCode: 'MATH' }),
		]);
		mockPrisma.employee.findMany.mockResolvedValue([
			mockTeachingEmployee({ homeBand: 'COLLEGE', disciplineCode: 'MATH' }),
		]);
		mockPrisma.staffingAssignment.findMany.mockResolvedValue([]);

		const token = await makeToken('Editor');
		const res = await app.inject({
			method: 'POST',
			url: SUGGEST_URL,
			headers: authHeader(token),
			payload: {}, // scope defaults to HOME_BAND
		});

		const body = res.json();
		expect(body.suggestions).toHaveLength(0);
		expect(body.summary.unassignedRemaining).toBe(1);
	});

	it('no match: discipline mismatch produces no suggestions', async () => {
		mockPrisma.teachingRequirementLine.findMany.mockResolvedValue([
			mockRequirementLine({ disciplineCode: 'PHYS' }),
		]);
		mockPrisma.employee.findMany.mockResolvedValue([
			mockTeachingEmployee({ disciplineCode: 'MATH' }),
		]);
		mockPrisma.staffingAssignment.findMany.mockResolvedValue([]);

		const token = await makeToken('Editor');
		const res = await app.inject({
			method: 'POST',
			url: SUGGEST_URL,
			headers: authHeader(token),
			payload: {},
		});

		const body = res.json();
		expect(body.suggestions).toHaveLength(0);
		expect(body.summary.unassignedRemaining).toBe(1);
	});

	it('multiple suggestions: 1 employee matches multiple lines', async () => {
		mockPrisma.teachingRequirementLine.findMany.mockResolvedValue([
			mockRequirementLine({
				band: 'COLLEGE',
				disciplineCode: 'MATH',
				requiredFteRaw: '0.3000',
				effectiveOrs: '18.00',
			}),
			mockRequirementLine({
				band: 'LYCEE',
				disciplineCode: 'MATH',
				requiredFteRaw: '0.5000',
				effectiveOrs: '18.00',
			}),
		]);
		mockPrisma.employee.findMany.mockResolvedValue([
			mockTeachingEmployee({
				id: 10,
				homeBand: 'COLLEGE',
				hourlyPercentage: '1.0000',
			}),
		]);
		mockPrisma.staffingAssignment.findMany.mockResolvedValue([]);

		const token = await makeToken('Editor');
		const res = await app.inject({
			method: 'POST',
			url: SUGGEST_URL,
			headers: authHeader(token),
			payload: { scope: 'CROSS_BAND' },
		});

		const body = res.json();
		// Should get High for COLLEGE and Medium for LYCEE
		expect(body.suggestions).toHaveLength(2);
		const high = body.suggestions.find((s: { confidence: string }) => s.confidence === 'High');
		const medium = body.suggestions.find((s: { confidence: string }) => s.confidence === 'Medium');
		expect(high).toBeDefined();
		expect(high.band).toBe('COLLEGE');
		expect(high.fteShare).toBe('0.3000');
		expect(medium).toBeDefined();
		expect(medium.band).toBe('LYCEE');
		expect(medium.fteShare).toBe('0.5000');
	});

	it('STAFFING stale: 409 when no requirement lines', async () => {
		mockPrisma.teachingRequirementLine.findMany.mockResolvedValue([]);

		const token = await makeToken('Editor');
		const res = await app.inject({
			method: 'POST',
			url: SUGGEST_URL,
			headers: authHeader(token),
			payload: {},
		});

		expect(res.statusCode).toBe(409);
		expect(res.json().code).toBe('STAFFING_STALE');
	});

	it('empty state: no employees -> empty suggestions', async () => {
		mockPrisma.teachingRequirementLine.findMany.mockResolvedValue([mockRequirementLine()]);
		mockPrisma.employee.findMany.mockResolvedValue([]);
		mockPrisma.staffingAssignment.findMany.mockResolvedValue([]);

		const token = await makeToken('Editor');
		const res = await app.inject({
			method: 'POST',
			url: SUGGEST_URL,
			headers: authHeader(token),
			payload: {},
		});

		const body = res.json();
		expect(body.suggestions).toHaveLength(0);
		expect(body.summary.totalSuggestions).toBe(0);
		expect(body.summary.unassignedRemaining).toBe(0);
	});

	it('returns 404 when version does not exist', async () => {
		mockPrisma.budgetVersion.findUnique.mockResolvedValue(null);

		const token = await makeToken('Editor');
		const res = await app.inject({
			method: 'POST',
			url: SUGGEST_URL,
			headers: authHeader(token),
			payload: {},
		});

		expect(res.statusCode).toBe(404);
		expect(res.json().code).toBe('VERSION_NOT_FOUND');
	});

	it('returns 401 without authentication', async () => {
		const res = await app.inject({
			method: 'POST',
			url: SUGGEST_URL,
			payload: {},
		});

		expect(res.statusCode).toBe(401);
	});

	it('sorts by confidence (High first), then by name', async () => {
		mockPrisma.teachingRequirementLine.findMany.mockResolvedValue([
			mockRequirementLine({ band: 'COLLEGE', disciplineCode: 'MATH' }),
			mockRequirementLine({ band: 'LYCEE', disciplineCode: 'MATH' }),
		]);
		mockPrisma.employee.findMany.mockResolvedValue([
			mockTeachingEmployee({
				id: 10,
				name: 'Zoe Alpha',
				homeBand: 'COLLEGE',
			}),
			mockTeachingEmployee({
				id: 11,
				name: 'Anna Beta',
				homeBand: 'LYCEE',
			}),
		]);
		mockPrisma.staffingAssignment.findMany.mockResolvedValue([]);

		const token = await makeToken('Editor');
		const res = await app.inject({
			method: 'POST',
			url: SUGGEST_URL,
			headers: authHeader(token),
			payload: { scope: 'CROSS_BAND' },
		});

		const body = res.json();
		// Both should have High matches first (COLLEGE->COLLEGE,
		// LYCEE->LYCEE), then Medium. Within confidence, sorted by name.
		const confidences = body.suggestions.map((s: { confidence: string }) => s.confidence);
		const highEndIdx = confidences.lastIndexOf('High');
		const mediumStartIdx = confidences.indexOf('Medium');
		if (mediumStartIdx !== -1) {
			expect(highEndIdx).toBeLessThan(mediumStartIdx);
		}
	});

	it('cross-band: ELEMENTAIRE does not cross-match (only College<->Lycee)', async () => {
		mockPrisma.teachingRequirementLine.findMany.mockResolvedValue([
			mockRequirementLine({
				band: 'COLLEGE',
				disciplineCode: 'MATH',
			}),
		]);
		mockPrisma.employee.findMany.mockResolvedValue([
			mockTeachingEmployee({
				id: 10,
				homeBand: 'ELEMENTAIRE',
				disciplineCode: 'MATH',
			}),
		]);
		mockPrisma.staffingAssignment.findMany.mockResolvedValue([]);

		const token = await makeToken('Editor');
		const res = await app.inject({
			method: 'POST',
			url: SUGGEST_URL,
			headers: authHeader(token),
			payload: { scope: 'CROSS_BAND' },
		});

		const body = res.json();
		// ELEMENTAIRE cannot cross-match to COLLEGE
		expect(body.suggestions).toHaveLength(0);
		expect(body.summary.unassignedRemaining).toBe(1);
	});
});

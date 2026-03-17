import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { prisma } from '../../lib/prisma.js';

// ── Schemas ──────────────────────────────────────────────────────────────────

const VALID_BANDS = ['MATERNELLE', 'ELEMENTAIRE', 'COLLEGE', 'LYCEE'] as const;
const VALID_SOURCES = ['MANUAL', 'AUTO_SUGGESTED', 'IMPORTED'] as const;

const versionIdParams = z.object({
	versionId: z.coerce.number().int().positive(),
});

const assignmentIdParams = z.object({
	versionId: z.coerce.number().int().positive(),
	id: z.coerce.number().int().positive(),
});

const assignmentListQuery = z.object({
	band: z.enum(VALID_BANDS).optional(),
	disciplineId: z.coerce.number().int().positive().optional(),
});

const assignmentBody = z.object({
	employeeId: z.number().int().positive(),
	band: z.enum(VALID_BANDS),
	disciplineId: z.number().int().positive(),
	hoursPerWeek: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Must be a decimal with up to 2 places'),
	fteShare: z.string().regex(/^\d+(\.\d{1,4})?$/, 'Must be a decimal with up to 4 places'),
	source: z.enum(VALID_SOURCES).default('MANUAL'),
	note: z.string().max(1000).nullable().optional(),
});

const assignmentUpdateBody = z.object({
	band: z.enum(VALID_BANDS),
	disciplineId: z.number().int().positive(),
	hoursPerWeek: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Must be a decimal with up to 2 places'),
	fteShare: z.string().regex(/^\d+(\.\d{1,4})?$/, 'Must be a decimal with up to 4 places'),
	source: z.enum(VALID_SOURCES).optional(),
	note: z.string().max(1000).nullable().optional(),
});

// ── Helpers ──────────────────────────────────────────────────────────────────

const STAFFING_STALE_MODULES = ['STAFFING', 'PNL'] as const;

async function markStaffingStale(
	tx: typeof prisma,
	versionId: number,
	currentStaleModules: string[]
): Promise<void> {
	const staleSet = new Set(currentStaleModules);
	let changed = false;
	for (const mod of STAFFING_STALE_MODULES) {
		if (!staleSet.has(mod)) {
			staleSet.add(mod);
			changed = true;
		}
	}
	if (!changed) return;

	await tx.budgetVersion.update({
		where: { id: versionId },
		data: { staleModules: [...staleSet] },
	});
}

async function getVersionOrFail(
	versionId: number,
	reply: { status: (code: number) => { send: (body: unknown) => unknown } }
): Promise<
	| {
			id: number;
			status: string;
			staleModules: string[];
			fiscalYear: number;
	  }
	| undefined
> {
	const version = await prisma.budgetVersion.findUnique({
		where: { id: versionId },
	});

	if (!version) {
		reply.status(404).send({
			code: 'VERSION_NOT_FOUND',
			message: `Version ${versionId} not found`,
		});
		return undefined;
	}

	return version;
}

function isDraft(
	version: { status: string },
	reply: { status: (code: number) => { send: (body: unknown) => unknown } }
): boolean {
	if (version.status !== 'Draft') {
		reply.status(409).send({
			code: 'VERSION_LOCKED',
			message: `Version is ${version.status} and cannot be modified`,
		});
		return false;
	}
	return true;
}

interface AssignmentRow {
	id: number;
	versionId: number;
	employeeId: number;
	band: string;
	disciplineId: number;
	hoursPerWeek: { toString(): string };
	fteShare: { toString(): string };
	source: string;
	note: string | null;
	createdAt: Date;
	updatedAt: Date;
	updatedBy: number | null;
	employee: {
		id: number;
		name: string;
		employeeCode: string;
		costMode: string;
		isTeaching: boolean;
		hourlyPercentage: { toString(): string };
	};
	discipline: {
		id: number;
		code: string;
		name: string;
	};
}

function formatAssignment(row: AssignmentRow) {
	return {
		id: row.id,
		versionId: row.versionId,
		employeeId: row.employeeId,
		band: row.band,
		disciplineId: row.disciplineId,
		hoursPerWeek: row.hoursPerWeek.toString(),
		fteShare: row.fteShare.toString(),
		source: row.source,
		note: row.note,
		employeeName: row.employee.name,
		employeeCode: row.employee.employeeCode,
		costMode: row.employee.costMode,
		disciplineCode: row.discipline.code,
		disciplineName: row.discipline.name,
		updatedAt: row.updatedAt,
	};
}

/**
 * Validates that the employee's total fteShare (including this new/updated
 * assignment) does not exceed the employee's hourlyPercentage.
 * Returns an error message string if invalid, or null if valid.
 */
async function validateFteShareLimit(
	versionId: number,
	employeeId: number,
	newFteShare: Decimal,
	hourlyPercentage: Decimal,
	excludeAssignmentId?: number
): Promise<string | null> {
	const existing = await prisma.staffingAssignment.findMany({
		where: {
			versionId,
			employeeId,
			...(excludeAssignmentId ? { id: { not: excludeAssignmentId } } : {}),
		},
		select: { fteShare: true },
	});

	let totalFte = new Decimal(0);
	for (const row of existing) {
		totalFte = totalFte.plus(new Decimal(row.fteShare.toString()));
	}
	totalFte = totalFte.plus(newFteShare);

	if (totalFte.greaterThan(hourlyPercentage)) {
		return (
			`Total fteShare ${totalFte.toFixed(4)} would exceed ` +
			`employee hourlyPercentage ${hourlyPercentage.toFixed(4)}`
		);
	}
	return null;
}

// ── Routes ───────────────────────────────────────────────────────────────────

export async function staffingAssignmentRoutes(app: FastifyInstance) {
	// GET /staffing-assignments — list with optional band/disciplineId filters
	app.get('/staffing-assignments', {
		schema: {
			params: versionIdParams,
			querystring: assignmentListQuery,
		},
		preHandler: [app.authenticate],
		handler: async (request, reply) => {
			const { versionId } = request.params as z.infer<typeof versionIdParams>;
			const { band, disciplineId } = request.query as z.infer<typeof assignmentListQuery>;

			const version = await getVersionOrFail(versionId, reply);
			if (!version) return;

			const where: Record<string, unknown> = { versionId };
			if (band) where.band = band;
			if (disciplineId) where.disciplineId = disciplineId;

			const assignments = await prisma.staffingAssignment.findMany({
				where,
				include: {
					employee: {
						select: {
							id: true,
							name: true,
							employeeCode: true,
							costMode: true,
							isTeaching: true,
							hourlyPercentage: true,
						},
					},
					discipline: {
						select: {
							id: true,
							code: true,
							name: true,
						},
					},
				},
				orderBy: [{ band: 'asc' }, { discipline: { code: 'asc' } }, { employee: { name: 'asc' } }],
			});

			return {
				assignments: (assignments as AssignmentRow[]).map(formatAssignment),
			};
		},
	});

	// POST /staffing-assignments — create with validation
	app.post('/staffing-assignments', {
		schema: {
			params: versionIdParams,
			body: assignmentBody,
		},
		preHandler: [app.authenticate, app.requirePermission('data:edit')],
		handler: async (request, reply) => {
			const { versionId } = request.params as z.infer<typeof versionIdParams>;
			const body = request.body as z.infer<typeof assignmentBody>;

			const version = await getVersionOrFail(versionId, reply);
			if (!version) return;
			if (!isDraft(version, reply)) return;

			// Validate employee exists and is teaching
			const employee = await prisma.employee.findFirst({
				where: { id: body.employeeId, versionId },
				select: {
					id: true,
					isTeaching: true,
					hourlyPercentage: true,
					name: true,
					employeeCode: true,
					costMode: true,
				},
			});

			if (!employee) {
				return reply.status(404).send({
					code: 'EMPLOYEE_NOT_FOUND',
					message: `Employee ${body.employeeId} not found in version ${versionId}`,
				});
			}

			if (!employee.isTeaching) {
				return reply.status(422).send({
					code: 'EMPLOYEE_NOT_TEACHING',
					message: `Employee ${employee.name} is not a teaching staff member`,
				});
			}

			// Validate discipline exists
			const discipline = await prisma.discipline.findUnique({
				where: { id: body.disciplineId },
				select: { id: true, code: true, name: true },
			});

			if (!discipline) {
				return reply.status(404).send({
					code: 'DISCIPLINE_NOT_FOUND',
					message: `Discipline ${body.disciplineId} not found`,
				});
			}

			// Validate fteShare does not exceed hourlyPercentage
			const newFte = new Decimal(body.fteShare);
			const hourlyPct = new Decimal(employee.hourlyPercentage.toString());
			const fteError = await validateFteShareLimit(versionId, body.employeeId, newFte, hourlyPct);

			if (fteError) {
				return reply.status(422).send({
					code: 'FTE_SHARE_EXCEEDED',
					message: fteError,
				});
			}

			// Create in transaction with stale marking + audit
			const created = await prisma.$transaction(async (tx) => {
				const txPrisma = tx as typeof prisma;

				const assignment = await txPrisma.staffingAssignment.create({
					data: {
						versionId,
						employeeId: body.employeeId,
						band: body.band,
						disciplineId: body.disciplineId,
						hoursPerWeek: body.hoursPerWeek,
						fteShare: body.fteShare,
						source: body.source,
						note: body.note ?? null,
						updatedBy: request.user.id,
					},
					include: {
						employee: {
							select: {
								id: true,
								name: true,
								employeeCode: true,
								costMode: true,
								isTeaching: true,
								hourlyPercentage: true,
							},
						},
						discipline: {
							select: {
								id: true,
								code: true,
								name: true,
							},
						},
					},
				});

				await markStaffingStale(txPrisma, versionId, version.staleModules);

				await txPrisma.auditEntry.create({
					data: {
						userId: request.user.id,
						userEmail: request.user.email,
						operation: 'STAFFING_ASSIGNMENT_CREATED',
						tableName: 'staffing_assignments',
						recordId: assignment.id,
						ipAddress: request.ip,
						newValues: {
							employeeId: body.employeeId,
							band: body.band,
							disciplineId: body.disciplineId,
							fteShare: body.fteShare,
							hoursPerWeek: body.hoursPerWeek,
						} as unknown as Prisma.InputJsonValue,
					},
				});

				return assignment;
			});

			return reply.status(201).send(formatAssignment(created as unknown as AssignmentRow));
		},
	});

	// PUT /staffing-assignments/:id — update with validation
	app.put('/staffing-assignments/:id', {
		schema: {
			params: assignmentIdParams,
			body: assignmentUpdateBody,
		},
		preHandler: [app.authenticate, app.requirePermission('data:edit')],
		handler: async (request, reply) => {
			const { versionId, id } = request.params as z.infer<typeof assignmentIdParams>;
			const body = request.body as z.infer<typeof assignmentUpdateBody>;

			const version = await getVersionOrFail(versionId, reply);
			if (!version) return;
			if (!isDraft(version, reply)) return;

			// Find existing assignment
			const existing = await prisma.staffingAssignment.findFirst({
				where: { id, versionId },
				include: {
					employee: {
						select: {
							id: true,
							isTeaching: true,
							hourlyPercentage: true,
							name: true,
							employeeCode: true,
							costMode: true,
						},
					},
				},
			});

			if (!existing) {
				return reply.status(404).send({
					code: 'ASSIGNMENT_NOT_FOUND',
					message: `Assignment ${id} not found in version ${versionId}`,
				});
			}

			// Validate discipline exists
			const discipline = await prisma.discipline.findUnique({
				where: { id: body.disciplineId },
				select: { id: true, code: true, name: true },
			});

			if (!discipline) {
				return reply.status(404).send({
					code: 'DISCIPLINE_NOT_FOUND',
					message: `Discipline ${body.disciplineId} not found`,
				});
			}

			// Validate fteShare does not exceed hourlyPercentage
			// Exclude current assignment from the sum
			const newFte = new Decimal(body.fteShare);
			const hourlyPct = new Decimal(existing.employee.hourlyPercentage.toString());
			const fteError = await validateFteShareLimit(
				versionId,
				existing.employeeId,
				newFte,
				hourlyPct,
				id
			);

			if (fteError) {
				return reply.status(422).send({
					code: 'FTE_SHARE_EXCEEDED',
					message: fteError,
				});
			}

			// Update in transaction with stale marking + audit
			const updated = await prisma.$transaction(async (tx) => {
				const txPrisma = tx as typeof prisma;

				const updateData: Record<string, unknown> = {
					band: body.band,
					disciplineId: body.disciplineId,
					hoursPerWeek: body.hoursPerWeek,
					fteShare: body.fteShare,
					note: body.note ?? existing.note,
					updatedBy: request.user.id,
				};
				if (body.source !== undefined) {
					updateData.source = body.source;
				}

				const assignment = await txPrisma.staffingAssignment.update({
					where: { id },
					data: updateData,
					include: {
						employee: {
							select: {
								id: true,
								name: true,
								employeeCode: true,
								costMode: true,
								isTeaching: true,
								hourlyPercentage: true,
							},
						},
						discipline: {
							select: {
								id: true,
								code: true,
								name: true,
							},
						},
					},
				});

				await markStaffingStale(txPrisma, versionId, version.staleModules);

				await txPrisma.auditEntry.create({
					data: {
						userId: request.user.id,
						userEmail: request.user.email,
						operation: 'STAFFING_ASSIGNMENT_UPDATED',
						tableName: 'staffing_assignments',
						recordId: id,
						ipAddress: request.ip,
						oldValues: {
							band: existing.band,
							disciplineId: existing.disciplineId,
							fteShare: existing.fteShare.toString(),
							hoursPerWeek: existing.hoursPerWeek.toString(),
						} as unknown as Prisma.InputJsonValue,
						newValues: {
							band: body.band,
							disciplineId: body.disciplineId,
							fteShare: body.fteShare,
							hoursPerWeek: body.hoursPerWeek,
						} as unknown as Prisma.InputJsonValue,
					},
				});

				return assignment;
			});

			return formatAssignment(updated as unknown as AssignmentRow);
		},
	});

	// DELETE /staffing-assignments/:id — remove assignment
	app.delete('/staffing-assignments/:id', {
		schema: { params: assignmentIdParams },
		preHandler: [app.authenticate, app.requirePermission('data:edit')],
		handler: async (request, reply) => {
			const { versionId, id } = request.params as z.infer<typeof assignmentIdParams>;

			const version = await getVersionOrFail(versionId, reply);
			if (!version) return;
			if (!isDraft(version, reply)) return;

			const existing = await prisma.staffingAssignment.findFirst({
				where: { id, versionId },
			});

			if (!existing) {
				return reply.status(404).send({
					code: 'ASSIGNMENT_NOT_FOUND',
					message: `Assignment ${id} not found in version ${versionId}`,
				});
			}

			await prisma.$transaction(async (tx) => {
				const txPrisma = tx as typeof prisma;

				await txPrisma.staffingAssignment.delete({ where: { id } });

				await markStaffingStale(txPrisma, versionId, version.staleModules);

				await txPrisma.auditEntry.create({
					data: {
						userId: request.user.id,
						userEmail: request.user.email,
						operation: 'STAFFING_ASSIGNMENT_DELETED',
						tableName: 'staffing_assignments',
						recordId: id,
						ipAddress: request.ip,
						oldValues: {
							employeeId: existing.employeeId,
							band: existing.band,
							disciplineId: existing.disciplineId,
							fteShare: existing.fteShare.toString(),
						} as unknown as Prisma.InputJsonValue,
					},
				});
			});

			return reply.status(204).send();
		},
	});
}

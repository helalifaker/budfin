import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

const idParamSchema = z.object({
	id: z.coerce.number().int().positive(),
});

const dateString = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/, 'Must be an ISO date string');

const academicYearBodySchema = z.object({
	fiscalYear: z.string().min(4).max(6),
	ay1Start: dateString,
	ay1End: dateString,
	ay2Start: dateString,
	ay2End: dateString,
	summerStart: dateString,
	summerEnd: dateString,
	academicWeeks: z.number().int().min(1).max(52),
});

const updateBodySchema = academicYearBodySchema.extend({
	version: z.number().int().positive(),
});

type AcademicYearBody = z.infer<typeof academicYearBodySchema>;

function parseDates(body: AcademicYearBody) {
	return {
		ay1Start: new Date(body.ay1Start),
		ay1End: new Date(body.ay1End),
		ay2Start: new Date(body.ay2Start),
		ay2End: new Date(body.ay2End),
		summerStart: new Date(body.summerStart),
		summerEnd: new Date(body.summerEnd),
	};
}

function validateDateOrdering(dates: ReturnType<typeof parseDates>): boolean {
	return (
		dates.ay1Start < dates.ay1End &&
		dates.ay1End <= dates.summerStart &&
		dates.summerStart < dates.summerEnd &&
		dates.summerEnd <= dates.ay2Start &&
		dates.ay2Start < dates.ay2End
	);
}

const DATE_ORDERING_ERROR =
	'Dates must follow ordering: ' +
	'ay1Start < ay1End <= summerStart < summerEnd <= ay2Start < ay2End';

function formatAcademicYear(ay: {
	id: number;
	fiscalYear: string;
	ay1Start: Date;
	ay1End: Date;
	ay2Start: Date;
	ay2End: Date;
	summerStart: Date;
	summerEnd: Date;
	academicWeeks: number;
	version: number;
	createdAt: Date;
	updatedAt: Date;
	createdBy: number;
	updatedBy: number;
}) {
	return {
		id: ay.id,
		fiscalYear: ay.fiscalYear,
		ay1Start: ay.ay1Start.toISOString(),
		ay1End: ay.ay1End.toISOString(),
		ay2Start: ay.ay2Start.toISOString(),
		ay2End: ay.ay2End.toISOString(),
		summerStart: ay.summerStart.toISOString(),
		summerEnd: ay.summerEnd.toISOString(),
		academicWeeks: ay.academicWeeks,
		version: ay.version,
		createdAt: ay.createdAt.toISOString(),
		updatedAt: ay.updatedAt.toISOString(),
		createdBy: ay.createdBy,
		updatedBy: ay.updatedBy,
	};
}

export async function academicYearRoutes(app: FastifyInstance) {
	// GET / — List all academic years
	app.get('/', {
		preHandler: [app.authenticate],
		handler: async () => {
			const years = await prisma.academicYear.findMany({
				orderBy: { fiscalYear: 'desc' },
			});
			return { academicYears: years.map(formatAcademicYear) };
		},
	});

	// GET /:id — Get single academic year
	app.get('/:id', {
		schema: { params: idParamSchema },
		preHandler: [app.authenticate],
		handler: async (request, reply) => {
			const { id } = request.params as z.infer<typeof idParamSchema>;
			const ay = await prisma.academicYear.findUnique({ where: { id } });
			if (!ay) {
				return reply.status(404).send({
					code: 'NOT_FOUND',
					message: 'Academic year not found',
				});
			}
			return formatAcademicYear(ay);
		},
	});

	// POST / — Create academic year
	app.post('/', {
		schema: { body: academicYearBodySchema },
		preHandler: [app.authenticate, app.requirePermission('admin:config')],
		handler: async (request, reply) => {
			const body = request.body as AcademicYearBody;
			const dates = parseDates(body);

			if (!validateDateOrdering(dates)) {
				return reply.status(422).send({
					code: 'INVALID_DATE_ORDER',
					message: DATE_ORDERING_ERROR,
				});
			}

			try {
				const ay = await prisma.$transaction(async (tx) => {
					const created = await tx.academicYear.create({
						data: {
							fiscalYear: body.fiscalYear,
							...dates,
							academicWeeks: body.academicWeeks,
							createdBy: request.user.id,
							updatedBy: request.user.id,
						},
					});
					await tx.auditEntry.create({
						data: {
							userId: request.user.id,
							userEmail: request.user.email,
							operation: 'ACADEMIC_YEAR_CREATED',
							tableName: 'academic_years',
							recordId: created.id,
							newValues: body as unknown as Prisma.InputJsonValue,
							ipAddress: request.ip,
						},
					});
					return created;
				});
				return reply.status(201).send(formatAcademicYear(ay));
			} catch (e) {
				if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
					return reply.status(409).send({
						code: 'DUPLICATE_CODE',
						message: `Fiscal year '${body.fiscalYear}' already exists`,
					});
				}
				throw e;
			}
		},
	});

	// PUT /:id — Update with optimistic lock
	app.put('/:id', {
		schema: { params: idParamSchema, body: updateBodySchema },
		preHandler: [app.authenticate, app.requirePermission('admin:config')],
		handler: async (request, reply) => {
			const { id } = request.params as z.infer<typeof idParamSchema>;
			const body = request.body as z.infer<typeof updateBodySchema>;
			const dates = parseDates(body);

			if (!validateDateOrdering(dates)) {
				return reply.status(422).send({
					code: 'INVALID_DATE_ORDER',
					message: DATE_ORDERING_ERROR,
				});
			}

			const existing = await prisma.academicYear.findUnique({
				where: { id },
			});
			if (!existing) {
				return reply.status(404).send({
					code: 'NOT_FOUND',
					message: 'Academic year not found',
				});
			}

			const ay = await prisma.$transaction(async (tx) => {
				const result = await tx.academicYear.updateMany({
					where: { id, version: body.version },
					data: {
						fiscalYear: body.fiscalYear,
						...dates,
						academicWeeks: body.academicWeeks,
						updatedBy: request.user.id,
						version: { increment: 1 },
					},
				});

				if (result.count === 0) {
					return null;
				}

				const updated = await tx.academicYear.findUnique({
					where: { id },
				});

				await tx.auditEntry.create({
					data: {
						userId: request.user.id,
						userEmail: request.user.email,
						operation: 'ACADEMIC_YEAR_UPDATED',
						tableName: 'academic_years',
						recordId: id,
						oldValues: formatAcademicYear(existing) as unknown as Prisma.InputJsonValue,
						newValues: body as unknown as Prisma.InputJsonValue,
						ipAddress: request.ip,
					},
				});
				return updated;
			});

			if (!ay) {
				return reply.status(409).send({
					code: 'OPTIMISTIC_LOCK',
					message: 'Record has been modified by another user',
				});
			}
			return formatAcademicYear(ay);
		},
	});

	// DELETE /:id
	app.delete('/:id', {
		schema: { params: idParamSchema },
		preHandler: [app.authenticate, app.requirePermission('admin:config')],
		handler: async (request, reply) => {
			const { id } = request.params as z.infer<typeof idParamSchema>;

			const existing = await prisma.academicYear.findUnique({
				where: { id },
			});
			if (!existing) {
				return reply.status(404).send({
					code: 'NOT_FOUND',
					message: 'Academic year not found',
				});
			}

			try {
				await prisma.$transaction(async (tx) => {
					await tx.academicYear.delete({ where: { id } });
					await tx.auditEntry.create({
						data: {
							userId: request.user.id,
							userEmail: request.user.email,
							operation: 'ACADEMIC_YEAR_DELETED',
							tableName: 'academic_years',
							recordId: id,
							oldValues: formatAcademicYear(existing) as unknown as Prisma.InputJsonValue,
							ipAddress: request.ip,
						},
					});
				});
				return reply.status(204).send();
			} catch (e) {
				if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
					return reply.status(409).send({
						code: 'REFERENCED_RECORD',
						message: 'Cannot delete: record is referenced by other data',
					});
				}
				throw e;
			}
		},
	});
}

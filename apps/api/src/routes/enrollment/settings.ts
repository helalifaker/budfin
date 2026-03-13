import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { VALID_GRADE_CODES } from '../../lib/enrollment-constants.js';
import { buildEnrollmentPlanningRulesUpdateData } from '../../services/planning-rules.js';
import {
	buildEnrollmentCapacityConfigUpdateData,
	buildEnrollmentSettingsStaleModules,
	getEnrollmentSettings,
} from '../../services/enrollment-settings.js';

const versionIdParamsSchema = z.object({
	versionId: z.coerce.number().int().positive(),
});

const gradeLevelEnum = z.enum(VALID_GRADE_CODES as [string, ...string[]]);

const planningRulesSchema = z.object({
	rolloverThreshold: z.number().min(0.5).max(2),
	retentionRecentWeight: z.number().min(0).max(1),
	historicalTargetRecentWeight: z.number().min(0).max(1),
	cappedRetention: z.number().min(0.5).max(1).optional(),
});

const capacitySettingSchema = z
	.object({
		gradeLevel: gradeLevelEnum,
		maxClassSize: z.number().int().min(1).max(50),
		plancherPct: z.number().min(0).max(1),
		ciblePct: z.number().min(0).max(1),
		plafondPct: z.number().min(0).max(1.5),
	})
	.refine((value) => value.plancherPct <= value.ciblePct && value.ciblePct <= value.plafondPct, {
		message: 'Expected plancherPct <= ciblePct <= plafondPct',
		path: ['plafondPct'],
	});

const settingsUpdateSchema = z.object({
	rules: planningRulesSchema,
	capacityByGrade: z.array(capacitySettingSchema).min(1),
});

export async function enrollmentSettingsRoutes(app: FastifyInstance) {
	app.get('/settings', {
		schema: {
			params: versionIdParamsSchema,
		},
		preHandler: [app.authenticate],
		handler: async (request, reply) => {
			const { versionId } = request.params as z.infer<typeof versionIdParamsSchema>;

			const settings = await getEnrollmentSettings(prisma, versionId);
			if (!settings) {
				return reply.status(404).send({
					code: 'VERSION_NOT_FOUND',
					message: `Version ${versionId} not found`,
				});
			}

			return settings;
		},
	});

	app.put('/settings', {
		schema: {
			params: versionIdParamsSchema,
			body: settingsUpdateSchema,
		},
		preHandler: [app.authenticate, app.requireRole('Admin', 'BudgetOwner', 'Editor')],
		handler: async (request, reply) => {
			const { versionId } = request.params as z.infer<typeof versionIdParamsSchema>;
			const body = request.body as z.infer<typeof settingsUpdateSchema>;

			const version = await prisma.budgetVersion.findUnique({
				where: { id: versionId },
				select: { id: true, status: true, dataSource: true, staleModules: true },
			});

			if (!version) {
				return reply.status(404).send({
					code: 'VERSION_NOT_FOUND',
					message: `Version ${versionId} not found`,
				});
			}

			if (version.status !== 'Draft') {
				return reply.status(409).send({
					code: 'VERSION_LOCKED',
					message: `Version is ${version.status} and cannot be modified`,
				});
			}

			if (version.dataSource === 'IMPORTED') {
				return reply.status(409).send({
					code: 'IMPORTED_VERSION',
					message: 'Cannot modify enrollment settings on imported versions',
				});
			}

			const gradeLevels = await prisma.gradeLevel.findMany({
				orderBy: { displayOrder: 'asc' },
				select: { gradeCode: true },
			});
			const expectedGradeLevels = new Set(gradeLevels.map((gradeLevel) => gradeLevel.gradeCode));
			const receivedGradeLevels = new Set(body.capacityByGrade.map((row) => row.gradeLevel));

			if (
				receivedGradeLevels.size !== expectedGradeLevels.size ||
				gradeLevels.some((gradeLevel) => !receivedGradeLevels.has(gradeLevel.gradeCode))
			) {
				return reply.status(422).send({
					code: 'SETTINGS_DATA_INCOMPLETE',
					message: 'Enrollment settings require a row for every grade',
				});
			}

			const staleModules = buildEnrollmentSettingsStaleModules(version.staleModules);

			const updated = await prisma.$transaction(async (tx) => {
				await tx.budgetVersion.update({
					where: { id: versionId },
					data: {
						...buildEnrollmentPlanningRulesUpdateData(body.rules),
						staleModules,
					},
				});

				for (const setting of body.capacityByGrade) {
					await tx.versionCapacityConfig.upsert({
						where: {
							versionId_gradeLevel: {
								versionId,
								gradeLevel: setting.gradeLevel,
							},
						},
						create: {
							versionId,
							gradeLevel: setting.gradeLevel,
							...buildEnrollmentCapacityConfigUpdateData(setting),
						},
						update: buildEnrollmentCapacityConfigUpdateData(setting),
					});
				}

				await tx.auditEntry.create({
					data: {
						userId: request.user.id,
						userEmail: request.user.email,
						operation: 'ENROLLMENT_SETTINGS_UPDATED',
						tableName: 'budget_versions',
						recordId: versionId,
						ipAddress: request.ip,
						newValues: body as unknown as Prisma.InputJsonValue,
					},
				});

				const settings = await getEnrollmentSettings(tx, versionId);
				if (!settings) {
					throw new Error(`Version ${versionId} disappeared during enrollment settings update`);
				}

				return settings;
			});

			return {
				...updated,
				staleModules,
			};
		},
	});
}

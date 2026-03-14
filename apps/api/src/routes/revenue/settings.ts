import type { FastifyInstance } from 'fastify';
import type { RevenueSettings } from '@budfin/types';
import { z } from 'zod';
import { Decimal } from 'decimal.js';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { formatRevenueSettingsRecord } from '../../services/revenue-config.js';

const versionIdParamsSchema = z.object({
	versionId: z.coerce.number().int().positive(),
});

const decimalString = z
	.string()
	.regex(/^\d+(\.\d{1,4})?$/, 'Must be a non-negative decimal string with up to 4 decimal places');

const revenueSettingsSchema = z.object({
	dpiPerStudentHt: decimalString,
	dossierPerStudentHt: decimalString,
	examBacPerStudent: decimalString,
	examDnbPerStudent: decimalString,
	examEafPerStudent: decimalString,
	evalPrimairePerStudent: decimalString,
	evalSecondairePerStudent: decimalString,
});

const SETTINGS_STALE_MODULES = ['REVENUE', 'PNL'] as const;

function toPersistencePayload(settings: RevenueSettings) {
	return {
		dpiPerStudentHt: new Decimal(settings.dpiPerStudentHt).toFixed(4),
		dossierPerStudentHt: new Decimal(settings.dossierPerStudentHt).toFixed(4),
		examBacPerStudent: new Decimal(settings.examBacPerStudent).toFixed(4),
		examDnbPerStudent: new Decimal(settings.examDnbPerStudent).toFixed(4),
		examEafPerStudent: new Decimal(settings.examEafPerStudent).toFixed(4),
		evalPrimairePerStudent: new Decimal(settings.evalPrimairePerStudent).toFixed(4),
		evalSecondairePerStudent: new Decimal(settings.evalSecondairePerStudent).toFixed(4),
	};
}

export async function revenueSettingsRoutes(app: FastifyInstance) {
	app.get('/revenue/settings', {
		schema: { params: versionIdParamsSchema },
		preHandler: [app.authenticate],
		handler: async (request, reply) => {
			const { versionId } = request.params as z.infer<typeof versionIdParamsSchema>;

			const version = await prisma.budgetVersion.findUnique({
				where: { id: versionId },
				select: { id: true },
			});

			if (!version) {
				return reply.status(404).send({
					code: 'VERSION_NOT_FOUND',
					message: `Version ${versionId} not found`,
				});
			}

			const settings = await prisma.versionRevenueSettings.findUnique({
				where: { versionId },
			});

			if (!settings) {
				return reply.status(404).send({
					code: 'REVENUE_SETTINGS_NOT_FOUND',
					message: `Revenue settings for version ${versionId} not found`,
				});
			}

			return {
				settings: formatRevenueSettingsRecord({
					dpiPerStudentHt: settings.dpiPerStudentHt,
					dossierPerStudentHt: settings.dossierPerStudentHt,
					examBacPerStudent: settings.examBacPerStudent,
					examDnbPerStudent: settings.examDnbPerStudent,
					examEafPerStudent: settings.examEafPerStudent,
					evalPrimairePerStudent: settings.evalPrimairePerStudent,
					evalSecondairePerStudent: settings.evalSecondairePerStudent,
				}),
			};
		},
	});

	app.put('/revenue/settings', {
		schema: {
			params: versionIdParamsSchema,
			body: revenueSettingsSchema,
		},
		preHandler: [app.authenticate, app.requireRole('Admin', 'BudgetOwner', 'Editor')],
		handler: async (request, reply) => {
			const { versionId } = request.params as z.infer<typeof versionIdParamsSchema>;
			const settings = request.body as z.infer<typeof revenueSettingsSchema>;

			const version = await prisma.budgetVersion.findUnique({
				where: { id: versionId },
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

			const persistedSettings = toPersistencePayload(settings);

			await prisma.$transaction(async (tx) => {
				const txPrisma = tx as typeof prisma;

				await txPrisma.versionRevenueSettings.update({
					where: { versionId },
					data: {
						...persistedSettings,
						updatedBy: request.user.id,
					},
				});

				const currentStale = new Set(version.staleModules);
				for (const moduleName of SETTINGS_STALE_MODULES) {
					currentStale.add(moduleName);
				}

				await txPrisma.budgetVersion.update({
					where: { id: versionId },
					data: { staleModules: [...currentStale] },
				});

				await txPrisma.auditEntry.create({
					data: {
						userId: request.user.id,
						userEmail: request.user.email,
						operation: 'REVENUE_SETTINGS_UPDATED',
						tableName: 'version_revenue_settings',
						recordId: versionId,
						ipAddress: request.ip,
						newValues: persistedSettings as unknown as Prisma.InputJsonValue,
					},
				});
			});

			return { settings: persistedSettings };
		},
	});
}

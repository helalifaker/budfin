import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

// ── Schemas ──────────────────────────────────────────────────────────────────

const versionIdParams = z.object({
	versionId: z.coerce.number().int().positive(),
});

const demandOverrideIdParams = z.object({
	versionId: z.coerce.number().int().positive(),
	id: z.coerce.number().int().positive(),
});

const staffingSettingsBody = z.object({
	hsaTargetHours: z.string().regex(/^\d+(\.\d{1,2})?$/),
	hsaFirstHourRate: z.string().regex(/^\d+(\.\d{1,2})?$/),
	hsaAdditionalHourRate: z.string().regex(/^\d+(\.\d{1,2})?$/),
	hsaMonths: z.number().int().min(1).max(12),
	academicWeeks: z.number().int().min(1).max(52),
	ajeerAnnualLevy: z.string().regex(/^\d+(\.\d{1,4})?$/),
	ajeerMonthlyFee: z.string().regex(/^\d+(\.\d{1,4})?$/),
});

const serviceProfileOverrideItem = z.object({
	serviceProfileId: z.number().int().positive(),
	weeklyServiceHours: z
		.string()
		.regex(/^\d+(\.\d{1})?$/)
		.nullable()
		.optional(),
	hsaEligible: z.boolean().nullable().optional(),
});

const serviceProfileOverridesBody = z.object({
	overrides: z.array(serviceProfileOverrideItem),
});

const costAssumptionItem = z.object({
	category: z.enum([
		'REMPLACEMENTS',
		'FORMATION',
		'RESIDENT_SALAIRES',
		'RESIDENT_LOGEMENT',
		'RESIDENT_PENSION',
	]),
	calculationMode: z.enum(['FLAT_ANNUAL', 'PERCENT_OF_PAYROLL', 'AMOUNT_PER_FTE']),
	value: z.string().regex(/^\d+(\.\d{1,4})?$/),
});

const costAssumptionsBody = z.object({
	assumptions: z.array(costAssumptionItem),
});

const lyceeGroupAssumptionItem = z.object({
	gradeLevel: z.string().min(1).max(10),
	disciplineId: z.number().int().positive(),
	groupCount: z.number().int().min(0),
	hoursPerGroup: z.string().regex(/^\d+(\.\d{1,2})?$/),
});

const lyceeGroupAssumptionsBody = z.object({
	assumptions: z.array(lyceeGroupAssumptionItem),
});

const demandOverrideItem = z.object({
	band: z.enum(['MATERNELLE', 'ELEMENTAIRE', 'COLLEGE', 'LYCEE']),
	disciplineId: z.number().int().positive(),
	lineType: z.enum(['STRUCTURAL', 'HOST_COUNTRY', 'AUTONOMY', 'SPECIALTY']),
	overrideFte: z.string().regex(/^\d+(\.\d{1,4})?$/),
	reasonCode: z.string().min(1).max(30),
	note: z.string().max(1000).nullable().optional(),
});

const demandOverridesBody = z.object({
	overrides: z.array(demandOverrideItem),
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

// ── Routes ───────────────────────────────────────────────────────────────────

export async function staffingSettingsRoutes(app: FastifyInstance) {
	// ── Staffing Settings ────────────────────────────────────────────────────

	// GET /staffing-settings — Get or auto-create with defaults
	app.get('/staffing-settings', {
		schema: { params: versionIdParams },
		preHandler: [app.authenticate],
		handler: async (request, reply) => {
			const { versionId } = request.params as z.infer<typeof versionIdParams>;

			const version = await getVersionOrFail(versionId, reply);
			if (!version) return;

			let settings = await prisma.versionStaffingSettings.findUnique({
				where: { versionId },
			});

			if (!settings) {
				// Auto-create with defaults
				settings = await prisma.versionStaffingSettings.create({
					data: { versionId },
				});
			}

			return {
				settings: {
					id: settings.id,
					versionId: settings.versionId,
					hsaTargetHours: settings.hsaTargetHours.toString(),
					hsaFirstHourRate: settings.hsaFirstHourRate.toString(),
					hsaAdditionalHourRate: settings.hsaAdditionalHourRate.toString(),
					hsaMonths: settings.hsaMonths,
					academicWeeks: settings.academicWeeks,
					ajeerAnnualLevy: settings.ajeerAnnualLevy.toString(),
					ajeerMonthlyFee: settings.ajeerMonthlyFee.toString(),
					reconciliationBaseline: settings.reconciliationBaseline,
				},
			};
		},
	});

	// PUT /staffing-settings — Update settings, mark STAFFING stale
	app.put('/staffing-settings', {
		schema: {
			params: versionIdParams,
			body: staffingSettingsBody,
		},
		preHandler: [app.authenticate, app.requirePermission('data:edit')],
		handler: async (request, reply) => {
			const { versionId } = request.params as z.infer<typeof versionIdParams>;
			const body = request.body as z.infer<typeof staffingSettingsBody>;

			const version = await getVersionOrFail(versionId, reply);
			if (!version) return;
			if (!isDraft(version, reply)) return;

			const updated = await prisma.$transaction(async (tx) => {
				const txPrisma = tx as typeof prisma;

				const result = await txPrisma.versionStaffingSettings.upsert({
					where: { versionId },
					create: {
						versionId,
						hsaTargetHours: body.hsaTargetHours,
						hsaFirstHourRate: body.hsaFirstHourRate,
						hsaAdditionalHourRate: body.hsaAdditionalHourRate,
						hsaMonths: body.hsaMonths,
						academicWeeks: body.academicWeeks,
						ajeerAnnualLevy: body.ajeerAnnualLevy,
						ajeerMonthlyFee: body.ajeerMonthlyFee,
					},
					update: {
						hsaTargetHours: body.hsaTargetHours,
						hsaFirstHourRate: body.hsaFirstHourRate,
						hsaAdditionalHourRate: body.hsaAdditionalHourRate,
						hsaMonths: body.hsaMonths,
						academicWeeks: body.academicWeeks,
						ajeerAnnualLevy: body.ajeerAnnualLevy,
						ajeerMonthlyFee: body.ajeerMonthlyFee,
					},
				});

				await markStaffingStale(txPrisma, versionId, version.staleModules);

				await txPrisma.auditEntry.create({
					data: {
						userId: request.user.id,
						userEmail: request.user.email,
						operation: 'STAFFING_SETTINGS_UPDATED',
						tableName: 'version_staffing_settings',
						recordId: versionId,
						ipAddress: request.ip,
						newValues: body as unknown as Prisma.InputJsonValue,
					},
				});

				return result;
			});

			return {
				settings: {
					id: updated.id,
					versionId: updated.versionId,
					hsaTargetHours: updated.hsaTargetHours.toString(),
					hsaFirstHourRate: updated.hsaFirstHourRate.toString(),
					hsaAdditionalHourRate: updated.hsaAdditionalHourRate.toString(),
					hsaMonths: updated.hsaMonths,
					academicWeeks: updated.academicWeeks,
					ajeerAnnualLevy: updated.ajeerAnnualLevy.toString(),
					ajeerMonthlyFee: updated.ajeerMonthlyFee.toString(),
					reconciliationBaseline: updated.reconciliationBaseline,
				},
			};
		},
	});

	// ── Service Profile Overrides ────────────────────────────────────────────

	// GET /service-profile-overrides
	app.get('/service-profile-overrides', {
		schema: { params: versionIdParams },
		preHandler: [app.authenticate],
		handler: async (request, reply) => {
			const { versionId } = request.params as z.infer<typeof versionIdParams>;

			const version = await getVersionOrFail(versionId, reply);
			if (!version) return;

			const overrides = await prisma.versionServiceProfileOverride.findMany({
				where: { versionId },
				include: { serviceProfile: true },
				orderBy: { serviceProfile: { sortOrder: 'asc' } },
			});

			return {
				overrides: overrides.map((o) => ({
					id: o.id,
					versionId: o.versionId,
					serviceProfileId: o.serviceProfileId,
					serviceProfileCode: o.serviceProfile.code,
					serviceProfileName: o.serviceProfile.name,
					weeklyServiceHours: o.weeklyServiceHours?.toString() ?? null,
					hsaEligible: o.hsaEligible,
				})),
			};
		},
	});

	// PUT /service-profile-overrides — Upsert overrides, mark STAFFING stale
	app.put('/service-profile-overrides', {
		schema: {
			params: versionIdParams,
			body: serviceProfileOverridesBody,
		},
		preHandler: [app.authenticate, app.requirePermission('data:edit')],
		handler: async (request, reply) => {
			const { versionId } = request.params as z.infer<typeof versionIdParams>;
			const { overrides } = request.body as z.infer<typeof serviceProfileOverridesBody>;

			const version = await getVersionOrFail(versionId, reply);
			if (!version) return;
			if (!isDraft(version, reply)) return;

			await prisma.$transaction(async (tx) => {
				const txPrisma = tx as typeof prisma;

				// Delete existing overrides for this version, then recreate
				await txPrisma.versionServiceProfileOverride.deleteMany({
					where: { versionId },
				});

				if (overrides.length > 0) {
					await txPrisma.versionServiceProfileOverride.createMany({
						data: overrides.map((o) => ({
							versionId,
							serviceProfileId: o.serviceProfileId,
							weeklyServiceHours: o.weeklyServiceHours ?? null,
							hsaEligible: o.hsaEligible ?? null,
						})),
					});
				}

				await markStaffingStale(txPrisma, versionId, version.staleModules);

				await txPrisma.auditEntry.create({
					data: {
						userId: request.user.id,
						userEmail: request.user.email,
						operation: 'SERVICE_PROFILE_OVERRIDES_UPDATED',
						tableName: 'version_service_profile_overrides',
						recordId: versionId,
						ipAddress: request.ip,
						newValues: { count: overrides.length } as unknown as Prisma.InputJsonValue,
					},
				});
			});

			// Return the freshly-written overrides
			const saved = await prisma.versionServiceProfileOverride.findMany({
				where: { versionId },
				include: { serviceProfile: true },
				orderBy: { serviceProfile: { sortOrder: 'asc' } },
			});

			return {
				overrides: saved.map((o) => ({
					id: o.id,
					versionId: o.versionId,
					serviceProfileId: o.serviceProfileId,
					serviceProfileCode: o.serviceProfile.code,
					serviceProfileName: o.serviceProfile.name,
					weeklyServiceHours: o.weeklyServiceHours?.toString() ?? null,
					hsaEligible: o.hsaEligible,
				})),
			};
		},
	});

	// ── Cost Assumptions ─────────────────────────────────────────────────────

	// GET /cost-assumptions
	app.get('/cost-assumptions', {
		schema: { params: versionIdParams },
		preHandler: [app.authenticate],
		handler: async (request, reply) => {
			const { versionId } = request.params as z.infer<typeof versionIdParams>;

			const version = await getVersionOrFail(versionId, reply);
			if (!version) return;

			const assumptions = await prisma.versionStaffingCostAssumption.findMany({
				where: { versionId },
				orderBy: { category: 'asc' },
			});

			return {
				assumptions: assumptions.map((a) => ({
					id: a.id,
					versionId: a.versionId,
					category: a.category,
					calculationMode: a.calculationMode,
					value: a.value.toString(),
				})),
			};
		},
	});

	// PUT /cost-assumptions — Upsert assumptions, mark STAFFING stale
	app.put('/cost-assumptions', {
		schema: {
			params: versionIdParams,
			body: costAssumptionsBody,
		},
		preHandler: [app.authenticate, app.requirePermission('data:edit')],
		handler: async (request, reply) => {
			const { versionId } = request.params as z.infer<typeof versionIdParams>;
			const { assumptions } = request.body as z.infer<typeof costAssumptionsBody>;

			const version = await getVersionOrFail(versionId, reply);
			if (!version) return;
			if (!isDraft(version, reply)) return;

			await prisma.$transaction(async (tx) => {
				const txPrisma = tx as typeof prisma;

				// Delete existing, then recreate
				await txPrisma.versionStaffingCostAssumption.deleteMany({
					where: { versionId },
				});

				if (assumptions.length > 0) {
					await txPrisma.versionStaffingCostAssumption.createMany({
						data: assumptions.map((a) => ({
							versionId,
							category: a.category,
							calculationMode: a.calculationMode,
							value: a.value,
						})),
					});
				}

				await markStaffingStale(txPrisma, versionId, version.staleModules);

				await txPrisma.auditEntry.create({
					data: {
						userId: request.user.id,
						userEmail: request.user.email,
						operation: 'COST_ASSUMPTIONS_UPDATED',
						tableName: 'version_staffing_cost_assumptions',
						recordId: versionId,
						ipAddress: request.ip,
						newValues: { count: assumptions.length } as unknown as Prisma.InputJsonValue,
					},
				});
			});

			const saved = await prisma.versionStaffingCostAssumption.findMany({
				where: { versionId },
				orderBy: { category: 'asc' },
			});

			return {
				assumptions: saved.map((a) => ({
					id: a.id,
					versionId: a.versionId,
					category: a.category,
					calculationMode: a.calculationMode,
					value: a.value.toString(),
				})),
			};
		},
	});

	// ── Lycee Group Assumptions ──────────────────────────────────────────────

	// GET /lycee-group-assumptions
	app.get('/lycee-group-assumptions', {
		schema: { params: versionIdParams },
		preHandler: [app.authenticate],
		handler: async (request, reply) => {
			const { versionId } = request.params as z.infer<typeof versionIdParams>;

			const version = await getVersionOrFail(versionId, reply);
			if (!version) return;

			const assumptions = await prisma.versionLyceeGroupAssumption.findMany({
				where: { versionId },
				include: { discipline: true },
				orderBy: [{ gradeLevel: 'asc' }, { disciplineId: 'asc' }],
			});

			return {
				assumptions: assumptions.map((a) => ({
					id: a.id,
					versionId: a.versionId,
					gradeLevel: a.gradeLevel,
					disciplineId: a.disciplineId,
					disciplineCode: a.discipline.code,
					disciplineName: a.discipline.name,
					groupCount: a.groupCount,
					hoursPerGroup: a.hoursPerGroup.toString(),
				})),
			};
		},
	});

	// PUT /lycee-group-assumptions — Upsert assumptions, mark STAFFING stale
	app.put('/lycee-group-assumptions', {
		schema: {
			params: versionIdParams,
			body: lyceeGroupAssumptionsBody,
		},
		preHandler: [app.authenticate, app.requirePermission('data:edit')],
		handler: async (request, reply) => {
			const { versionId } = request.params as z.infer<typeof versionIdParams>;
			const { assumptions } = request.body as z.infer<typeof lyceeGroupAssumptionsBody>;

			const version = await getVersionOrFail(versionId, reply);
			if (!version) return;
			if (!isDraft(version, reply)) return;

			await prisma.$transaction(async (tx) => {
				const txPrisma = tx as typeof prisma;

				await txPrisma.versionLyceeGroupAssumption.deleteMany({
					where: { versionId },
				});

				if (assumptions.length > 0) {
					await txPrisma.versionLyceeGroupAssumption.createMany({
						data: assumptions.map((a) => ({
							versionId,
							gradeLevel: a.gradeLevel,
							disciplineId: a.disciplineId,
							groupCount: a.groupCount,
							hoursPerGroup: a.hoursPerGroup,
						})),
					});
				}

				await markStaffingStale(txPrisma, versionId, version.staleModules);

				await txPrisma.auditEntry.create({
					data: {
						userId: request.user.id,
						userEmail: request.user.email,
						operation: 'LYCEE_GROUP_ASSUMPTIONS_UPDATED',
						tableName: 'version_lycee_group_assumptions',
						recordId: versionId,
						ipAddress: request.ip,
						newValues: { count: assumptions.length } as unknown as Prisma.InputJsonValue,
					},
				});
			});

			const saved = await prisma.versionLyceeGroupAssumption.findMany({
				where: { versionId },
				include: { discipline: true },
				orderBy: [{ gradeLevel: 'asc' }, { disciplineId: 'asc' }],
			});

			return {
				assumptions: saved.map((a) => ({
					id: a.id,
					versionId: a.versionId,
					gradeLevel: a.gradeLevel,
					disciplineId: a.disciplineId,
					disciplineCode: a.discipline.code,
					disciplineName: a.discipline.name,
					groupCount: a.groupCount,
					hoursPerGroup: a.hoursPerGroup.toString(),
				})),
			};
		},
	});

	// ── Demand Overrides ─────────────────────────────────────────────────────

	// GET /demand-overrides
	app.get('/demand-overrides', {
		schema: { params: versionIdParams },
		preHandler: [app.authenticate],
		handler: async (request, reply) => {
			const { versionId } = request.params as z.infer<typeof versionIdParams>;

			const version = await getVersionOrFail(versionId, reply);
			if (!version) return;

			const overrides = await prisma.demandOverride.findMany({
				where: { versionId },
				include: { discipline: true },
				orderBy: [{ band: 'asc' }, { disciplineId: 'asc' }],
			});

			return {
				overrides: overrides.map((o) => ({
					id: o.id,
					versionId: o.versionId,
					band: o.band,
					disciplineId: o.disciplineId,
					disciplineCode: o.discipline.code,
					disciplineName: o.discipline.name,
					lineType: o.lineType,
					overrideFte: o.overrideFte.toString(),
					reasonCode: o.reasonCode,
					note: o.note,
				})),
			};
		},
	});

	// PUT /demand-overrides — Upsert overrides (require reasonCode), mark STAFFING stale
	app.put('/demand-overrides', {
		schema: {
			params: versionIdParams,
			body: demandOverridesBody,
		},
		preHandler: [app.authenticate, app.requirePermission('data:edit')],
		handler: async (request, reply) => {
			const { versionId } = request.params as z.infer<typeof versionIdParams>;
			const { overrides } = request.body as z.infer<typeof demandOverridesBody>;

			const version = await getVersionOrFail(versionId, reply);
			if (!version) return;
			if (!isDraft(version, reply)) return;

			await prisma.$transaction(async (tx) => {
				const txPrisma = tx as typeof prisma;

				await txPrisma.demandOverride.deleteMany({
					where: { versionId },
				});

				if (overrides.length > 0) {
					await txPrisma.demandOverride.createMany({
						data: overrides.map((o) => ({
							versionId,
							band: o.band,
							disciplineId: o.disciplineId,
							lineType: o.lineType,
							overrideFte: o.overrideFte,
							reasonCode: o.reasonCode,
							note: o.note ?? null,
							updatedBy: request.user.id,
						})),
					});
				}

				await markStaffingStale(txPrisma, versionId, version.staleModules);

				await txPrisma.auditEntry.create({
					data: {
						userId: request.user.id,
						userEmail: request.user.email,
						operation: 'DEMAND_OVERRIDES_UPDATED',
						tableName: 'demand_overrides',
						recordId: versionId,
						ipAddress: request.ip,
						newValues: { count: overrides.length } as unknown as Prisma.InputJsonValue,
					},
				});
			});

			const saved = await prisma.demandOverride.findMany({
				where: { versionId },
				include: { discipline: true },
				orderBy: [{ band: 'asc' }, { disciplineId: 'asc' }],
			});

			return {
				overrides: saved.map((o) => ({
					id: o.id,
					versionId: o.versionId,
					band: o.band,
					disciplineId: o.disciplineId,
					disciplineCode: o.discipline.code,
					disciplineName: o.discipline.name,
					lineType: o.lineType,
					overrideFte: o.overrideFte.toString(),
					reasonCode: o.reasonCode,
					note: o.note,
				})),
			};
		},
	});

	// DELETE /demand-overrides/:id — Delete a single override, mark STAFFING stale
	app.delete('/demand-overrides/:id', {
		schema: { params: demandOverrideIdParams },
		preHandler: [app.authenticate, app.requirePermission('data:edit')],
		handler: async (request, reply) => {
			const { versionId, id } = request.params as z.infer<typeof demandOverrideIdParams>;

			const version = await getVersionOrFail(versionId, reply);
			if (!version) return;
			if (!isDraft(version, reply)) return;

			const existing = await prisma.demandOverride.findFirst({
				where: { id, versionId },
			});

			if (!existing) {
				return reply.status(404).send({
					code: 'DEMAND_OVERRIDE_NOT_FOUND',
					message: `Demand override ${id} not found in version ${versionId}`,
				});
			}

			await prisma.$transaction(async (tx) => {
				const txPrisma = tx as typeof prisma;

				await txPrisma.demandOverride.delete({ where: { id } });

				await markStaffingStale(txPrisma, versionId, version.staleModules);

				await txPrisma.auditEntry.create({
					data: {
						userId: request.user.id,
						userEmail: request.user.email,
						operation: 'DEMAND_OVERRIDE_DELETED',
						tableName: 'demand_overrides',
						recordId: id,
						ipAddress: request.ip,
						oldValues: {
							band: existing.band,
							disciplineId: existing.disciplineId,
							lineType: existing.lineType,
						} as unknown as Prisma.InputJsonValue,
					},
				});
			});

			return reply.status(204).send();
		},
	});

	// ── Teaching Requirements (read-only) ────────────────────────────────────

	// GET /teaching-requirements — Lines with coverage data; 409 if STAFFING stale
	app.get('/teaching-requirements', {
		schema: { params: versionIdParams },
		preHandler: [app.authenticate],
		handler: async (request, reply) => {
			const { versionId } = request.params as z.infer<typeof versionIdParams>;

			const version = await getVersionOrFail(versionId, reply);
			if (!version) return;

			if (version.staleModules.includes('STAFFING')) {
				return reply.status(409).send({
					code: 'STALE_DATA',
					message: 'Staffing has not been (re)calculated since last input change',
				});
			}

			const lines = await prisma.teachingRequirementLine.findMany({
				where: { versionId },
				orderBy: [{ band: 'asc' }, { disciplineCode: 'asc' }],
			});

			return {
				lines: lines.map((l) => ({
					id: l.id,
					versionId: l.versionId,
					band: l.band,
					disciplineCode: l.disciplineCode,
					lineLabel: l.lineLabel,
					lineType: l.lineType,
					driverType: l.driverType,
					serviceProfileCode: l.serviceProfileCode,
					totalDriverUnits: l.totalDriverUnits,
					totalWeeklyHours: l.totalWeeklyHours.toString(),
					baseOrs: l.baseOrs.toString(),
					effectiveOrs: l.effectiveOrs.toString(),
					requiredFteRaw: l.requiredFteRaw.toString(),
					requiredFtePlanned: l.requiredFtePlanned.toString(),
					recommendedPositions: l.recommendedPositions,
					coveredFte: l.coveredFte.toString(),
					gapFte: l.gapFte.toString(),
					coverageStatus: l.coverageStatus,
					assignedStaffCount: l.assignedStaffCount,
					vacancyCount: l.vacancyCount,
					directCostAnnual: l.directCostAnnual.toString(),
					hsaCostAnnual: l.hsaCostAnnual.toString(),
					calculatedAt: l.calculatedAt,
				})),
			};
		},
	});

	// GET /teaching-requirement-sources — Per-grade source detail
	app.get('/teaching-requirement-sources', {
		schema: { params: versionIdParams },
		preHandler: [app.authenticate],
		handler: async (request, reply) => {
			const { versionId } = request.params as z.infer<typeof versionIdParams>;

			const version = await getVersionOrFail(versionId, reply);
			if (!version) return;

			if (version.staleModules.includes('STAFFING')) {
				return reply.status(409).send({
					code: 'STALE_DATA',
					message: 'Staffing has not been (re)calculated since last input change',
				});
			}

			const sources = await prisma.teachingRequirementSource.findMany({
				where: { versionId },
				include: { discipline: true },
				orderBy: [{ gradeLevel: 'asc' }, { disciplineId: 'asc' }],
			});

			return {
				sources: sources.map((s) => ({
					id: s.id,
					versionId: s.versionId,
					gradeLevel: s.gradeLevel,
					disciplineId: s.disciplineId,
					disciplineCode: s.discipline.code,
					disciplineName: s.discipline.name,
					lineType: s.lineType,
					driverType: s.driverType,
					headcount: s.headcount,
					maxClassSize: s.maxClassSize,
					driverUnits: s.driverUnits,
					hoursPerUnit: s.hoursPerUnit.toString(),
					totalWeeklyHours: s.totalWeeklyHours.toString(),
					calculatedAt: s.calculatedAt,
				})),
			};
		},
	});
}

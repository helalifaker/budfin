import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Decimal } from 'decimal.js';
import { randomUUID } from 'node:crypto';
import { prisma } from '../../lib/prisma.js';
import { getEncryptionKey } from '../../services/staffing/crypto-helper.js';
import {
	calculateDHG,
	type EnrollmentInput,
	type DhgGrilleRow,
} from '../../services/staffing/dhg-engine.js';
import {
	calculateEmployeeAnnualCost,
	type EmployeeCostInput,
} from '../../services/staffing/cost-engine.js';
import {
	calculateCategoryMonthlyCosts,
	type CategoryCostConfig,
} from '../../services/staffing/category-cost-engine.js';

const versionIdParams = z.object({
	versionId: z.coerce.number().int().positive(),
});

interface RawEmployee {
	id: number;
	employee_code: string;
	status: string;
	is_saudi: boolean;
	is_ajeer: boolean;
	is_teaching: boolean;
	joining_date: Date;
	base_salary: string;
	housing_allowance: string;
	transport_allowance: string;
	responsibility_premium: string;
	hsa_amount: string;
	augmentation: string;
	ajeer_annual_levy: string;
	ajeer_monthly_fee: string;
}

export async function staffingCalculateRoutes(app: FastifyInstance) {
	// POST /calculate/staffing
	app.post('/staffing', {
		schema: { params: versionIdParams },
		preHandler: [app.authenticate, app.requirePermission('data:edit')],
		handler: async (request, reply) => {
			const { versionId } = request.params as z.infer<typeof versionIdParams>;
			const startTime = Date.now();
			const runId = randomUUID();

			// Version guard
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
					message: 'Cannot calculate on a locked or archived version',
				});
			}

			// Prerequisite checks
			const missing: string[] = [];

			const enrollmentCount = await prisma.enrollmentHeadcount.count({
				where: { versionId },
			});
			if (enrollmentCount === 0) missing.push('ENROLLMENT');

			const employeeCount = await prisma.employee.count({
				where: { versionId },
			});
			if (employeeCount === 0) missing.push('EMPLOYEES');

			if (missing.length > 0) {
				return reply.status(422).send({
					code: 'MISSING_PREREQUISITES',
					message: 'Required data is missing for staffing calculation',
					missing,
				});
			}

			// ── DHG Calculation ──────────────────────────────────────────────

			const enrollments = await prisma.enrollmentHeadcount.findMany({
				where: { versionId },
			});

			const [gradeLevels, versionCapacityConfigs] = await Promise.all([
				prisma.gradeLevel.findMany({
					select: {
						gradeCode: true,
						maxClassSize: true,
					},
				}),
				prisma.versionCapacityConfig.findMany({
					where: { versionId },
					select: {
						gradeLevel: true,
						maxClassSize: true,
					},
				}),
			]);
			const gradeMap = new Map(gradeLevels.map((g) => [g.gradeCode, g]));
			const versionCapacityMap = new Map(
				versionCapacityConfigs.map((config) => [config.gradeLevel, config.maxClassSize] as const)
			);

			const enrollmentInputs: EnrollmentInput[] = enrollments.map((e) => ({
				gradeLevel: e.gradeLevel,
				headcount: e.headcount,
				maxClassSize:
					versionCapacityMap.get(e.gradeLevel) ?? gradeMap.get(e.gradeLevel)?.maxClassSize ?? 28,
			}));

			const grilleConfigs = await prisma.dhgGrilleConfig.findMany({
				where: { effectiveFromYear: { lte: version.fiscalYear } },
			});

			const grilleRows: DhgGrilleRow[] = grilleConfigs.map((g) => ({
				gradeLevel: g.gradeLevel,
				subject: g.subject,
				dhgType: g.dhgType,
				hoursPerWeekPerSection: g.hoursPerWeekPerSection.toString(),
			}));

			const dhgResults = calculateDHG(enrollmentInputs, grilleRows);

			// Persist DHG results
			for (const result of dhgResults) {
				const enrollment = enrollments.find((e) => e.gradeLevel === result.gradeLevel);
				if (!enrollment) continue;

				await prisma.dhgRequirement.upsert({
					where: {
						versionId_academicPeriod_gradeLevel: {
							versionId,
							academicPeriod: enrollment.academicPeriod,
							gradeLevel: result.gradeLevel,
						},
					},
					update: {
						sectionsNeeded: result.sectionsNeeded,
						totalWeeklyHours: result.totalWeeklyHours.toFixed(4),
						totalAnnualHours: result.totalAnnualHours.toFixed(4),
						fte: result.fte.toFixed(4),
					},
					create: {
						versionId,
						academicPeriod: enrollment.academicPeriod,
						gradeLevel: result.gradeLevel,
						headcount: enrollment.headcount,
						maxClassSize:
							versionCapacityMap.get(result.gradeLevel) ??
							gradeMap.get(result.gradeLevel)?.maxClassSize ??
							28,
						sectionsNeeded: result.sectionsNeeded,
						totalWeeklyHours: result.totalWeeklyHours.toFixed(4),
						totalAnnualHours: result.totalAnnualHours.toFixed(4),
						fte: result.fte.toFixed(4),
					},
				});
			}

			// ── Staff Cost Calculation ───────────────────────────────────────

			const key = getEncryptionKey();
			const SALARY_FIELDS = [
				'base_salary',
				'housing_allowance',
				'transport_allowance',
				'responsibility_premium',
				'hsa_amount',
				'augmentation',
			];
			const salarySelect = SALARY_FIELDS.map(
				(f) => `pgp_sym_decrypt(e.${f}, '${key}') as ${f}`
			).join(', ');

			const rawEmployees = await prisma.$queryRawUnsafe<RawEmployee[]>(`
				SELECT e.id, e.employee_code, e.status, e.is_saudi, e.is_ajeer,
					e.is_teaching, e.joining_date,
					${salarySelect},
					e.ajeer_annual_levy::text as ajeer_annual_levy,
					e.ajeer_monthly_fee::text as ajeer_monthly_fee
				FROM employees e
				WHERE e.version_id = ${versionId} AND e.status != 'Departed'
			`);

			// As-of date: end of fiscal year
			const asOfDate = new Date(Date.UTC(version.fiscalYear, 11, 31));

			let totalAnnualStaffCosts = new Decimal(0);
			const monthlyAdjustedGrossTotals = new Map<number, Decimal>();
			for (let m = 1; m <= 12; m++) {
				monthlyAdjustedGrossTotals.set(m, new Decimal(0));
			}

			// Clear previous calculations
			await prisma.monthlyStaffCost.deleteMany({ where: { versionId } });
			await prisma.eosProvision.deleteMany({ where: { versionId } });
			await prisma.categoryMonthlyCost.deleteMany({ where: { versionId } });

			for (const emp of rawEmployees) {
				const costInput: EmployeeCostInput = {
					baseSalary: emp.base_salary,
					housingAllowance: emp.housing_allowance,
					transportAllowance: emp.transport_allowance,
					responsibilityPremium: emp.responsibility_premium,
					hsaAmount: emp.hsa_amount,
					augmentation: emp.augmentation,
					isTeaching: emp.is_teaching,
					isSaudi: emp.is_saudi,
					isAjeer: emp.is_ajeer,
					status: emp.status as 'Existing' | 'New' | 'Departed',
					ajeerAnnualLevy: emp.ajeer_annual_levy,
					ajeerMonthlyFee: emp.ajeer_monthly_fee,
					hireDate: emp.joining_date,
					asOfDate,
				};

				const { months, eos } = calculateEmployeeAnnualCost(costInput);

				// Persist monthly costs
				await prisma.monthlyStaffCost.createMany({
					data: months.map((m) => ({
						versionId,
						employeeId: emp.id,
						month: m.month,
						baseGross: m.baseGross.toFixed(4),
						adjustedGross: m.adjustedGross.toFixed(4),
						housingAllowance: m.housingAllowance.toFixed(4),
						transportAllowance: m.transportAllowance.toFixed(4),
						responsibilityPremium: m.responsibilityPremium.toFixed(4),
						hsaAmount: m.hsaAmount.toFixed(4),
						gosiAmount: m.gosiAmount.toFixed(4),
						ajeerAmount: m.ajeerAmount.toFixed(4),
						eosMonthlyAccrual: m.eosMonthlyAccrual.toFixed(4),
						totalCost: m.totalCost.toFixed(4),
						calculatedBy: request.user.id,
					})),
				});

				// Persist EoS provision
				await prisma.eosProvision.create({
					data: {
						versionId,
						employeeId: emp.id,
						yearsOfService: eos.yearsOfService.toFixed(4),
						eosBase: eos.eosBase.toFixed(4),
						eosAnnual: eos.eosAnnual.toFixed(4),
						eosMonthlyAccrual: eos.eosMonthlyAccrual.toFixed(4),
						asOfDate,
					},
				});

				// Sum annual cost and accumulate monthly adjusted gross subtotals
				for (const m of months) {
					totalAnnualStaffCosts = totalAnnualStaffCosts.plus(m.totalCost);
					const prev = monthlyAdjustedGrossTotals.get(m.month) ?? new Decimal(0);
					monthlyAdjustedGrossTotals.set(m.month, prev.plus(m.adjustedGross));
				}
			}

			// ── Category Costs (Contrats Locaux & Residents) ────────────────
			const configKeys = [
				'remplacements_rate',
				'formation_rate',
				'resident_salary_annual',
				'resident_logement_annual',
			];
			const configRows = await prisma.systemConfig.findMany({
				where: { key: { in: configKeys } },
			});
			const configMap = new Map(configRows.map((c) => [c.key, c.value]));

			const categoryConfig: CategoryCostConfig = {
				remplacementsRate: configMap.get('remplacements_rate') ?? '0',
				formationRate: configMap.get('formation_rate') ?? '0',
				residentSalaryAnnual: configMap.get('resident_salary_annual') ?? '0',
				residentLogementAnnual: configMap.get('resident_logement_annual') ?? '0',
			};

			const categoryCosts = calculateCategoryMonthlyCosts(
				monthlyAdjustedGrossTotals,
				categoryConfig
			);

			let totalCategoryCosts = new Decimal(0);
			await prisma.categoryMonthlyCost.createMany({
				data: categoryCosts.map((c) => {
					totalCategoryCosts = totalCategoryCosts.plus(c.amount);
					return {
						versionId,
						month: c.month,
						category: c.category,
						amount: c.amount.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4),
						calculatedBy: request.user.id,
					};
				}),
			});

			// Compute total FTE
			const totalFte = dhgResults.reduce((sum, r) => sum.plus(r.fte), new Decimal(0));

			// Clear STAFFING stale flag
			await prisma.$executeRaw`
				UPDATE budget_versions
				SET stale_modules = array_remove(stale_modules, 'STAFFING'),
					updated_at = NOW()
				WHERE id = ${versionId}
			`;

			// Audit log
			await prisma.calculationAuditLog.create({
				data: {
					versionId,
					runId,
					module: 'STAFFING',
					status: 'COMPLETED',
					completedAt: new Date(),
					durationMs: Date.now() - startTime,
					inputSummary: {
						employees: rawEmployees.length,
						enrollments: enrollments.length,
						grilles: grilleConfigs.length,
					},
					outputSummary: {
						total_fte: totalFte.toFixed(4),
						total_annual_staff_costs: totalAnnualStaffCosts.toFixed(4),
						total_category_costs: totalCategoryCosts
							.toDecimalPlaces(4, Decimal.ROUND_HALF_UP)
							.toFixed(4),
					},
					triggeredBy: request.user.id,
				},
			});

			return {
				run_id: runId,
				duration_ms: Date.now() - startTime,
				summary: {
					total_fte: totalFte.toFixed(4),
					total_annual_staff_costs: totalAnnualStaffCosts.toFixed(4),
					total_category_costs: totalCategoryCosts
						.toDecimalPlaces(4, Decimal.ROUND_HALF_UP)
						.toFixed(4),
				},
			};
		},
	});
}

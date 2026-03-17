import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Decimal } from 'decimal.js';
import { randomUUID } from 'node:crypto';
import { prisma } from '../../lib/prisma.js';
import { getEncryptionKey } from '../../services/staffing/crypto-helper.js';
import {
	calculateDemand,
	type DemandEngineInput,
	type DemandRuleInput,
	type DemandServiceProfile,
	type RequirementLine,
	type RequirementSource,
} from '../../services/staffing/demand-engine.js';
import {
	calculateCoverage,
	type CoverageAssignment,
	type CoverageRequirementLine,
	type CoverageWarning,
} from '../../services/staffing/coverage-engine.js';
import { calculateHsa, type HsaInput } from '../../services/staffing/hsa-engine.js';
import {
	calculateEmployeeAnnualCost,
	type EmployeeCostInput,
	type CostMode,
} from '../../services/staffing/cost-engine.js';
import {
	calculateConfigurableCategoryMonthlyCosts,
	type CategoryAssumption,
	type CalculationMode,
} from '../../services/staffing/category-cost-engine.js';
// ── Schemas ─────────────────────────────────────────────────────────────────

const versionIdParams = z.object({
	versionId: z.coerce.number().int().positive(),
});

// ── Raw Employee Type (decrypted via pgcrypto) ──────────────────────────────

interface RawEmployee {
	id: number;
	employee_code: string;
	name: string;
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
	cost_mode: string;
	record_type: string;
	service_profile_id: number | null;
	hourly_percentage: string;
}

// ── Route Plugin ────────────────────────────────────────────────────────────

export async function staffingCalculateRoutes(app: FastifyInstance) {
	// POST /calculate/staffing — Full 10-step orchestration pipeline
	app.post('/staffing', {
		schema: { params: versionIdParams },
		preHandler: [app.authenticate, app.requirePermission('data:edit')],
		handler: async (request, reply) => {
			const { versionId } = request.params as z.infer<typeof versionIdParams>;
			const startTime = Date.now();
			const runId = randomUUID();
			const calculatedAt = new Date();

			// ════════════════════════════════════════════════════════════════
			// STEP 1: VALIDATE PREREQUISITES
			// ════════════════════════════════════════════════════════════════

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

			const missing: string[] = [];

			const enrollmentCount = await prisma.enrollmentHeadcount.count({
				where: { versionId, academicPeriod: 'AY2' },
			});
			if (enrollmentCount === 0) missing.push('ENROLLMENT');

			const employeeCount = await prisma.employee.count({
				where: { versionId, status: { not: 'Departed' } },
			});
			if (employeeCount === 0) missing.push('EMPLOYEES');

			if (missing.length > 0) {
				return reply.status(422).send({
					code: 'MISSING_PREREQUISITES',
					message: 'Required data is missing for staffing calculation',
					missing,
				});
			}

			// ════════════════════════════════════════════════════════════════
			// STEP 2: LOAD ALL INPUTS
			// ════════════════════════════════════════════════════════════════

			// 2a: Settings — auto-create if missing (AC-01)
			let settings = await prisma.versionStaffingSettings.findUnique({
				where: { versionId },
			});
			if (!settings) {
				settings = await prisma.versionStaffingSettings.create({
					data: { versionId },
				});
			}

			// 2b: Enrollment AY2 by grade
			const enrollments = await prisma.enrollmentHeadcount.findMany({
				where: { versionId, academicPeriod: 'AY2' },
			});

			// 2c: Grade capacity overrides
			const [gradeLevels, versionCapacityConfigs] = await Promise.all([
				prisma.gradeLevel.findMany({
					select: { gradeCode: true, maxClassSize: true },
				}),
				prisma.versionCapacityConfig.findMany({
					where: { versionId },
					select: { gradeLevel: true, maxClassSize: true },
				}),
			]);
			const gradeMap = new Map(gradeLevels.map((g) => [g.gradeCode, g]));
			const versionCapacityMap = new Map(
				versionCapacityConfigs.map((config) => [config.gradeLevel, config.maxClassSize] as const)
			);

			// 2d: DhgRules (year-filtered) with discipline + serviceProfile
			const dhgRules = await prisma.dhgRule.findMany({
				where: {
					effectiveFromYear: { lte: version.fiscalYear },
					OR: [{ effectiveToYear: null }, { effectiveToYear: { gte: version.fiscalYear } }],
				},
				include: {
					discipline: { select: { code: true } },
					serviceProfile: { select: { code: true } },
				},
			});

			// 2e: Service profiles + version overrides (merged)
			const [serviceProfiles, profileOverrides] = await Promise.all([
				prisma.serviceObligationProfile.findMany(),
				prisma.versionServiceProfileOverride.findMany({
					where: { versionId },
				}),
			]);

			const overrideMap = new Map(profileOverrides.map((o) => [o.serviceProfileId, o]));

			// Build merged profile map keyed by profile code
			const mergedProfiles = new Map<string, DemandServiceProfile>();
			const profileIdToCode = new Map<number, string>();
			for (const sp of serviceProfiles) {
				const override = overrideMap.get(sp.id);
				const weeklyHours = override?.weeklyServiceHours
					? new Decimal(override.weeklyServiceHours.toString())
					: new Decimal(sp.weeklyServiceHours.toString());
				const hsaEligible = override?.hsaEligible ?? sp.hsaEligible;

				mergedProfiles.set(sp.code, { weeklyServiceHours: weeklyHours, hsaEligible });
				profileIdToCode.set(sp.id, sp.code);
			}

			// 2f: Cost assumptions
			const costAssumptions = await prisma.versionStaffingCostAssumption.findMany({
				where: { versionId },
			});

			// 2g: Lycee group assumptions
			const lyceeGroupAssumptions = await prisma.versionLyceeGroupAssumption.findMany({
				where: { versionId },
				include: { discipline: { select: { code: true } } },
			});

			// 2h: Demand overrides
			const demandOverrides = await prisma.demandOverride.findMany({
				where: { versionId },
				include: { discipline: { select: { code: true } } },
			});

			// 2i: Employees (non-Departed) with decrypted salary fields
			const key = getEncryptionKey();

			// Uses parameterized $queryRawUnsafe ($1=key, $2=versionId) to avoid
			// interpolating the encryption key into the SQL string.
			const rawEmployees = await prisma.$queryRawUnsafe<RawEmployee[]>(
				`SELECT e.id, e.employee_code, e.name, e.status, e.is_saudi, e.is_ajeer,
					e.is_teaching, e.joining_date,
					pgp_sym_decrypt(e.base_salary, $1::text) as base_salary,
					pgp_sym_decrypt(e.housing_allowance, $1::text) as housing_allowance,
					pgp_sym_decrypt(e.transport_allowance, $1::text) as transport_allowance,
					pgp_sym_decrypt(e.responsibility_premium, $1::text) as responsibility_premium,
					pgp_sym_decrypt(e.hsa_amount, $1::text) as hsa_amount,
					pgp_sym_decrypt(e.augmentation, $1::text) as augmentation,
					e.ajeer_annual_levy::text as ajeer_annual_levy,
					e.ajeer_monthly_fee::text as ajeer_monthly_fee,
					e.cost_mode, e.record_type,
					e.service_profile_id,
					e.hourly_percentage::text as hourly_percentage
				FROM employees e
				WHERE e.version_id = $2 AND e.status != 'Departed'`,
				key,
				versionId
			);

			// 2j: Staffing assignments with discipline code resolved
			const assignments = await prisma.staffingAssignment.findMany({
				where: { versionId },
				include: {
					employee: {
						select: {
							id: true,
							name: true,
							status: true,
							costMode: true,
							recordType: true,
							hourlyPercentage: true,
						},
					},
					discipline: {
						select: { id: true, code: true },
					},
				},
			});

			// ════════════════════════════════════════════════════════════════
			// STEP 3: RUN DEMAND ENGINE
			// ════════════════════════════════════════════════════════════════

			const enrollmentInputs = enrollments.map((e) => ({
				gradeLevel: e.gradeLevel,
				headcount: e.headcount,
				maxClassSize:
					versionCapacityMap.get(e.gradeLevel) ?? gradeMap.get(e.gradeLevel)?.maxClassSize ?? 28,
			}));

			const rules: DemandRuleInput[] = dhgRules.map((r) => ({
				gradeLevel: r.gradeLevel,
				disciplineCode: r.discipline.code,
				lineType: r.lineType,
				driverType: r.driverType,
				hoursPerUnit: new Decimal(r.hoursPerUnit.toString()),
				serviceProfileCode: r.serviceProfile.code,
				languageCode: r.languageCode,
				groupingKey: r.groupingKey,
			}));

			const groupAssumptions = lyceeGroupAssumptions.map((ga) => ({
				gradeLevel: ga.gradeLevel,
				disciplineCode: ga.discipline.code,
				groupCount: ga.groupCount,
				hoursPerGroup: new Decimal(ga.hoursPerGroup.toString()),
			}));

			const demandInput: DemandEngineInput = {
				enrollments: enrollmentInputs,
				rules,
				groupAssumptions,
				settings: {
					hsaTargetHours: new Decimal(settings.hsaTargetHours.toString()),
					academicWeeks: settings.academicWeeks,
				},
				serviceProfiles: mergedProfiles,
			};

			const demandOutput = calculateDemand(demandInput);

			// ════════════════════════════════════════════════════════════════
			// STEP 4: APPLY DEMAND OVERRIDES (AC-11)
			// ════════════════════════════════════════════════════════════════

			// Build override lookup: key = `${band}|${disciplineCode}|${lineType}`
			const overrideLookup = new Map<string, Decimal>();
			for (const ov of demandOverrides) {
				const ovKey = `${ov.band}|${ov.discipline.code}|${ov.lineType}`;
				overrideLookup.set(ovKey, new Decimal(ov.overrideFte.toString()));
			}

			const overriddenLines: RequirementLine[] = demandOutput.lines.map((line) => {
				const ovKey = `${line.band}|${line.disciplineCode}|${line.lineType}`;
				const overrideFte = overrideLookup.get(ovKey);
				if (overrideFte) {
					return {
						...line,
						requiredFtePlanned: overrideFte,
						recommendedPositions: overrideFte.ceil().toNumber(),
					};
				}
				return line;
			});

			// ════════════════════════════════════════════════════════════════
			// STEP 5: RUN COVERAGE ENGINE (AC-04)
			// ════════════════════════════════════════════════════════════════

			// Build CoverageRequirementLine[] from demand output
			let lineIdCounter = 0;
			const coverageLines: CoverageRequirementLine[] = overriddenLines.map((line) => ({
				id: ++lineIdCounter,
				band: line.band,
				disciplineCode: line.disciplineCode,
				lineType: line.lineType,
				requiredFteRaw: line.requiredFteRaw,
				requiredFtePlanned: line.requiredFtePlanned,
				coveredFte: new Decimal(0),
				gapFte: new Decimal(0),
				coverageStatus: 'UNCOVERED' as const,
				assignedStaffCount: 0,
				vacancyCount: 0,
			}));

			// Build CoverageAssignment[] from DB assignments
			const coverageAssignments: CoverageAssignment[] = assignments.map((a) => ({
				id: a.id,
				employeeId: a.employeeId,
				band: a.band,
				disciplineCode: a.discipline.code,
				hoursPerWeek: new Decimal(a.hoursPerWeek.toString()),
				fteShare: new Decimal(a.fteShare.toString()),
				employeeRecordType: a.employee.recordType,
				employeeStatus: a.employee.status,
				employeeCostMode: a.employee.costMode,
				hourlyPercentage: new Decimal(a.employee.hourlyPercentage.toString()),
				employeeName: a.employee.name,
			}));

			// All teaching employee IDs for UNASSIGNED_TEACHER detection
			const allTeachingEmployeeIds = rawEmployees.filter((e) => e.is_teaching).map((e) => e.id);

			const coverageOutput = calculateCoverage({
				requirementLines: coverageLines,
				assignments: coverageAssignments,
				allTeachingEmployeeIds,
			});

			const warnings: CoverageWarning[] = coverageOutput.warnings;

			// ════════════════════════════════════════════════════════════════
			// STEP 6: RUN HSA ENGINE (AC-05)
			// ════════════════════════════════════════════════════════════════

			const hsaInput: HsaInput = {
				hsaTargetHours: new Decimal(settings.hsaTargetHours.toString()),
				hsaFirstHourRate: new Decimal(settings.hsaFirstHourRate.toString()),
				hsaAdditionalHourRate: new Decimal(settings.hsaAdditionalHourRate.toString()),
				hsaMonths: settings.hsaMonths,
			};

			const hsaOutput = calculateHsa(hsaInput);

			// Build a set of HSA-eligible employee IDs.
			// HSA applies when: serviceProfile.hsaEligible === true
			//   AND costMode === 'LOCAL_PAYROLL'
			const hsaEligibleEmployeeIds = new Set<number>();
			for (const emp of rawEmployees) {
				if (emp.cost_mode !== 'LOCAL_PAYROLL') continue;
				if (!emp.service_profile_id) continue;
				const profileCode = profileIdToCode.get(emp.service_profile_id);
				if (!profileCode) continue;
				const profile = mergedProfiles.get(profileCode);
				if (profile?.hsaEligible) {
					hsaEligibleEmployeeIds.add(emp.id);
				}
			}

			// Apply HSA amount to eligible employees (in-memory, for cost engine)
			const employeeHsaMap = new Map<number, string>();
			for (const emp of rawEmployees) {
				if (hsaEligibleEmployeeIds.has(emp.id)) {
					employeeHsaMap.set(
						emp.id,
						hsaOutput.hsaCostPerMonth.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4)
					);
				} else {
					employeeHsaMap.set(emp.id, '0');
				}
			}

			// ════════════════════════════════════════════════════════════════
			// STEP 7: RUN COST ENGINE (AC-06)
			// ════════════════════════════════════════════════════════════════

			const asOfDate = new Date(Date.UTC(version.fiscalYear, 11, 31));

			interface EmployeeCostResult {
				employeeId: number;
				months: { month: number; totalCost: Decimal; adjustedGross: Decimal }[];
				eos: {
					yearsOfService: Decimal;
					eosBase: Decimal;
					eosAnnual: Decimal;
					eosMonthlyAccrual: Decimal;
				};
				fullMonths: ReturnType<typeof calculateEmployeeAnnualCost>['months'];
				annualCost: Decimal;
			}

			const employeeCostResults: EmployeeCostResult[] = [];
			const monthlyAdjustedGrossTotals = new Map<number, Decimal>();
			for (let m = 1; m <= 12; m++) {
				monthlyAdjustedGrossTotals.set(m, new Decimal(0));
			}

			for (const emp of rawEmployees) {
				const costMode = (emp.cost_mode || 'LOCAL_PAYROLL') as CostMode;

				const costInput: EmployeeCostInput = {
					baseSalary: emp.base_salary ?? '0',
					housingAllowance: emp.housing_allowance ?? '0',
					transportAllowance: emp.transport_allowance ?? '0',
					responsibilityPremium: emp.responsibility_premium ?? '0',
					hsaAmount: employeeHsaMap.get(emp.id) ?? '0',
					augmentation: emp.augmentation ?? '0',
					isTeaching: emp.is_teaching,
					isSaudi: emp.is_saudi,
					isAjeer: emp.is_ajeer,
					status: emp.status as 'Existing' | 'New' | 'Departed',
					ajeerAnnualLevy: emp.ajeer_annual_levy ?? '0',
					ajeerMonthlyFee: emp.ajeer_monthly_fee ?? '0',
					hireDate: emp.joining_date,
					asOfDate,
					costMode,
				};

				const { months, eos } = calculateEmployeeAnnualCost(costInput);

				let annualCost = new Decimal(0);
				const monthSummaries = months.map((m) => {
					annualCost = annualCost.plus(m.totalCost);
					// Only accumulate LOCAL_PAYROLL adjusted gross for category costs
					if (costMode === 'LOCAL_PAYROLL') {
						const prev = monthlyAdjustedGrossTotals.get(m.month) ?? new Decimal(0);
						monthlyAdjustedGrossTotals.set(m.month, prev.plus(m.adjustedGross));
					}
					return {
						month: m.month,
						totalCost: m.totalCost,
						adjustedGross: m.adjustedGross,
					};
				});

				employeeCostResults.push({
					employeeId: emp.id,
					months: monthSummaries,
					eos,
					fullMonths: months,
					annualCost,
				});
			}

			// ════════════════════════════════════════════════════════════════
			// STEP 8: RUN CATEGORY COST ENGINE (AC-07)
			// ════════════════════════════════════════════════════════════════

			// Compute totalTeachingFteRaw from demand lines
			const totalTeachingFteRaw = overriddenLines.reduce(
				(sum, line) => sum.plus(line.requiredFteRaw),
				new Decimal(0)
			);

			const categoryAssumptions: CategoryAssumption[] = costAssumptions.map((a) => ({
				category: a.category,
				calculationMode: a.calculationMode as CalculationMode,
				value: new Decimal(a.value.toString()),
			}));

			const categoryCosts = calculateConfigurableCategoryMonthlyCosts({
				assumptions: categoryAssumptions,
				monthlySubtotals: monthlyAdjustedGrossTotals,
				totalTeachingFteRaw,
			});

			// ════════════════════════════════════════════════════════════════
			// STEP 9: AGGREGATE COSTS ONTO REQUIREMENT LINES (AC-08)
			// ════════════════════════════════════════════════════════════════

			// Build employee annual cost lookup
			const employeeAnnualCostMap = new Map<number, Decimal>();
			for (const result of employeeCostResults) {
				employeeAnnualCostMap.set(result.employeeId, result.annualCost);
			}

			// For each coverage line, compute directCostAnnual and hsaCostAnnual
			// by summing assigned employee costs proportional to fteShare
			interface FinalLine {
				band: string;
				disciplineCode: string;
				lineLabel: string;
				lineType: string;
				driverType: string;
				serviceProfileCode: string;
				totalDriverUnits: number;
				totalWeeklyHours: Decimal;
				baseOrs: Decimal;
				effectiveOrs: Decimal;
				requiredFteRaw: Decimal;
				requiredFtePlanned: Decimal;
				recommendedPositions: number;
				coveredFte: Decimal;
				gapFte: Decimal;
				coverageStatus: string;
				assignedStaffCount: number;
				vacancyCount: number;
				directCostAnnual: Decimal;
				hsaCostAnnual: Decimal;
			}

			const finalLines: FinalLine[] = coverageOutput.updatedLines.map((covLine, idx) => {
				const demandLine = overriddenLines[idx]!;
				// Find assignments matching this line by (band, disciplineCode)
				const matchingAssignments = assignments.filter(
					(a) =>
						a.band === covLine.band &&
						a.discipline.code === covLine.disciplineCode &&
						a.employee.status !== 'Departed'
				);

				let directCostAnnual = new Decimal(0);
				let hsaCostAnnual = new Decimal(0);

				for (const a of matchingAssignments) {
					const empAnnualCost = employeeAnnualCostMap.get(a.employeeId) ?? new Decimal(0);
					const fteShare = new Decimal(a.fteShare.toString());

					// directCostAnnual = SUM(employeeAnnualCost * fteShare)
					directCostAnnual = directCostAnnual.plus(empAnnualCost.times(fteShare));

					// hsaCostAnnual: HSA per teacher * count of HSA-eligible
					if (hsaEligibleEmployeeIds.has(a.employeeId)) {
						hsaCostAnnual = hsaCostAnnual.plus(hsaOutput.hsaAnnualPerTeacher.times(fteShare));
					}
				}

				return {
					band: demandLine.band,
					disciplineCode: demandLine.disciplineCode,
					lineLabel: demandLine.lineLabel,
					lineType: demandLine.lineType,
					driverType: demandLine.driverType,
					serviceProfileCode: demandLine.serviceProfileCode,
					totalDriverUnits: demandLine.totalDriverUnits,
					totalWeeklyHours: demandLine.totalWeeklyHours,
					baseOrs: demandLine.baseOrs,
					effectiveOrs: demandLine.effectiveOrs,
					requiredFteRaw: demandLine.requiredFteRaw,
					requiredFtePlanned: demandLine.requiredFtePlanned,
					recommendedPositions: demandLine.recommendedPositions,
					coveredFte: covLine.coveredFte,
					gapFte: covLine.gapFte,
					coverageStatus: covLine.coverageStatus,
					assignedStaffCount: covLine.assignedStaffCount,
					vacancyCount: covLine.vacancyCount,
					directCostAnnual: directCostAnnual.toDecimalPlaces(4, Decimal.ROUND_HALF_UP),
					hsaCostAnnual: hsaCostAnnual.toDecimalPlaces(4, Decimal.ROUND_HALF_UP),
				};
			});

			// ════════════════════════════════════════════════════════════════
			// STEP 10: PERSIST ALL IN SINGLE $TRANSACTION (AC-09, AC-10)
			// ════════════════════════════════════════════════════════════════

			// Build discipline code -> id lookup for source persistence
			const disciplineCodeToId = new Map<string, number>();
			for (const rule of dhgRules) {
				disciplineCodeToId.set(rule.discipline.code, rule.disciplineId);
			}
			// Also include discipline IDs from demand overrides
			for (const ov of demandOverrides) {
				disciplineCodeToId.set(ov.discipline.code, ov.disciplineId);
			}

			await prisma.$transaction(async (tx) => {
				// Delete old derived rows
				await Promise.all([
					tx.teachingRequirementSource.deleteMany({
						where: { versionId },
					}),
					tx.teachingRequirementLine.deleteMany({
						where: { versionId },
					}),
					tx.monthlyStaffCost.deleteMany({ where: { versionId } }),
					tx.eosProvision.deleteMany({ where: { versionId } }),
					tx.categoryMonthlyCost.deleteMany({ where: { versionId } }),
				]);

				// Insert TeachingRequirementSource rows
				const sourceData = demandOutput.sources
					.filter((s) => {
						const discId = disciplineCodeToId.get(s.disciplineCode);
						return discId != null;
					})
					.map((s: RequirementSource) => ({
						versionId,
						gradeLevel: s.gradeLevel,
						disciplineId: disciplineCodeToId.get(s.disciplineCode)!,
						lineType: s.lineType,
						driverType: s.driverType,
						headcount: s.headcount,
						maxClassSize: s.maxClassSize,
						driverUnits: s.driverUnits,
						hoursPerUnit: s.hoursPerUnit.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2),
						totalWeeklyHours: s.totalWeeklyHours
							.toDecimalPlaces(4, Decimal.ROUND_HALF_UP)
							.toFixed(4),
						calculatedAt,
					}));

				if (sourceData.length > 0) {
					await tx.teachingRequirementSource.createMany({
						data: sourceData,
					});
				}

				// Insert TeachingRequirementLine rows
				if (finalLines.length > 0) {
					await tx.teachingRequirementLine.createMany({
						data: finalLines.map((line) => ({
							versionId,
							band: line.band,
							disciplineCode: line.disciplineCode,
							lineLabel: line.lineLabel,
							lineType: line.lineType,
							driverType: line.driverType,
							serviceProfileCode: line.serviceProfileCode,
							totalDriverUnits: line.totalDriverUnits,
							totalWeeklyHours: line.totalWeeklyHours
								.toDecimalPlaces(4, Decimal.ROUND_HALF_UP)
								.toFixed(4),
							baseOrs: line.baseOrs.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2),
							effectiveOrs: line.effectiveOrs.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2),
							requiredFteRaw: line.requiredFteRaw
								.toDecimalPlaces(4, Decimal.ROUND_HALF_UP)
								.toFixed(4),
							requiredFtePlanned: line.requiredFtePlanned
								.toDecimalPlaces(4, Decimal.ROUND_HALF_UP)
								.toFixed(4),
							recommendedPositions: line.recommendedPositions,
							coveredFte: line.coveredFte.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4),
							gapFte: line.gapFte.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4),
							coverageStatus: line.coverageStatus,
							assignedStaffCount: line.assignedStaffCount,
							vacancyCount: line.vacancyCount,
							directCostAnnual: line.directCostAnnual.toFixed(4),
							hsaCostAnnual: line.hsaCostAnnual.toFixed(4),
							calculatedAt,
						})),
					});
				}

				// Insert MonthlyStaffCost + EosProvision per employee
				for (const result of employeeCostResults) {
					if (result.fullMonths.length > 0) {
						await tx.monthlyStaffCost.createMany({
							data: result.fullMonths.map((m) => ({
								versionId,
								employeeId: result.employeeId,
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
								calculatedAt,
							})),
						});
					}

					await tx.eosProvision.create({
						data: {
							versionId,
							employeeId: result.employeeId,
							yearsOfService: result.eos.yearsOfService.toFixed(4),
							eosBase: result.eos.eosBase.toFixed(4),
							eosAnnual: result.eos.eosAnnual.toFixed(4),
							eosMonthlyAccrual: result.eos.eosMonthlyAccrual.toFixed(4),
							asOfDate,
							calculatedAt,
						},
					});
				}

				// Insert CategoryMonthlyCost rows
				if (categoryCosts.length > 0) {
					await tx.categoryMonthlyCost.createMany({
						data: categoryCosts.map((c) => ({
							versionId,
							month: c.month,
							category: c.category,
							amount: c.amount.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4),
							calculationMode: c.calculationMode ?? 'PERCENT_OF_PAYROLL',
							calculatedBy: request.user.id,
							calculatedAt,
						})),
					});
				}

				// Update HSA amounts on eligible employees via pgcrypto
				for (const empId of hsaEligibleEmployeeIds) {
					await tx.$executeRawUnsafe(
						`UPDATE employees SET hsa_amount = pgp_sym_encrypt($1, $2) ` + `WHERE id = $3`,
						hsaOutput.hsaCostPerMonth.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4),
						key,
						empId
					);
				}

				// Update stale modules: remove STAFFING, add PNL
				const staleSet = new Set(version.staleModules);
				staleSet.delete('STAFFING');
				staleSet.add('PNL');

				await tx.budgetVersion.update({
					where: { id: versionId },
					data: { staleModules: [...staleSet] },
				});
			});

			// ════════════════════════════════════════════════════════════════
			// STEP 11: AUDIT LOG + RETURN SUMMARY (AC-12)
			// ════════════════════════════════════════════════════════════════

			const totalFteNeeded = finalLines.reduce(
				(sum, l) => sum.plus(l.requiredFteRaw),
				new Decimal(0)
			);
			const totalFteCovered = finalLines.reduce((sum, l) => sum.plus(l.coveredFte), new Decimal(0));
			const totalGap = finalLines.reduce((sum, l) => sum.plus(l.gapFte), new Decimal(0));

			let totalCost = new Decimal(0);
			for (const result of employeeCostResults) {
				totalCost = totalCost.plus(result.annualCost);
			}
			for (const c of categoryCosts) {
				totalCost = totalCost.plus(c.amount);
			}

			const durationMs = Date.now() - startTime;

			// Audit log (outside transaction — informational)
			await prisma.calculationAuditLog.create({
				data: {
					versionId,
					runId,
					module: 'STAFFING',
					status: 'COMPLETED',
					completedAt: new Date(),
					durationMs,
					inputSummary: {
						employees: rawEmployees.length,
						enrollments: enrollments.length,
						dhgRules: dhgRules.length,
						assignments: assignments.length,
						costAssumptions: costAssumptions.length,
					},
					outputSummary: {
						totalFteNeeded: totalFteNeeded.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4),
						totalFteCovered: totalFteCovered.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4),
						totalGap: totalGap.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4),
						totalCost: totalCost.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4),
						warningCount: warnings.length,
						sourceRows: demandOutput.sources.length,
						lineRows: finalLines.length,
					},
					triggeredBy: request.user.id,
				},
			});

			return {
				runId,
				durationMs,
				summary: {
					totalFteNeeded: totalFteNeeded.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4),
					totalFteCovered: totalFteCovered.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4),
					totalGap: totalGap.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4),
					totalCost: totalCost.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4),
					warningCount: warnings.length,
				},
			};
		},
	});
}

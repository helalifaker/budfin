// Staffing Data Migration — Populate Employee fields + seed VersionStaffingSettings/CostAssumptions
// Run: pnpm --filter @budfin/api exec tsx src/migration/scripts/staffing-data-migration.ts
//
// Safe to run multiple times (idempotent). Supports --dry-run flag.

import type { PrismaClient } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { MigrationLogger } from '../lib/logger.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ExceptionEntry {
	employeeId: number;
	employeeCode: string;
	name: string;
	field: string;
	reason: string;
}

export interface MigrationResult {
	employeesProcessed: number;
	profilesAssigned: number;
	disciplinesResolved: number;
	bandsResolved: number;
	exceptions: ExceptionEntry[];
	settingsSeeded: number;
	assumptionsSeeded: number;
}

// ── Constants ────────────────────────────────────────────────────────────────

const COST_ASSUMPTION_DEFAULTS: Array<{
	category: string;
	calculationMode: string;
	value: string;
	excludeSummerMonths: boolean;
}> = [
	{
		category: 'REMPLACEMENTS',
		calculationMode: 'PERCENT_OF_PAYROLL',
		value: '0.0113',
		excludeSummerMonths: true,
	},
	{
		category: 'FORMATION',
		calculationMode: 'PERCENT_OF_PAYROLL',
		value: '0.0127',
		excludeSummerMonths: false,
	},
	{
		category: 'RESIDENT_SALAIRES',
		calculationMode: 'FLAT_ANNUAL',
		value: '0',
		excludeSummerMonths: true,
	},
	{
		category: 'RESIDENT_LOGEMENT',
		calculationMode: 'FLAT_ANNUAL',
		value: '0',
		excludeSummerMonths: true,
	},
	{
		category: 'RESIDENT_PENSION',
		calculationMode: 'FLAT_ANNUAL',
		value: '837000.0000',
		excludeSummerMonths: true,
	},
];

// ── Heuristic mapping helpers ────────────────────────────────────────────────

/**
 * Resolve service profile code from department + functionRole + isTeaching.
 * Returns the profile code string or null for non-teaching staff.
 *
 * Priority order (AC-02):
 * 1. Maternelle + ASEM → ASEM
 * 2. Maternelle or Elementaire → PE
 * 3. EPS or Sport → EPS
 * 4. Arabe or Islamique → ARABIC_ISLAMIC
 * 5. Documentaliste → DOCUMENTALISTE
 * 6. Agrege/Agrégé → AGREGE
 * 7. isTeaching → CERTIFIE
 * 8. Otherwise → null
 */
export function resolveServiceProfileCode(
	department: string,
	functionRole: string,
	isTeaching: boolean
): string | null {
	const deptLower = department.toLowerCase();
	const roleLower = functionRole.toLowerCase();

	// 1. Maternelle ASEM
	if (deptLower.includes('maternelle') && roleLower.includes('asem')) {
		return 'ASEM';
	}

	// 2. Maternelle or Elementaire → PE
	if (deptLower.includes('maternelle') || deptLower.includes('elementaire')) {
		return 'PE';
	}

	// 3. EPS / Sport
	if (roleLower.includes('eps') || roleLower.includes('sport')) {
		return 'EPS';
	}

	// 4. Arabe / Islamique
	if (roleLower.includes('arabe') || roleLower.includes('islamique')) {
		return 'ARABIC_ISLAMIC';
	}

	// 5. Documentaliste
	if (roleLower.includes('documentaliste')) {
		return 'DOCUMENTALISTE';
	}

	// 6. Agrege / Agrégé
	if (roleLower.includes('agrege') || roleLower.includes('agrégé')) {
		return 'AGREGE';
	}

	// 7. Teaching default
	if (isTeaching) {
		return 'CERTIFIE';
	}

	// 8. Non-teaching
	return null;
}

/**
 * Resolve home band from department name (AC-04).
 */
export function resolveHomeBand(department: string): string | null {
	const deptLower = department.toLowerCase();

	if (deptLower.includes('maternelle')) return 'MATERNELLE';
	if (deptLower.includes('elementaire') || deptLower.includes('élémentaire')) return 'ELEMENTAIRE';
	if (deptLower.includes('college') || deptLower.includes('collège')) return 'COLLEGE';
	if (deptLower.includes('lycee') || deptLower.includes('lycée')) return 'LYCEE';

	return null;
}

// ── Main migration function ──────────────────────────────────────────────────

export async function migrateStaffingData(
	prisma: PrismaClient,
	options?: { dryRun?: boolean }
): Promise<MigrationResult> {
	const dryRun = options?.dryRun ?? false;
	const logger = new MigrationLogger('staffing-data-migration');

	const result: MigrationResult = {
		employeesProcessed: 0,
		profilesAssigned: 0,
		disciplinesResolved: 0,
		bandsResolved: 0,
		exceptions: [],
		settingsSeeded: 0,
		assumptionsSeeded: 0,
	};

	try {
		await prisma.$transaction(
			async (tx) => {
				// ── Phase 1: Load lookup tables ──────────────────────────────────────

				// Load service profiles into a code → id map
				const serviceProfiles = await tx.serviceObligationProfile.findMany({
					select: { id: true, code: true },
				});
				const profileCodeToId = new Map<string, number>();
				for (const sp of serviceProfiles) {
					profileCodeToId.set(sp.code, sp.id);
				}

				// Load discipline aliases into an alias → disciplineId map
				// Normalize aliases to lowercase for case-insensitive matching
				const disciplineAliases = await tx.disciplineAlias.findMany({
					select: { alias: true, disciplineId: true },
				});
				const aliasToDiscId = new Map<string, number>();
				for (const da of disciplineAliases) {
					aliasToDiscId.set(da.alias.toLowerCase(), da.disciplineId);
				}

				// ── Phase 2: Update employees ───────────────────────────────────────

				const employees = await tx.employee.findMany({
					select: {
						id: true,
						employeeCode: true,
						name: true,
						functionRole: true,
						department: true,
						isTeaching: true,
					},
				});

				for (const emp of employees) {
					result.employeesProcessed++;

					// AC-01: Default fields
					const updateData: Prisma.EmployeeUpdateInput = {
						recordType: 'EMPLOYEE',
						costMode: 'LOCAL_PAYROLL',
					};

					// AC-02: Service profile assignment
					const profileCode = resolveServiceProfileCode(
						emp.department,
						emp.functionRole,
						emp.isTeaching
					);
					if (profileCode) {
						const profileId = profileCodeToId.get(profileCode);
						if (profileId) {
							updateData.serviceProfile = { connect: { id: profileId } };
							result.profilesAssigned++;
						} else {
							result.exceptions.push({
								employeeId: emp.id,
								employeeCode: emp.employeeCode,
								name: emp.name,
								field: 'serviceProfileId',
								reason: `Resolved profile code '${profileCode}' not found in service_obligation_profiles table`,
							});
						}
					}

					// AC-03: Discipline resolution via DisciplineAlias
					const functionRoleLower = emp.functionRole.toLowerCase();
					const disciplineId = aliasToDiscId.get(functionRoleLower);
					if (disciplineId !== undefined) {
						updateData.discipline = { connect: { id: disciplineId } };
						result.disciplinesResolved++;
					} else if (emp.isTeaching) {
						// Only log exception for teaching staff — non-teaching are expected
						// to not have a discipline
						result.exceptions.push({
							employeeId: emp.id,
							employeeCode: emp.employeeCode,
							name: emp.name,
							field: 'disciplineId',
							reason: `No DisciplineAlias found for functionRole '${emp.functionRole}'`,
						});
					}

					// AC-04: Home band resolution
					const homeBand = resolveHomeBand(emp.department);
					if (homeBand) {
						updateData.homeBand = homeBand;
						result.bandsResolved++;
					}

					await tx.employee.update({
						where: { id: emp.id },
						data: updateData,
					});
				}

				logger.addRowCount('employees', result.employeesProcessed);

				// ── Phase 3: Seed VersionStaffingSettings (AC-06) ───────────────────

				const versions = await tx.budgetVersion.findMany({
					select: { id: true },
				});

				for (const version of versions) {
					const existing = await tx.versionStaffingSettings.findUnique({
						where: { versionId: version.id },
						select: { id: true },
					});

					if (!existing) {
						await tx.versionStaffingSettings.create({
							data: {
								versionId: version.id,
							},
						});
						result.settingsSeeded++;
					}
				}

				logger.addRowCount('version_staffing_settings', result.settingsSeeded);

				// ── Phase 4: Seed VersionStaffingCostAssumption (AC-07) ──────────────

				for (const version of versions) {
					for (const assumption of COST_ASSUMPTION_DEFAULTS) {
						await tx.versionStaffingCostAssumption.upsert({
							where: {
								versionId_category: {
									versionId: version.id,
									category: assumption.category,
								},
							},
							update: {},
							create: {
								versionId: version.id,
								category: assumption.category,
								calculationMode: assumption.calculationMode,
								value: assumption.value,
							},
						});
					}
					result.assumptionsSeeded += COST_ASSUMPTION_DEFAULTS.length;
				}

				logger.addRowCount('version_staffing_cost_assumptions', result.assumptionsSeeded);

				// AC-10: Dry-run — throw to trigger transaction rollback
				if (dryRun) {
					throw new DryRunRollback();
				}
			},
			{
				// Allow a generous timeout for large employee sets
				timeout: 120_000,
			}
		);

		logger.complete('SUCCESS');
	} catch (err) {
		if (err instanceof DryRunRollback) {
			// Expected — dry run completed successfully, transaction was rolled back
			logger.complete('SUCCESS');
		} else {
			logger.error({
				code: 'STAFFING_MIGRATION_FAILED',
				message: err instanceof Error ? err.message : String(err),
				fatal: true,
			});
			logger.complete('FAILED');
			throw err;
		}
	}

	// AC-09: Verification logging
	logVerification(logger, result);

	return result;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Sentinel error used to trigger transaction rollback in dry-run mode.
 * Not a real error — caught explicitly by the migration runner.
 */
class DryRunRollback extends Error {
	constructor() {
		super('Dry run — rolling back transaction');
		this.name = 'DryRunRollback';
	}
}

/**
 * Log verification summary (AC-09).
 */
function logVerification(logger: MigrationLogger, result: MigrationResult): void {
	for (const exc of result.exceptions) {
		logger.warn({
			code: 'UNRESOLVED_FIELD',
			message: `[${exc.employeeCode}] ${exc.name}: ${exc.field} — ${exc.reason}`,
			field: exc.field,
			value: exc.employeeCode,
		});
	}

	logger.printSummary();
}

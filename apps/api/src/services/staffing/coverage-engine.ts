import { Decimal } from 'decimal.js';

// ── Input Types ──────────────────────────────────────────────────────────────

export interface CoverageRequirementLine {
	id: number;
	band: string;
	disciplineCode: string;
	lineType: string;
	requiredFteRaw: Decimal;
	requiredFtePlanned: Decimal;
	// Filled by the engine:
	coveredFte: Decimal;
	gapFte: Decimal;
	coverageStatus: CoverageStatus;
	assignedStaffCount: number;
	vacancyCount: number;
}

export interface CoverageAssignment {
	id: number;
	employeeId: number;
	band: string;
	disciplineCode: string;
	hoursPerWeek: Decimal;
	fteShare: Decimal;
	employeeRecordType: string; // 'EMPLOYEE' | 'VACANCY'
	employeeStatus: string; // 'Existing' | 'New' | 'Departed'
	employeeCostMode: string; // 'LOCAL_PAYROLL' | 'AEFE_RECHARGE' | 'NO_LOCAL_COST'
	hourlyPercentage: Decimal;
	employeeName: string;
}

export type CoverageWarningType =
	| 'OVER_ASSIGNED'
	| 'ORPHANED_ASSIGNMENT'
	| 'UNASSIGNED_TEACHER'
	| 'DEPARTED_WITH_ASSIGNMENTS'
	| 'RECHARGE_COVERAGE';

export interface CoverageWarning {
	type: CoverageWarningType;
	employeeId?: number;
	band?: string;
	disciplineCode?: string;
	message: string;
}

export type CoverageStatus = 'UNCOVERED' | 'DEFICIT' | 'SURPLUS' | 'COVERED';

export interface CoverageEngineInput {
	requirementLines: CoverageRequirementLine[];
	assignments: CoverageAssignment[];
	allTeachingEmployeeIds: number[];
}

export interface CoverageEngineOutput {
	updatedLines: CoverageRequirementLine[];
	warnings: CoverageWarning[];
}

// ── Threshold Constants ─────────────────────────────────────────────────────

const DEFICIT_THRESHOLD = new Decimal('-0.25');
const SURPLUS_THRESHOLD = new Decimal('0.25');

// ── Coverage Status Determination ───────────────────────────────────────────

function determineCoverageStatus(gapFte: Decimal, hasAssignments: boolean): CoverageStatus {
	if (!hasAssignments) return 'UNCOVERED';
	if (gapFte.lt(DEFICIT_THRESHOLD)) return 'DEFICIT';
	if (gapFte.gt(SURPLUS_THRESHOLD)) return 'SURPLUS';
	return 'COVERED';
}

// ── Coverage Engine (Pure Function) ─────────────────────────────────────────

export function calculateCoverage(input: CoverageEngineInput): CoverageEngineOutput {
	const { requirementLines, assignments, allTeachingEmployeeIds } = input;
	const warnings: CoverageWarning[] = [];

	// STEP 1: Separate departed employees from active assignments (AC-11)
	const departedAssignments = assignments.filter((a) => a.employeeStatus === 'Departed');
	const activeAssignments = assignments.filter((a) => a.employeeStatus !== 'Departed');

	// STEP 2: Emit DEPARTED_WITH_ASSIGNMENTS warnings (AC-07)
	const departedEmployeeIds = new Set<number>();
	for (const a of departedAssignments) {
		if (!departedEmployeeIds.has(a.employeeId)) {
			departedEmployeeIds.add(a.employeeId);
			warnings.push({
				type: 'DEPARTED_WITH_ASSIGNMENTS',
				employeeId: a.employeeId,
				message:
					`Departed employee "${a.employeeName}" (ID: ${a.employeeId}) ` +
					`has active assignments that should be reassigned`,
			});
		}
	}

	// STEP 3: Build requirement line lookup by (band, disciplineCode)
	const lineKey = (band: string, disciplineCode: string) => `${band}|${disciplineCode}`;

	const lineKeySet = new Set<string>();
	for (const line of requirementLines) {
		lineKeySet.add(lineKey(line.band, line.disciplineCode));
	}

	// STEP 4: Group active assignments by (band, disciplineCode)
	const assignmentsByLineKey = new Map<string, CoverageAssignment[]>();
	const orphanedAssignments: CoverageAssignment[] = [];

	for (const a of activeAssignments) {
		const key = lineKey(a.band, a.disciplineCode);
		if (!lineKeySet.has(key)) {
			// AC-06: Orphaned assignment — no matching requirement line
			orphanedAssignments.push(a);
			continue;
		}
		const existing = assignmentsByLineKey.get(key);
		if (existing) {
			existing.push(a);
		} else {
			assignmentsByLineKey.set(key, [a]);
		}
	}

	// STEP 5: Emit ORPHANED_ASSIGNMENT warnings (AC-06)
	for (const a of orphanedAssignments) {
		warnings.push({
			type: 'ORPHANED_ASSIGNMENT',
			employeeId: a.employeeId,
			band: a.band,
			disciplineCode: a.disciplineCode,
			message:
				`Assignment for "${a.employeeName}" (ID: ${a.employeeId}) ` +
				`references (${a.band}, ${a.disciplineCode}) which has no matching ` +
				`requirement line`,
		});
	}

	// STEP 6: Compute coverage per requirement line (AC-01, AC-02, AC-03)
	const updatedLines: CoverageRequirementLine[] = requirementLines.map((line) => {
		const key = lineKey(line.band, line.disciplineCode);
		const matched = assignmentsByLineKey.get(key) ?? [];

		// AC-01: coveredFte = SUM(fteShare) of active (non-Departed) assignments
		const coveredFte = matched.reduce((acc, a) => acc.plus(a.fteShare), new Decimal(0));

		// AC-02: gapFte = coveredFte - requiredFteRaw
		const gapFte = coveredFte.minus(line.requiredFteRaw);

		// AC-03: Coverage status determination
		const coverageStatus = determineCoverageStatus(gapFte, matched.length > 0);

		// AC-04: Count EMPLOYEE records and VACANCY records
		let assignedStaffCount = 0;
		let vacancyCount = 0;
		for (const a of matched) {
			if (a.employeeRecordType === 'EMPLOYEE') {
				assignedStaffCount++;
			} else if (a.employeeRecordType === 'VACANCY') {
				vacancyCount++;
			}
		}

		// AC-09: Emit RECHARGE_COVERAGE warning when line has AEFE_RECHARGE employees
		const rechargeAssignments = matched.filter((a) => a.employeeCostMode === 'AEFE_RECHARGE');
		if (rechargeAssignments.length > 0) {
			for (const a of rechargeAssignments) {
				warnings.push({
					type: 'RECHARGE_COVERAGE',
					employeeId: a.employeeId,
					band: line.band,
					disciplineCode: line.disciplineCode,
					message:
						`Requirement line (${line.band}, ${line.disciplineCode}) is ` +
						`covered by AEFE_RECHARGE employee "${a.employeeName}" ` +
						`(ID: ${a.employeeId})`,
				});
			}
		}

		return {
			...line,
			coveredFte,
			gapFte,
			coverageStatus,
			assignedStaffCount,
			vacancyCount,
		};
	});

	// STEP 7: Per-employee OVER_ASSIGNED validation (AC-05)
	// Group all assignments (including orphans) by employeeId and sum fteShare
	const employeeFteMap = new Map<
		number,
		{ totalFte: Decimal; hourlyPercentage: Decimal; name: string }
	>();
	for (const a of activeAssignments) {
		const existing = employeeFteMap.get(a.employeeId);
		if (existing) {
			existing.totalFte = existing.totalFte.plus(a.fteShare);
		} else {
			employeeFteMap.set(a.employeeId, {
				totalFte: new Decimal(a.fteShare),
				hourlyPercentage: a.hourlyPercentage,
				name: a.employeeName,
			});
		}
	}

	for (const [employeeId, data] of employeeFteMap) {
		if (data.totalFte.gt(data.hourlyPercentage)) {
			warnings.push({
				type: 'OVER_ASSIGNED',
				employeeId,
				message:
					`Employee "${data.name}" (ID: ${employeeId}) total FTE share ` +
					`(${data.totalFte.toFixed(4)}) exceeds hourly percentage ` +
					`(${data.hourlyPercentage.toFixed(4)})`,
			});
		}
	}

	// STEP 8: UNASSIGNED_TEACHER detection (AC-08)
	// Teaching employees not in any active assignment
	const assignedEmployeeIds = new Set<number>();
	for (const a of activeAssignments) {
		assignedEmployeeIds.add(a.employeeId);
	}
	// Also include departed employees with assignments — they are "assigned" (just excluded
	// from coverage). The UNASSIGNED_TEACHER warning is about teachers with zero assignments.
	for (const a of departedAssignments) {
		assignedEmployeeIds.add(a.employeeId);
	}

	for (const teacherId of allTeachingEmployeeIds) {
		if (!assignedEmployeeIds.has(teacherId)) {
			warnings.push({
				type: 'UNASSIGNED_TEACHER',
				employeeId: teacherId,
				message: `Teaching employee (ID: ${teacherId}) has no staffing assignments`,
			});
		}
	}

	return { updatedLines, warnings };
}

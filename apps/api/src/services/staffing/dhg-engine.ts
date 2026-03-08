import { Decimal } from 'decimal.js';

const ORS_DIVISOR = new Decimal(18); // Obligation Réglementaire de Service
const ACADEMIC_WEEKS = 36;

export interface DhgGrilleRow {
	gradeLevel: string;
	subject: string;
	dhgType: string;
	hoursPerWeekPerSection: string; // decimal string
}

export interface EnrollmentInput {
	gradeLevel: string;
	headcount: number;
	maxClassSize: number;
}

export interface DhgResult {
	gradeLevel: string;
	sectionsNeeded: number;
	totalWeeklyHours: Decimal;
	totalAnnualHours: Decimal;
	fte: Decimal;
}

/**
 * AC-09: sections_needed = CEILING(headcount / max_class_size)
 * When headcount is 0, sections_needed is 0 (not 1).
 */
export function calculateSectionsNeeded(headcount: number, maxClassSize: number): number {
	if (headcount <= 0) return 0;
	return Math.ceil(headcount / maxClassSize);
}

/**
 * AC-10: Compute FTE for a single grade.
 * total_weekly_hours = SUM(hours_per_week_per_section * sections_needed)
 * total_annual_hours = total_weekly_hours * 36
 * fte = total_weekly_hours / 18
 */
export function calculateFTE(
	sectionsNeeded: number,
	grillRows: DhgGrilleRow[]
): { totalWeeklyHours: Decimal; totalAnnualHours: Decimal; fte: Decimal } {
	let totalWeeklyHours = new Decimal(0);

	for (const row of grillRows) {
		totalWeeklyHours = totalWeeklyHours.plus(
			new Decimal(row.hoursPerWeekPerSection).times(sectionsNeeded)
		);
	}

	const totalAnnualHours = totalWeeklyHours.times(ACADEMIC_WEEKS);
	const fte = totalWeeklyHours.div(ORS_DIVISOR);

	return { totalWeeklyHours, totalAnnualHours, fte };
}

/**
 * AC-11: Calculate DHG requirements for all grades.
 * Groups grille rows by grade, computes sections from enrollment,
 * then computes FTE per grade.
 */
export function calculateDHG(
	enrollments: EnrollmentInput[],
	grilleRows: DhgGrilleRow[]
): DhgResult[] {
	// Group grille rows by grade
	const grilleByGrade = new Map<string, DhgGrilleRow[]>();
	for (const row of grilleRows) {
		const existing = grilleByGrade.get(row.gradeLevel) ?? [];
		existing.push(row);
		grilleByGrade.set(row.gradeLevel, existing);
	}

	const results: DhgResult[] = [];

	for (const enrollment of enrollments) {
		const sectionsNeeded = calculateSectionsNeeded(enrollment.headcount, enrollment.maxClassSize);

		const gradeGrille = grilleByGrade.get(enrollment.gradeLevel) ?? [];
		const { totalWeeklyHours, totalAnnualHours, fte } = calculateFTE(sectionsNeeded, gradeGrille);

		results.push({
			gradeLevel: enrollment.gradeLevel,
			sectionsNeeded,
			totalWeeklyHours,
			totalAnnualHours,
			fte,
		});
	}

	return results;
}

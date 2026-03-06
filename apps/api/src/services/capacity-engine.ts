// Capacity calculation engine — pure functions, no DB dependencies
// Story #83: ACs 10-15

export interface GradeConfig {
	gradeCode: string;
	maxClassSize: number;
	plafondPct: number; // as decimal, e.g. 1.1
}

export interface CapacityInput {
	gradeLevel: string;
	academicPeriod: string;
	headcount: number;
}

export interface CapacityOutput {
	gradeLevel: string;
	academicPeriod: string;
	headcount: number;
	maxClassSize: number;
	sectionsNeeded: number;
	utilization: number;
	alert: 'OVER' | 'NEAR_CAP' | 'OK' | 'UNDER' | null;
	recruitmentSlots: number;
}

/**
 * Calculate capacity metrics for each grade based on enrollment headcount
 * and GradeLevel master data.
 *
 * AC-10: sections = CEILING(headcount / maxClassSize)
 * AC-11: headcount=0 → sections=0, utilization=0%, no alert
 * AC-12: traffic-light alerts (OVER > 100%, NEAR_CAP > 95%, OK >= 70%, UNDER < 70%)
 * AC-15: recruitment_slots = floor(sections * maxClassSize * plafondPct) - headcount
 */
export function calculateCapacity(
	inputs: CapacityInput[],
	gradeConfigs: Map<string, GradeConfig>
): CapacityOutput[] {
	return inputs.map((input) => {
		const config = gradeConfigs.get(input.gradeLevel);
		if (!config) {
			throw new Error(`Unknown grade: ${input.gradeLevel}`);
		}

		// AC-11: headcount=0 → sections=0, utilization=0%, no alert
		if (input.headcount === 0) {
			return {
				gradeLevel: input.gradeLevel,
				academicPeriod: input.academicPeriod,
				headcount: 0,
				maxClassSize: config.maxClassSize,
				sectionsNeeded: 0,
				utilization: 0,
				alert: null,
				recruitmentSlots: 0,
			};
		}

		// AC-10: sections = CEILING(headcount / maxClassSize)
		const sectionsNeeded = Math.ceil(input.headcount / config.maxClassSize);

		// utilization = (headcount / (sections * maxClassSize)) * 100
		const totalCapacity = sectionsNeeded * config.maxClassSize;
		const utilization = (input.headcount / totalCapacity) * 100;

		// AC-12: traffic-light alerts
		let alert: CapacityOutput['alert'] = null;
		if (utilization > 100) alert = 'OVER';
		else if (utilization > 95) alert = 'NEAR_CAP';
		else if (utilization >= 70) alert = 'OK';
		else alert = 'UNDER';

		// AC-15: recruitment_slots = floor(sections * maxClassSize * plafondPct) - headcount
		const recruitmentSlots = Math.floor(totalCapacity * config.plafondPct) - input.headcount;

		return {
			gradeLevel: input.gradeLevel,
			academicPeriod: input.academicPeriod,
			headcount: input.headcount,
			maxClassSize: config.maxClassSize,
			sectionsNeeded,
			utilization: Math.round(utilization * 10) / 10,
			alert,
			recruitmentSlots,
		};
	});
}

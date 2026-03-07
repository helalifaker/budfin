import { gradeLevels } from './seed-data.js';

export const VALID_GRADE_CODES = gradeLevels.map((g) => g.gradeCode);

export const GRADE_BAND_MAP: Record<string, string> = Object.fromEntries(
	gradeLevels.map((g) => [g.gradeCode, g.band])
);

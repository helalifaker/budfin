import { Decimal } from 'decimal.js';

/**
 * YEARFRAC US 30/360 implementation matching Excel YEARFRAC(start, end, 0).
 *
 * Algorithm (TDD 4.4.3, TC-002):
 *   Day-31 adjustment:
 *     if (day1 === 31) day1 = 30
 *     if (day2 === 31 && day1 >= 30) day2 = 30
 *   result = ((year2 - year1) * 360 + (month2 - month1) * 30 + (day2 - day1)) / 360
 */
export function yearFrac(startDate: Date, endDate: Date): Decimal {
	let day1 = startDate.getUTCDate();
	const month1 = startDate.getUTCMonth() + 1;
	const year1 = startDate.getUTCFullYear();

	let day2 = endDate.getUTCDate();
	const month2 = endDate.getUTCMonth() + 1;
	const year2 = endDate.getUTCFullYear();

	if (day1 === 31) day1 = 30;
	if (day2 === 31 && day1 >= 30) day2 = 30;

	const numerator = (year2 - year1) * 360 + (month2 - month1) * 30 + (day2 - day1);
	return new Decimal(numerator).div(360);
}

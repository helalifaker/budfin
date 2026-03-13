import { describe, it, expect } from 'vitest';
import { loadFixture, loadEnrollmentCsv } from './fixture-loader.js';

describe('loadFixture', () => {
	it('loads fy2026-discounts.json correctly', () => {
		const discounts =
			loadFixture<Array<{ tariff: string; discountRate: string }>>('fy2026-discounts.json');
		expect(discounts).toHaveLength(3);
		expect(discounts[0]).toHaveProperty('tariff');
		expect(discounts[0]).toHaveProperty('discountRate');
	});

	it('loads grade-code-mapping.json with 15 grades', () => {
		const grades = loadFixture<Array<{ appCode: string }>>('grade-code-mapping.json');
		expect(grades).toHaveLength(15);
	});
});

describe('loadEnrollmentCsv', () => {
	it('loads enrollment_2021-22.csv with 15 rows', () => {
		const rows = loadEnrollmentCsv('enrollment_2021-22.csv');
		expect(rows).toHaveLength(15);
		expect(rows[0]).toEqual({ level_code: 'PS', student_count: 60 });
	});

	it('total student count for 2021-22 is 1434', () => {
		const rows = loadEnrollmentCsv('enrollment_2021-22.csv');
		const total = rows.reduce((sum, r) => sum + r.student_count, 0);
		expect(total).toBe(1434);
	});

	it('loads all 5 CSVs with correct totals', () => {
		const expectedTotals: Record<string, number> = {
			'enrollment_2021-22.csv': 1434,
			'enrollment_2022-23.csv': 1499,
			'enrollment_2023-24.csv': 1587,
			'enrollment_2024-25.csv': 1794,
			'enrollment_2025-26.csv': 1753,
		};

		for (const [file, expected] of Object.entries(expectedTotals)) {
			const rows = loadEnrollmentCsv(file);
			const total = rows.reduce((sum, r) => sum + r.student_count, 0);
			expect(total).toBe(expected);
		}
	});
});

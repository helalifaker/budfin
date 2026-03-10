import { describe, it, expect } from 'vitest';
import { calculateBaselineRetention } from './enrollment-seeding';
import type { HistoricalDataPoint } from '../hooks/use-enrollment';

function makeData(entries: Array<[string, number, number]>): HistoricalDataPoint[] {
	return entries.map(([gradeLevel, academicYear, headcount]) => ({
		gradeLevel,
		academicYear,
		headcount,
	}));
}

describe('calculateBaselineRetention', () => {
	it('returns 0 retention for PS grade', () => {
		const data = makeData([
			['PS', 2022, 50],
			['PS', 2023, 55],
			['PS', 2024, 60],
		]);
		const result = calculateBaselineRetention(data, ['PS']);
		expect(result).toHaveLength(1);
		expect(result[0]!.gradeLevel).toBe('PS');
		expect(result[0]!.suggestedRetention).toBe(0);
		expect(result[0]!.suggestedLaterals).toBe(0);
	});

	it('detects growing grade and suggests 0.97 retention with laterals', () => {
		// CP->CE1: prior (CP) stable at 30, CE1 growing 30->35->42 (>5% YoY growth)
		const data = makeData([
			['CP', 2022, 30],
			['CP', 2023, 30],
			['CP', 2024, 30],
			['CE1', 2022, 30],
			['CE1', 2023, 35],
			['CE1', 2024, 42],
		]);
		const result = calculateBaselineRetention(data, ['CE1']);
		expect(result[0]!.suggestedRetention).toBe(0.97);
		expect(result[0]!.suggestedLaterals).toBeGreaterThan(0);
		expect(result[0]!.confidence).toBe('medium');
	});

	it('detects declining grade and suggests observed retention with 0 laterals', () => {
		// 3EME->2NDE: 3EME has 100, 2NDE gets ~90 (declining)
		const data = makeData([
			['3EME', 2021, 100],
			['3EME', 2022, 100],
			['3EME', 2023, 100],
			['2NDE', 2021, 95],
			['2NDE', 2022, 92],
			['2NDE', 2023, 88],
			['2NDE', 2024, 85],
		]);
		const result = calculateBaselineRetention(data, ['2NDE']);
		expect(result[0]!.suggestedRetention).toBeLessThan(0.97);
		expect(result[0]!.suggestedLaterals).toBe(0);
		expect(result[0]!.confidence).toBe('high');
	});

	it('returns default retention for grade with <2 years of data', () => {
		const data = makeData([
			['CP', 2024, 30],
			['CE1', 2024, 28],
		]);
		const result = calculateBaselineRetention(data, ['CE1']);
		expect(result[0]!.suggestedRetention).toBe(0.97);
		expect(result[0]!.suggestedLaterals).toBe(0);
		expect(result[0]!.confidence).toBe('low');
	});

	it('handles zero headcount years by skipping them', () => {
		const data = makeData([
			['CM2', 2021, 40],
			['CM2', 2022, 0], // Zero year — skip
			['CM2', 2023, 42],
			['6EME', 2022, 38],
			['6EME', 2023, 0], // Zero year — skip
			['6EME', 2024, 40],
		]);
		const result = calculateBaselineRetention(data, ['6EME']);
		// 2 valid pairs: (2021->2022: CM2=40->6EME=38) and (2023->2024: CM2=42->6EME=40)
		// Zero years are skipped but 2 valid pairs remain -> medium confidence
		expect(result[0]!.confidence).toBe('medium');
	});

	it('handles TERM grade (1ERE->TERM progression)', () => {
		const data = makeData([
			['1ERE', 2021, 50],
			['1ERE', 2022, 50],
			['1ERE', 2023, 50],
			['TERM', 2022, 48],
			['TERM', 2023, 47],
			['TERM', 2024, 46],
		]);
		const result = calculateBaselineRetention(data, ['TERM']);
		expect(result[0]!.gradeLevel).toBe('TERM');
		expect(result[0]!.suggestedRetention).toBeGreaterThan(0);
		expect(result[0]!.suggestedRetention).toBeLessThanOrEqual(0.97);
	});

	it('handles stable grade (no growth, no decline)', () => {
		const data = makeData([
			['CE2', 2021, 30],
			['CE2', 2022, 30],
			['CE2', 2023, 30],
			['CM1', 2022, 29],
			['CM1', 2023, 29],
			['CM1', 2024, 29],
		]);
		const result = calculateBaselineRetention(data, ['CM1']);
		// Stable: retention should be close to observed (~0.967)
		expect(result[0]!.suggestedRetention).toBeLessThanOrEqual(0.97);
		expect(result[0]!.suggestedLaterals).toBe(0);
	});

	it('processes multiple grades at once', () => {
		const data = makeData([
			['PS', 2022, 50],
			['PS', 2023, 55],
			['MS', 2023, 48],
			['MS', 2024, 52],
		]);
		const result = calculateBaselineRetention(data, ['PS', 'MS']);
		expect(result).toHaveLength(2);
		expect(result[0]!.gradeLevel).toBe('PS');
		expect(result[1]!.gradeLevel).toBe('MS');
	});

	it('returns empty array for empty input', () => {
		const result = calculateBaselineRetention([], []);
		expect(result).toHaveLength(0);
	});
});

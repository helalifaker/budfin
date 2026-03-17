import { describe, expect, it } from 'vitest';
import { Decimal } from 'decimal.js';
import { gradeLevels, seedAssumptions } from './lib/seed-data.js';

describe('seed data constants', () => {
	it('has exactly 15 grade levels', () => {
		expect(gradeLevels).toHaveLength(15);
	});

	it('has exactly 20 assumptions', () => {
		expect(seedAssumptions).toHaveLength(20);
	});

	it('grade levels have unique codes', () => {
		const codes = gradeLevels.map((g) => g.gradeCode);
		expect(new Set(codes).size).toBe(codes.length);
	});

	it('grade levels have sequential display orders 1-15', () => {
		const orders = gradeLevels.map((g) => g.displayOrder);
		expect(orders).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));
	});

	it('assumptions have unique keys', () => {
		const keys = seedAssumptions.map((a) => a.key);
		expect(new Set(keys).size).toBe(keys.length);
	});

	it('GOSI sub-components sum to 12.25% using decimal.js', () => {
		const gosiKeys = ['gosiPension', 'gosiSaned', 'gosiOhi'];
		const gosiAssumptions = seedAssumptions.filter((a) => gosiKeys.includes(a.key));
		expect(gosiAssumptions).toHaveLength(3);

		const total = gosiAssumptions.reduce(
			(sum, a) => sum.plus(new Decimal(a.value)),
			new Decimal(0)
		);
		expect(total.toFixed(2)).toBe('12.25');
	});

	it('all grade bands are valid', () => {
		const validBands = ['MATERNELLE', 'ELEMENTAIRE', 'COLLEGE', 'LYCEE'];
		for (const grade of gradeLevels) {
			expect(validBands).toContain(grade.band);
		}
	});

	it('all assumption valueTypes are valid', () => {
		const validTypes = ['PERCENTAGE', 'CURRENCY', 'INTEGER', 'DECIMAL', 'TEXT'];
		for (const assumption of seedAssumptions) {
			expect(validTypes).toContain(assumption.valueType);
		}
	});
});

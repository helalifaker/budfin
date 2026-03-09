import { describe, it, expect } from 'vitest';
import { staffCostConfigs } from './seed-config.js';

describe('staffCostConfigs seed data', () => {
	const expectedKeys = [
		'remplacements_rate',
		'formation_rate',
		'resident_salary_annual',
		'resident_logement_annual',
	];

	it('contains exactly 4 config entries', () => {
		expect(staffCostConfigs).toHaveLength(4);
	});

	it('contains all expected keys', () => {
		const keys = staffCostConfigs.map((c) => c.key);
		expect(keys).toEqual(expectedKeys);
	});

	it('all entries have dataType "decimal"', () => {
		for (const config of staffCostConfigs) {
			expect(config.dataType).toBe('decimal');
		}
	});

	it('all values are valid decimal strings', () => {
		const decimalPattern = /^\d+(\.\d+)?$/;
		for (const config of staffCostConfigs) {
			expect(config.value, `${config.key} value "${config.value}" is not a valid decimal`).toMatch(
				decimalPattern
			);
		}
	});

	it('remplacements_rate is 0.02', () => {
		const entry = staffCostConfigs.find((c) => c.key === 'remplacements_rate');
		expect(entry?.value).toBe('0.02');
	});

	it('formation_rate is 0.01', () => {
		const entry = staffCostConfigs.find((c) => c.key === 'formation_rate');
		expect(entry?.value).toBe('0.01');
	});

	it('resident_salary_annual defaults to 0', () => {
		const entry = staffCostConfigs.find((c) => c.key === 'resident_salary_annual');
		expect(entry?.value).toBe('0');
	});

	it('resident_logement_annual defaults to 0', () => {
		const entry = staffCostConfigs.find((c) => c.key === 'resident_logement_annual');
		expect(entry?.value).toBe('0');
	});

	it('every entry has a non-empty description', () => {
		for (const config of staffCostConfigs) {
			expect(config.description.length).toBeGreaterThan(0);
		}
	});
});

import { describe, it, expect } from 'vitest';
import { findInvalidLateralWeightEntry } from './lateral-weight-validation.js';

describe('findInvalidLateralWeightEntry', () => {
	it('returns null for empty entries', () => {
		expect(findInvalidLateralWeightEntry([])).toBeNull();
	});

	it('skips entries with negative lateralEntryCount', () => {
		const result = findInvalidLateralWeightEntry([
			{
				gradeLevel: 'GS',
				lateralEntryCount: -11,
				lateralWeightFr: 0,
				lateralWeightNat: 0,
				lateralWeightAut: 0,
			},
		]);
		expect(result).toBeNull();
	});

	it('skips entries with zero lateralEntryCount', () => {
		const result = findInvalidLateralWeightEntry([
			{
				gradeLevel: 'CP',
				lateralEntryCount: 0,
				lateralWeightFr: 0.5,
				lateralWeightNat: 0.3,
				lateralWeightAut: 0.1,
			},
		]);
		expect(result).toBeNull();
	});

	it('skips entries with null lateralEntryCount', () => {
		const result = findInvalidLateralWeightEntry([
			{
				gradeLevel: 'CP',
				lateralEntryCount: null,
				lateralWeightFr: 0.5,
				lateralWeightNat: 0.3,
				lateralWeightAut: 0.1,
			},
		]);
		expect(result).toBeNull();
	});

	it('allows positive lateralEntryCount when all weights are zero (pure manual adjustment)', () => {
		const result = findInvalidLateralWeightEntry([
			{
				gradeLevel: 'GS',
				lateralEntryCount: 7,
				lateralWeightFr: 0,
				lateralWeightNat: 0,
				lateralWeightAut: 0,
			},
		]);
		expect(result).toBeNull();
	});

	it('allows positive lateralEntryCount when all weights are null (pure manual adjustment)', () => {
		const result = findInvalidLateralWeightEntry([
			{
				gradeLevel: 'GS',
				lateralEntryCount: 7,
				lateralWeightFr: null,
				lateralWeightNat: null,
				lateralWeightAut: null,
			},
		]);
		expect(result).toBeNull();
	});

	it('allows positive lateralEntryCount when weights sum to 1.0', () => {
		const result = findInvalidLateralWeightEntry([
			{
				gradeLevel: 'CP',
				lateralEntryCount: 5,
				lateralWeightFr: 0.5,
				lateralWeightNat: 0.3,
				lateralWeightAut: 0.2,
			},
		]);
		expect(result).toBeNull();
	});

	it('allows weights within tolerance of 1.0', () => {
		const result = findInvalidLateralWeightEntry([
			{
				gradeLevel: 'CP',
				lateralEntryCount: 3,
				lateralWeightFr: 0.5,
				lateralWeightNat: 0.3,
				lateralWeightAut: 0.205,
			},
		]);
		expect(result).toBeNull();
	});

	it('returns invalid entry when weights do not sum to 1.0', () => {
		const result = findInvalidLateralWeightEntry([
			{
				gradeLevel: 'CP',
				lateralEntryCount: 5,
				lateralWeightFr: 0.5,
				lateralWeightNat: 0.3,
				lateralWeightAut: 0.1,
			},
		]);
		expect(result).toEqual({ gradeLevel: 'CP', weightSum: 0.9 });
	});

	it('returns the first invalid entry when multiple exist', () => {
		const result = findInvalidLateralWeightEntry([
			{
				gradeLevel: 'GS',
				lateralEntryCount: 7,
				lateralWeightFr: 0,
				lateralWeightNat: 0,
				lateralWeightAut: 0,
			},
			{
				gradeLevel: 'CP',
				lateralEntryCount: 5,
				lateralWeightFr: 0.5,
				lateralWeightNat: 0.3,
				lateralWeightAut: 0.1,
			},
			{
				gradeLevel: 'CE1',
				lateralEntryCount: 3,
				lateralWeightFr: 0.2,
				lateralWeightNat: 0.1,
				lateralWeightAut: 0.1,
			},
		]);
		expect(result).toEqual({ gradeLevel: 'CP', weightSum: 0.9 });
	});

	it('rejects when only some weights are non-zero but do not sum to 1.0', () => {
		const result = findInvalidLateralWeightEntry([
			{
				gradeLevel: 'MS',
				lateralEntryCount: 2,
				lateralWeightFr: 0.5,
				lateralWeightNat: 0,
				lateralWeightAut: 0,
			},
		]);
		expect(result).toEqual({ gradeLevel: 'MS', weightSum: 0.5 });
	});
});

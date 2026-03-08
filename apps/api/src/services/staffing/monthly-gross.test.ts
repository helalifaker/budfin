import { describe, it, expect } from 'vitest';
import { Decimal } from 'decimal.js';
import { calculateMonthlyGross, type MonthlyGrossInput } from './monthly-gross.js';

function makeInput(overrides: Partial<MonthlyGrossInput> = {}): MonthlyGrossInput {
	return {
		baseSalary: '10000.0000',
		housingAllowance: '2500.0000',
		transportAllowance: '500.0000',
		responsibilityPremium: '1000.0000',
		hsaAmount: '1500.0000',
		augmentation: '0.0300', // 3%
		isTeaching: true,
		...overrides,
	};
}

describe('calculateMonthlyGross', () => {
	describe('AC-13: September augmentation step-change', () => {
		it('months 1-8 use pre-augmentation salary', () => {
			const input = makeInput();
			for (let month = 1; month <= 8; month++) {
				const result = calculateMonthlyGross(input, month);
				// No augmentation applied for months 1-8
				// adjusted_gross = 10000 + 2500 + 500 + 1000 + HSA
				// (HSA depends on teaching + month, tested separately)
				if (month !== 7 && month !== 8) {
					expect(result.adjustedGross.toString()).toBe('15500');
				}
			}
		});

		it('months 9-12 apply augmentation to base + allowances (not HSA)', () => {
			const input = makeInput();
			const result = calculateMonthlyGross(input, 9);
			// augmented base = 10000 * 1.03 = 10300
			// augmented housing = 2500 * 1.03 = 2575
			// augmented transport = 500 * 1.03 = 515
			// augmented responsibility = 1000 * 1.03 = 1030
			// HSA = 1500 (not augmented)
			// total = 10300 + 2575 + 515 + 1030 + 1500 = 15920
			expect(result.adjustedGross.toString()).toBe('15920');
		});

		it('augmentation applies to all 4 components', () => {
			const input = makeInput();
			const result = calculateMonthlyGross(input, 10);
			expect(result.housingAllowance.toString()).toBe('2575');
			expect(result.transportAllowance.toString()).toBe('515');
			expect(result.responsibilityPremium.toString()).toBe('1030');
		});

		it('zero augmentation means no change in Sep-Dec', () => {
			const input = makeInput({ augmentation: '0.0000' });
			const jan = calculateMonthlyGross(input, 1);
			const sep = calculateMonthlyGross(input, 9);
			// Both should be the same (with HSA since month 1 and 9 are not summer)
			expect(jan.adjustedGross.toString()).toBe(sep.adjustedGross.toString());
		});

		it('HSA is NOT subject to augmentation', () => {
			const input = makeInput({ isTeaching: false }); // non-teaching = HSA year-round
			const result = calculateMonthlyGross(input, 9);
			expect(result.hsaAmount.toString()).toBe('1500');
		});
	});

	describe('AC-14: HSA summer exclusion', () => {
		it('teaching staff HSA=0 for month 7 (July)', () => {
			const input = makeInput({ isTeaching: true });
			const result = calculateMonthlyGross(input, 7);
			expect(result.hsaAmount.toString()).toBe('0');
		});

		it('teaching staff HSA=0 for month 8 (August)', () => {
			const input = makeInput({ isTeaching: true });
			const result = calculateMonthlyGross(input, 8);
			expect(result.hsaAmount.toString()).toBe('0');
		});

		it('teaching staff HSA present for non-summer months', () => {
			const input = makeInput({ isTeaching: true });
			for (const month of [1, 2, 3, 4, 5, 6, 9, 10, 11, 12]) {
				const result = calculateMonthlyGross(input, month);
				expect(result.hsaAmount.toString()).toBe('1500');
			}
		});

		it('non-teaching staff receive HSA year-round', () => {
			const input = makeInput({ isTeaching: false });
			for (let month = 1; month <= 12; month++) {
				const result = calculateMonthlyGross(input, month);
				expect(result.hsaAmount.toString()).toBe('1500');
			}
		});

		it('adjustedGross reflects HSA exclusion', () => {
			const input = makeInput({ isTeaching: true, augmentation: '0.0000' });
			const june = calculateMonthlyGross(input, 6);
			const july = calculateMonthlyGross(input, 7);
			// June: 10000 + 2500 + 500 + 1000 + 1500 = 15500
			// July: 10000 + 2500 + 500 + 1000 + 0 = 14000
			expect(june.adjustedGross.toString()).toBe('15500');
			expect(july.adjustedGross.toString()).toBe('14000');
		});
	});

	describe('AC-28: Decimal.js precision', () => {
		it('returns Decimal instances', () => {
			const result = calculateMonthlyGross(makeInput(), 1);
			expect(result.baseGross).toBeInstanceOf(Decimal);
			expect(result.adjustedGross).toBeInstanceOf(Decimal);
			expect(result.housingAllowance).toBeInstanceOf(Decimal);
			expect(result.hsaAmount).toBeInstanceOf(Decimal);
		});

		it('handles precise augmentation without floating-point drift', () => {
			const input = makeInput({
				baseSalary: '15432.5678',
				augmentation: '0.0350',
			});
			const result = calculateMonthlyGross(input, 9);
			// 15432.5678 * 1.035 = 15972.7076530
			expect(result.adjustedGross.toFixed(4)).not.toBe('NaN');
			const expected = new Decimal('15432.5678').times('1.035');
			expect(
				result.adjustedGross
					.minus(result.housingAllowance)
					.minus(result.transportAllowance)
					.minus(result.responsibilityPremium)
					.minus(result.hsaAmount)
					.toString()
			).toBe(expected.toString());
		});
	});

	describe('baseGross (pre-augmentation total)', () => {
		it('is always the sum of un-augmented components', () => {
			const input = makeInput();
			const sep = calculateMonthlyGross(input, 9);
			// baseGross should always be 10000+2500+500+1000+1500 = 15500
			expect(sep.baseGross.toString()).toBe('15500');
		});
	});
});

import { describe, expect, it } from 'vitest';
import Decimal from 'decimal.js';
import { formatMoney } from './format-money';

describe('formatMoney', () => {
	it('formats a number with fr-FR locale grouping', () => {
		const result = formatMoney(1234567);
		expect(result).toContain('1');
		expect(result).toContain('234');
		expect(result).toContain('567');
	});

	it('formats zero', () => {
		expect(formatMoney(0)).toBe('0');
	});

	it('formats a string value', () => {
		const result = formatMoney('50000');
		expect(result).toContain('50');
		expect(result).toContain('000');
	});

	it('formats a Decimal value', () => {
		const result = formatMoney(new Decimal('99999.99'));
		expect(result).toContain('100');
		expect(result).toContain('000');
	});

	it('appends SAR when showCurrency is true', () => {
		const result = formatMoney(1000, { showCurrency: true });
		expect(result).toContain('SAR');
		expect(result).toContain('1');
		expect(result).toContain('000');
	});

	it('does not append SAR when showCurrency is false', () => {
		const result = formatMoney(1000, { showCurrency: false });
		expect(result).not.toContain('SAR');
	});

	it('uses compact notation when compact is true', () => {
		const result = formatMoney(34500, { compact: true });
		expect(result.length).toBeLessThan(10);
	});

	it('uses compact notation with SAR', () => {
		const result = formatMoney(34500, { compact: true, showCurrency: true });
		expect(result).toContain('SAR');
	});

	it('handles negative numbers', () => {
		const result = formatMoney(-5000);
		expect(result).toContain('5');
		expect(result).toContain('000');
	});

	it('handles very large numbers', () => {
		const result = formatMoney(1000000000);
		expect(result).toContain('1');
		expect(result).toContain('000');
	});

	it('handles small decimal values by rounding to integer', () => {
		const result = formatMoney(0.49);
		expect(result).toBe('0');
	});

	describe('millions option', () => {
		it('formats a basic value in millions', () => {
			expect(formatMoney('5400000', { millions: true })).toBe('5.4M');
		});

		it('formats millions with currency', () => {
			expect(formatMoney('5400000', { millions: true, showCurrency: true })).toBe('5.4M SAR');
		});

		it('formats a value less than 1M', () => {
			expect(formatMoney('500000', { millions: true })).toBe('0.5M');
		});

		it('formats zero in millions', () => {
			expect(formatMoney('0', { millions: true })).toBe('0.0M');
		});

		it('formats negative value in millions', () => {
			expect(formatMoney('-2000000', { millions: true })).toBe('-2.0M');
		});

		it('formats a large value in millions with rounding', () => {
			expect(formatMoney('12345678', { millions: true })).toBe('12.3M');
		});
	});
});

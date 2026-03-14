import Decimal from 'decimal.js';

export function formatMoney(
	value: number | Decimal | string,
	options?: {
		showCurrency?: boolean;
		compact?: boolean;
	}
): string {
	const num =
		typeof value === 'string'
			? parseFloat(value)
			: value instanceof Decimal
				? value.toNumber()
				: value;

	if (options?.compact) {
		const formatter = new Intl.NumberFormat('fr-FR', {
			notation: 'compact',
			maximumFractionDigits: 1,
		});
		const result = formatter.format(num);
		return options.showCurrency ? `${result} SAR` : result;
	}

	const formatter = new Intl.NumberFormat('fr-FR', {
		maximumFractionDigits: 0,
	});
	const result = formatter.format(num);
	return options?.showCurrency ? `${result} SAR` : result;
}

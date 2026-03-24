import Decimal from 'decimal.js';

export function formatMoney(
	value: number | Decimal | string,
	options?: {
		showCurrency?: boolean;
		compact?: boolean;
		millions?: boolean;
	}
): string {
	const num =
		typeof value === 'string'
			? parseFloat(value)
			: value instanceof Decimal
				? value.toNumber()
				: value;

	if (options?.millions) {
		const d =
			typeof value === 'string'
				? new Decimal(value)
				: value instanceof Decimal
					? value
					: new Decimal(value);
		const mVal = d.div(1_000_000).toDecimalPlaces(1, Decimal.ROUND_HALF_UP);
		const formatted = mVal.toFixed(1);
		return options.showCurrency ? `${formatted}M SAR` : `${formatted}M`;
	}

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

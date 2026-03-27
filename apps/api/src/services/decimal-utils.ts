// Shared decimal formatting utilities for monetary calculations.
// TC-001: All monetary arithmetic uses Decimal.js with ROUND_HALF_UP.

import { Decimal } from 'decimal.js';

export function toFixed4(d: Decimal): string {
	return d.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4);
}

export function toFixed2(d: Decimal): string {
	return d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
}

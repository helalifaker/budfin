import type { FeeGridEntry, FeeScheduleRow } from '@budfin/types';
import Decimal from 'decimal.js';

// ── Field mapping ───────────────────────────────────────────────────────────
// Maps fee schedule display fields to FeeGridEntry property names.

const FIELD_MAP: Record<string, keyof FeeGridEntry> = {
	dai: 'dai',
	tuitionHt: 'tuitionHt',
	tuitionTtc: 'tuitionTtc',
};

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Apply a single cell edit from the fee schedule grid back to the flat FeeGridEntry array.
 *
 * - editable-source: 1:1 update (single grade)
 * - editable-fanout: update ALL underlying grade rows with the same new value
 * - summary-only: throws an error (should never be called for read-only rows)
 *
 * When tuitionTtc is edited, auto-derives tuitionHt and term amounts (40/30/30 split).
 */
export function writebackFeeScheduleEdit(
	originalEntries: FeeGridEntry[],
	editedRow: FeeScheduleRow,
	field: string,
	newValue: string
): FeeGridEntry[] {
	if (editedRow.editability === 'summary-only') {
		throw new Error(`Cannot edit summary-only row "${editedRow.label}". This row is read-only.`);
	}

	const entryField = FIELD_MAP[field];
	if (!entryField) {
		throw new Error(
			`Unknown fee schedule field "${field}". Valid fields: ${Object.keys(FIELD_MAP).join(', ')}`
		);
	}

	const gradeCodes = editedRow.sourceGrades ?? [];
	const nationality = editedRow.sourceNationality;

	if (gradeCodes.length === 0 || !nationality) {
		throw new Error(`Cannot resolve fee grid sources for row "${editedRow.id}".`);
	}

	return originalEntries.map((entry) => {
		const isTarget =
			gradeCodes.includes(entry.gradeLevel) &&
			entry.nationality === nationality &&
			entry.tariff === 'Plein';

		if (!isTarget) {
			return entry;
		}

		const nextEntry = { ...entry, [entryField]: newValue };

		if (entryField === 'tuitionTtc') {
			const vatRate = entry.nationality === 'Nationaux' ? new Decimal(0) : new Decimal('0.15');
			const ttc = new Decimal(newValue);
			nextEntry.tuitionHt = ttc
				.div(new Decimal(1).plus(vatRate))
				.toDecimalPlaces(4, Decimal.ROUND_HALF_UP)
				.toFixed(4);
			const term1 = ttc.mul(new Decimal('0.40')).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
			const term2 = ttc.mul(new Decimal('0.30')).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
			const term3 = ttc.minus(term1).minus(term2);
			nextEntry.term1Amount = term1.toFixed(4);
			nextEntry.term2Amount = term2.toFixed(4);
			nextEntry.term3Amount = term3.toFixed(4);
		}

		if (entryField === 'tuitionHt') {
			const vatRate = entry.nationality === 'Nationaux' ? new Decimal(0) : new Decimal('0.15');
			nextEntry.tuitionTtc = new Decimal(newValue).mul(new Decimal(1).plus(vatRate)).toFixed(4);
		}

		return nextEntry;
	});
}

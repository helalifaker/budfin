import type { FeeGridEntry, FeeScheduleRow } from '@budfin/types';
import { TUITION_BANDS } from './fee-schedule-builder';

// ── Field mapping ───────────────────────────────────────────────────────────
// Maps fee schedule display fields to FeeGridEntry property names.

const FIELD_MAP: Record<string, keyof FeeGridEntry> = {
	dai: 'dai',
	tuitionHt: 'tuitionHt',
	term1: 'term1Amount',
	term2: 'term2Amount',
	term3: 'term3Amount',
	totalTtc: 'tuitionTtc',
};

/**
 * Resolve which grade codes a given FeeScheduleRow maps to,
 * based on the row ID convention: `tuition-{nationality}-{bandId}`.
 */
function resolveGradeCodes(rowId: string): string[] {
	for (const band of TUITION_BANDS) {
		if (rowId.includes(band.id)) {
			return band.grades;
		}
	}
	return [];
}

/**
 * Extract the nationality from a tuition row ID.
 * Row IDs follow the pattern: `tuition-{nationality}-{bandId}`.
 */
function resolveNationality(rowId: string): string | null {
	const match = rowId.match(/^tuition-(\w+)-/);
	return match?.[1] ?? null;
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Apply a single cell edit from the fee schedule grid back to the flat FeeGridEntry array.
 *
 * - editable-source: 1:1 update (single grade)
 * - editable-fanout: update ALL underlying grade rows with the same new value
 * - summary-only: throws an error (should never be called for read-only rows)
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

	const gradeCodes = resolveGradeCodes(editedRow.id);
	const nationality = resolveNationality(editedRow.id);

	if (gradeCodes.length === 0 || !nationality) {
		throw new Error(`Cannot resolve grade codes or nationality from row ID "${editedRow.id}".`);
	}

	return originalEntries.map((entry) => {
		const isTarget =
			gradeCodes.includes(entry.gradeLevel) &&
			entry.nationality === nationality &&
			entry.tariff === 'Plein';

		if (!isTarget) {
			return entry;
		}

		return { ...entry, [entryField]: newValue };
	});
}

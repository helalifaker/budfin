import { describe, expect, it } from 'vitest';
import { buildCapacityPreviewRow, getCapacityAlertForUtilization } from './enrollment-workspace';

describe('enrollment workspace capacity alerts', () => {
	it('keeps UNDER for preview rows below the utilization floor', () => {
		const row = buildCapacityPreviewRow({
			gradeLevel: 'CP',
			academicPeriod: 'AY2',
			headcount: 19,
			maxClassSize: 28,
			plafondPct: 1,
		});

		expect(row.utilization).toBeCloseTo(67.9, 1);
		expect(row.alert).toBe('UNDER');
	});

	it('returns null for zero-utilization previews', () => {
		expect(getCapacityAlertForUtilization(0)).toBeNull();
	});
});

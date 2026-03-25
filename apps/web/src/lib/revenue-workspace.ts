import Decimal from 'decimal.js';
import type { RevenueResultsResponse, RevenueSettingsTab, RevenueViewMode } from '@budfin/types';
import type { GradeLevel } from '../hooks/use-grade-levels';
import { BAND_LABELS } from './band-styles';
import { formatMoney } from './format-money';

export type RevenueForecastPeriod = 'AY1' | 'AY2' | 'both';
export type RevenueRowType = 'data' | 'subtotal' | 'total' | 'group-header';
export type RevenueIssueTag = 'missing-fees' | 'missing-tariffs' | 'high-discount' | 'zero-revenue';
export type RevenueExceptionFilterValue = RevenueIssueTag | 'all';

export interface RevenueGridRowIdentity {
	id: string;
	code: string;
	label: string;
	viewMode: RevenueViewMode;
	rowType: RevenueRowType;
	band?: string;
	groupKey?: string;
	settingsTarget?: RevenueSettingsTab;
	issueTags?: RevenueIssueTag[];
}

export interface RevenueForecastGridRow {
	id: string;
	code: string;
	label: string;
	viewMode: RevenueViewMode;
	rowType: RevenueRowType;
	band?: string;
	groupKey?: string;
	settingsTarget?: RevenueSettingsTab;
	monthlyAmounts: string[];
	annualTotal: string;
	percentageOfRevenue: string;
	isTotal: boolean;
	isSubtotal: boolean;
	issueTags?: RevenueIssueTag[];
}

const ZERO = new Decimal(0);

export const REVENUE_MONTH_LABELS = [
	'Jan',
	'Feb',
	'Mar',
	'Apr',
	'May',
	'Jun',
	'Jul',
	'Aug',
	'Sep',
	'Oct',
	'Nov',
	'Dec',
] as const;

const BAND_ORDER = ['MATERNELLE', 'ELEMENTAIRE', 'COLLEGE', 'LYCEE'] as const;
const NATIONALITY_ORDER = ['Francais', 'Nationaux', 'Autres'] as const;
const TARIFF_ORDER = ['Plein', 'RP', 'R3+'] as const;

function createMonthBucket() {
	return Array.from({ length: 12 }, () => ZERO);
}

function sumBucket(bucket: Decimal[]) {
	return bucket.reduce((sum, value) => sum.plus(value), ZERO);
}

function toMonthlyStrings(bucket: Decimal[]) {
	return bucket.map((value) => value.toFixed(4));
}

function toGridRow({
	id,
	code,
	label,
	viewMode,
	rowType,
	bucket,
	totalBase,
	isTotal = false,
	isSubtotal = false,
	band,
	groupKey,
	settingsTarget,
	issueTags,
}: {
	id: string;
	code: string;
	label: string;
	viewMode: RevenueViewMode;
	rowType: RevenueRowType;
	bucket: Decimal[];
	totalBase: Decimal;
	isTotal?: boolean;
	isSubtotal?: boolean;
	band?: string;
	groupKey?: string;
	settingsTarget?: RevenueSettingsTab;
	issueTags?: RevenueIssueTag[];
}): RevenueForecastGridRow {
	const annual = sumBucket(bucket);
	const row: RevenueForecastGridRow = {
		id,
		code,
		label,
		viewMode,
		rowType,
		monthlyAmounts: toMonthlyStrings(bucket),
		annualTotal: annual.toFixed(4),
		percentageOfRevenue: totalBase.eq(0) ? '0.000000' : annual.div(totalBase).toFixed(6),
		isTotal: isTotal ?? false,
		isSubtotal: isSubtotal ?? false,
	};
	if (band !== undefined) row.band = band;
	if (groupKey !== undefined) row.groupKey = groupKey;
	if (settingsTarget !== undefined) row.settingsTarget = settingsTarget;
	if (issueTags !== undefined && issueTags.length > 0) row.issueTags = issueTags;
	return row;
}

function aggregateRevenueMetricsByKey(
	data: RevenueResultsResponse | undefined,
	getKey: (entry: RevenueResultsResponse['entries'][number]) => string
) {
	const byKey = new Map<
		string,
		{
			bucket: Decimal[];
			grossTotal: Decimal;
			discountTotal: Decimal;
		}
	>();

	for (const entry of data?.entries ?? []) {
		const key = getKey(entry);
		const existing = byKey.get(key);
		const bucket = existing?.bucket ?? createMonthBucket();
		const monthIndex = entry.month - 1;
		bucket[monthIndex] = (bucket[monthIndex] ?? ZERO).plus(new Decimal(entry.grossRevenueHt));
		byKey.set(key, {
			bucket,
			grossTotal: (existing?.grossTotal ?? ZERO).plus(new Decimal(entry.grossRevenueHt)),
			discountTotal: (existing?.discountTotal ?? ZERO).plus(new Decimal(entry.discountAmount)),
		});
	}

	return byKey;
}

function resolveGradeOrder(gradeLevels: GradeLevel[] | undefined, entries: string[]) {
	if (!gradeLevels || gradeLevels.length === 0) {
		return [...entries].sort((left, right) => left.localeCompare(right));
	}

	const orderedGradeCodes = [...gradeLevels]
		.sort((left, right) => left.displayOrder - right.displayOrder)
		.map((gradeLevel) => gradeLevel.gradeCode);
	const knownGrades = new Set(orderedGradeCodes);
	const unknownGrades = entries
		.filter((gradeCode) => !knownGrades.has(gradeCode))
		.sort((left, right) => left.localeCompare(right));
	return [...orderedGradeCodes, ...unknownGrades];
}

export function getVisibleRevenueMonths(period: RevenueForecastPeriod) {
	switch (period) {
		case 'AY1':
			return [0, 1, 2, 3, 4, 5];
		case 'AY2':
			return [8, 9, 10, 11];
		default:
			return Array.from({ length: 12 }, (_, index) => index);
	}
}

export function formatRevenueGridAmount(value: string, monthIndex?: number) {
	const decimalValue = new Decimal(value);
	const isZero = decimalValue.eq(0);
	const isSummerZero = isZero && (monthIndex === 6 || monthIndex === 7);
	const rounded = decimalValue.abs().toDecimalPlaces(0);
	const formatted = formatMoney(rounded);

	if (isZero) {
		return {
			text: '-',
			isNegative: false,
			isMuted: isSummerZero,
		};
	}

	if (decimalValue.lt(0)) {
		return {
			text: `(${formatted})`,
			isNegative: true,
			isMuted: false,
		};
	}

	return {
		text: formatted,
		isNegative: false,
		isMuted: false,
	};
}

export function formatRevenueGridPercent(value: string) {
	const decimalValue = new Decimal(value).mul(100);
	const formatted = decimalValue.abs().toFixed(1);
	return decimalValue.lt(0) ? `-${formatted}%` : `${formatted}%`;
}

function resolveCategorySettingsTarget(label: string): RevenueSettingsTab {
	switch (label) {
		case 'Tuition Fees':
			return 'feeGrid';
		case 'Discount Impact':
			return 'feeGrid';
		case 'Registration Fees':
		case 'Activities & Services':
		case 'Examination Fees':
			return 'otherRevenue';
		default:
			return 'feeGrid';
	}
}

function resolveIssueTags({
	annualTotal,
	discountTotal = ZERO,
	grossTotal = ZERO,
	viewMode,
	code,
}: {
	annualTotal: Decimal;
	discountTotal?: Decimal;
	grossTotal?: Decimal;
	viewMode: RevenueViewMode;
	code: string;
}): RevenueIssueTag[] {
	const tags = new Set<RevenueIssueTag>();

	if (annualTotal.eq(0)) {
		tags.add('zero-revenue');
		if (viewMode === 'grade' || (viewMode === 'category' && code === 'tuition-fees')) {
			tags.add('missing-fees');
		}
		if (viewMode === 'nationality') {
			tags.add('missing-tariffs');
		}
	}

	if (viewMode === 'category' && code === 'discount-impact' && !annualTotal.eq(0)) {
		tags.add('high-discount');
	}

	if (grossTotal.gt(0)) {
		const discountRatio = discountTotal.div(grossTotal);
		if (discountRatio.gte(new Decimal('0.2'))) {
			tags.add('high-discount');
		}
	}

	if (viewMode === 'tariff' && code !== 'plein') {
		tags.add('high-discount');
		tags.add('missing-fees');
	}

	return [...tags];
}

export function buildRevenueForecastGridRows({
	data,
	viewMode,
	gradeLevels,
}: {
	data: RevenueResultsResponse | undefined;
	viewMode: RevenueViewMode;
	gradeLevels?: GradeLevel[] | undefined;
}) {
	if (!data) {
		return [];
	}

	if (viewMode === 'category') {
		return data.executiveSummary.rows.map((row): RevenueForecastGridRow => {
			const code = row.label.replace(/\s+/g, '-').toLowerCase();
			const isGrandTotal =
				code === 'total-operating-revenue' ||
				code === 'total-operating-rev' ||
				code === 'total-operating-revenues';
			const rowType: RevenueRowType = isGrandTotal ? 'total' : 'data';
			const annualTotal = new Decimal(row.annualTotal);
			const gridRow: RevenueForecastGridRow = {
				id: `category-${code}`,
				code,
				label: row.label,
				viewMode: 'category',
				rowType,
				monthlyAmounts: row.monthlyAmounts,
				annualTotal: row.annualTotal,
				percentageOfRevenue: row.percentageOfRevenue,
				isTotal: isGrandTotal,
				isSubtotal: false,
			};
			if (rowType === 'data') {
				gridRow.settingsTarget = resolveCategorySettingsTarget(row.label);
				gridRow.issueTags = resolveIssueTags({
					annualTotal,
					viewMode: 'category',
					code,
				});
			}
			return gridRow;
		});
	}

	const metricsByKey =
		viewMode === 'grade'
			? aggregateRevenueMetricsByKey(data, (entry) => entry.gradeLevel)
			: viewMode === 'nationality'
				? aggregateRevenueMetricsByKey(data, (entry) => entry.nationality)
				: aggregateRevenueMetricsByKey(data, (entry) => entry.tariff);

	const byKey = new Map<string, Decimal[]>(
		[...metricsByKey.entries()].map(([key, metrics]) => [key, metrics.bucket])
	);

	const totalBucket = [...byKey.values()].reduce((sum, bucket) => {
		return sum.map((value, index) => value.plus(bucket[index] ?? ZERO));
	}, createMonthBucket());
	const totalBase = sumBucket(totalBucket);

	if (viewMode === 'grade') {
		const gradeOrder = resolveGradeOrder(gradeLevels, [...byKey.keys()]);
		const rows: RevenueForecastGridRow[] = [];

		for (const band of BAND_ORDER) {
			const bandGrades = gradeOrder.filter(
				(gradeCode) =>
					gradeLevels?.find((gradeLevel) => gradeLevel.gradeCode === gradeCode)?.band === band
			);
			const bandBucket = createMonthBucket();

			for (const gradeCode of bandGrades) {
				const bucket = byKey.get(gradeCode) ?? createMonthBucket();
				const gradeMetrics = metricsByKey.get(gradeCode);
				rows.push(
					toGridRow({
						id: `grade-${gradeCode}`,
						code: gradeCode,
						label: gradeCode,
						viewMode: 'grade',
						rowType: 'data',
						band,
						groupKey: band,
						settingsTarget: 'feeGrid',
						bucket,
						totalBase,
						issueTags: resolveIssueTags({
							annualTotal: sumBucket(bucket),
							...(gradeMetrics ? { discountTotal: gradeMetrics.discountTotal } : {}),
							...(gradeMetrics ? { grossTotal: gradeMetrics.grossTotal } : {}),
							viewMode: 'grade',
							code: gradeCode.toLowerCase(),
						}),
					})
				);

				for (let index = 0; index < bandBucket.length; index += 1) {
					bandBucket[index] = (bandBucket[index] ?? ZERO).plus(bucket[index] ?? ZERO);
				}
			}

			rows.push(
				toGridRow({
					id: `grade-band-${band}`,
					code: `band-${band}`,
					label: BAND_LABELS[band] ?? band,
					viewMode: 'grade',
					rowType: 'subtotal',
					band,
					groupKey: band,
					bucket: bandBucket,
					totalBase,
					isSubtotal: true,
				})
			);
		}

		rows.push(
			toGridRow({
				id: 'grade-grand-total',
				code: 'grand-total',
				label: 'Grand Total',
				viewMode: 'grade',
				rowType: 'total',
				bucket: totalBucket,
				totalBase,
				isTotal: true,
			})
		);

		return rows;
	}

	const order = viewMode === 'nationality' ? NATIONALITY_ORDER : TARIFF_ORDER;
	const settingsTarget: RevenueSettingsTab = 'feeGrid';
	const rows = order
		.filter((label) => byKey.has(label))
		.map((label) => {
			const metrics = metricsByKey.get(label);
			return toGridRow({
				id: `${viewMode}-${label}`,
				code: label,
				label,
				viewMode,
				rowType: 'data',
				settingsTarget,
				bucket: byKey.get(label) ?? createMonthBucket(),
				totalBase,
				issueTags: resolveIssueTags({
					annualTotal: sumBucket(byKey.get(label) ?? createMonthBucket()),
					...(metrics ? { discountTotal: metrics.discountTotal } : {}),
					...(metrics ? { grossTotal: metrics.grossTotal } : {}),
					viewMode,
					code: label.toLowerCase(),
				}),
			});
		});

	rows.push(
		toGridRow({
			id: `${viewMode}-grand-total`,
			code: 'grand-total',
			label: 'Grand Total',
			viewMode,
			rowType: 'total',
			bucket: totalBucket,
			totalBase,
			isTotal: true,
		})
	);

	return rows;
}

export function filterRevenueForecastRows({
	rows,
	viewMode,
	bandFilter,
	exceptionFilter,
}: {
	rows: RevenueForecastGridRow[];
	viewMode: RevenueViewMode;
	bandFilter?: string;
	exceptionFilter?: RevenueExceptionFilterValue;
}) {
	return rows.filter((row) => {
		if (row.rowType !== 'data') {
			return false;
		}

		if (viewMode === 'grade' && bandFilter && bandFilter !== 'ALL' && row.band !== bandFilter) {
			return false;
		}

		if (exceptionFilter && exceptionFilter !== 'all') {
			const tags = row.issueTags ?? [];
			return tags.includes(exceptionFilter);
		}

		return true;
	});
}

export function getRevenueTotalLabel({
	viewMode,
	bandFilter,
	exceptionFilter,
}: {
	viewMode: RevenueViewMode;
	bandFilter?: string;
	exceptionFilter?: RevenueExceptionFilterValue;
}) {
	if (viewMode === 'grade' && bandFilter && bandFilter !== 'ALL') {
		return `Filtered Total (${BAND_LABELS[bandFilter] ?? bandFilter})`;
	}

	if (exceptionFilter && exceptionFilter !== 'all') {
		return 'Filtered Total';
	}

	return 'Grand Total';
}

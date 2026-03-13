import Decimal from 'decimal.js';
import type { RevenueResultsResponse, RevenueViewMode } from '@budfin/types';
import type { GradeLevel } from '../hooks/use-grade-levels';
import { BAND_LABELS } from './enrollment-workspace';

export type RevenueForecastPeriod = 'AY1' | 'AY2' | 'both';

export interface RevenueForecastGridRow {
	id: string;
	label: string;
	monthlyAmounts: string[];
	annualTotal: string;
	percentageOfRevenue: string;
	isTotal: boolean;
	isSubtotal: boolean;
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
	label,
	bucket,
	totalBase,
	isTotal = false,
	isSubtotal = false,
}: {
	id: string;
	label: string;
	bucket: Decimal[];
	totalBase: Decimal;
	isTotal?: boolean;
	isSubtotal?: boolean;
}): RevenueForecastGridRow {
	const annual = sumBucket(bucket);
	return {
		id,
		label,
		monthlyAmounts: toMonthlyStrings(bucket),
		annualTotal: annual.toFixed(4),
		percentageOfRevenue: totalBase.eq(0) ? '0.000000' : annual.div(totalBase).toFixed(6),
		isTotal,
		isSubtotal,
	};
}

function aggregateEntriesByKey(
	data: RevenueResultsResponse | undefined,
	getKey: (entry: RevenueResultsResponse['entries'][number]) => string
) {
	const byKey = new Map<string, Decimal[]>();

	for (const entry of data?.entries ?? []) {
		const key = getKey(entry);
		const bucket = byKey.get(key) ?? createMonthBucket();
		const monthIndex = entry.month - 1;
		bucket[monthIndex] = (bucket[monthIndex] ?? ZERO).plus(new Decimal(entry.grossRevenueHt));
		byKey.set(key, bucket);
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
	const formatted = rounded.toNumber().toLocaleString('fr-FR', {
		maximumFractionDigits: 0,
	});

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
		return data.executiveSummary.rows.map((row, index) => ({
			id: `category-${index}-${row.label}`,
			label: row.label,
			monthlyAmounts: row.monthlyAmounts,
			annualTotal: row.annualTotal,
			percentageOfRevenue: row.percentageOfRevenue,
			isTotal: row.isTotal,
			isSubtotal: false,
		}));
	}

	const byKey =
		viewMode === 'grade'
			? aggregateEntriesByKey(data, (entry) => entry.gradeLevel)
			: viewMode === 'nationality'
				? aggregateEntriesByKey(data, (entry) => entry.nationality)
				: aggregateEntriesByKey(data, (entry) => entry.tariff);

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
				rows.push(
					toGridRow({
						id: `grade-${gradeCode}`,
						label: gradeCode,
						bucket,
						totalBase,
					})
				);

				for (let index = 0; index < bandBucket.length; index += 1) {
					bandBucket[index] = (bandBucket[index] ?? ZERO).plus(bucket[index] ?? ZERO);
				}
			}

			rows.push(
				toGridRow({
					id: `band-${band}`,
					label: BAND_LABELS[band] ?? band,
					bucket: bandBucket,
					totalBase,
					isSubtotal: true,
				})
			);
		}

		rows.push(
			toGridRow({
				id: 'grade-grand-total',
				label: 'Grand Total',
				bucket: totalBucket,
				totalBase,
				isTotal: true,
			})
		);

		return rows;
	}

	const order = viewMode === 'nationality' ? NATIONALITY_ORDER : TARIFF_ORDER;
	const rows = order
		.filter((label) => byKey.has(label))
		.map((label) =>
			toGridRow({
				id: `${viewMode}-${label}`,
				label,
				bucket: byKey.get(label) ?? createMonthBucket(),
				totalBase,
			})
		);

	rows.push(
		toGridRow({
			id: `${viewMode}-grand-total`,
			label: 'Grand Total',
			bucket: totalBucket,
			totalBase,
			isTotal: true,
		})
	);

	return rows;
}

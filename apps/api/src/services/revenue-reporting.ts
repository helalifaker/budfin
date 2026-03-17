import type { RevenueMatrixRow, RevenueCompositionItem } from '@budfin/types';
import { Decimal } from 'decimal.js';
import { GRADE_BAND_MAP } from '../lib/enrollment-constants.js';

export interface RevenueDetailRow {
	academicPeriod: 'AY1' | 'AY2';
	gradeLevel: string;
	month: number;
	grossRevenueHt: string;
	discountAmount: string;
	netRevenueHt: string;
	vatAmount: string;
}

export interface OtherRevenueDetailRow {
	lineItemName: string;
	ifrsCategory: string;
	executiveCategory: string | null;
	month: number;
	amount: string;
}

export type { RevenueMatrixRow, RevenueCompositionItem };

export interface RevenueExecutiveSummaryView {
	rows: RevenueMatrixRow[];
	composition: RevenueCompositionItem[];
	monthlyTrend: Array<{
		month: number;
		amount: string;
	}>;
}

export interface RevenueReportingView {
	revenueEngine: {
		rows: RevenueMatrixRow[];
	};
	executiveSummary: RevenueExecutiveSummaryView;
}

export interface RevenueReportingTotals {
	grossRevenueHt: string;
	discountAmount: string;
	netRevenueHt: string;
	vatAmount: string;
	otherRevenueAmount: string;
	totalOperatingRevenue: string;
}

const ZERO = new Decimal(0);

type MonthBucket = Decimal[];

function makeEmptyMonths(): MonthBucket {
	return Array.from({ length: 12 }, () => ZERO);
}

function addToMonthBucket(bucket: MonthBucket, month: number, amount: Decimal): MonthBucket {
	const next = [...bucket];
	next[month - 1] = (next[month - 1] ?? ZERO).plus(amount);
	return next;
}

function sumMonthBuckets(a: MonthBucket, b: MonthBucket): MonthBucket {
	return a.map((amount, index) => amount.plus(b[index] ?? ZERO));
}

function annualTotal(amounts: MonthBucket): Decimal {
	return amounts.reduce((sum, amount) => sum.plus(amount), ZERO);
}

function serializeMonths(amounts: MonthBucket): string[] {
	return amounts.map((amount) => amount.toFixed(4));
}

function buildMatrixRow(
	section: string,
	label: string,
	amounts: MonthBucket,
	totalOperatingRevenue: Decimal,
	isTotal = false
): RevenueMatrixRow {
	const total = annualTotal(amounts);
	return {
		section,
		label,
		monthlyAmounts: serializeMonths(amounts),
		annualTotal: total.toFixed(4),
		percentageOfRevenue: totalOperatingRevenue.isZero()
			? '0.000000'
			: total.div(totalOperatingRevenue).toFixed(6),
		isTotal,
	};
}

function addAmountByKey(
	target: Map<string, MonthBucket>,
	key: string,
	month: number,
	amount: Decimal
) {
	const existing = target.get(key) ?? makeEmptyMonths();
	target.set(key, addToMonthBucket(existing, month, amount));
}

function sumRowsByKey(target: Map<string, MonthBucket>, keys: string[]): MonthBucket {
	return keys.reduce(
		(sum, key) => sumMonthBuckets(sum, target.get(key) ?? makeEmptyMonths()),
		makeEmptyMonths()
	);
}

function mapTuitionLine(gradeLevel: string): string {
	if (gradeLevel === 'PS') {
		return 'Maternelle PS - Tuition';
	}

	const band = GRADE_BAND_MAP[gradeLevel];
	switch (band) {
		case 'MATERNELLE':
			return 'Maternelle - Tuition';
		case 'ELEMENTAIRE':
			return 'Elementaire - Tuition';
		case 'COLLEGE':
			return 'College - Tuition';
		case 'LYCEE':
			return 'Lycee - Tuition';
		default:
			return `${gradeLevel} - Tuition`;
	}
}

function mapOtherRevenueLines(lineItemName: string, executiveCategory: string | null): string[] {
	// Use executiveCategory for primary grouping when available,
	// with lineItemName patterns for specific line assignment

	// Registration fees: DAI, DPI, Frais de Dossier, Evaluation
	if (lineItemName.startsWith('DAI')) {
		return ['Re-registration (DAI)'];
	}

	if (lineItemName.startsWith('DPI') || lineItemName.startsWith('Frais de Dossier')) {
		return ['New Student Fees (Dossier+DPI)'];
	}

	if (lineItemName.startsWith('Evaluation')) {
		return ['Evaluation Tests'];
	}

	// Activities & Services
	if (
		lineItemName === 'APS' ||
		lineItemName.startsWith('After-School') ||
		lineItemName.startsWith('After School')
	) {
		return ['After-School Activities (APS)'];
	}

	if (lineItemName.startsWith('Daycare') || lineItemName === 'Garderie') {
		return ['Daycare (Garderie)'];
	}

	if (lineItemName.startsWith('Class Photos')) {
		return ['Class Photos'];
	}

	// Examination fees
	if (
		lineItemName === 'BAC' ||
		lineItemName.startsWith('BAC ') ||
		lineItemName.startsWith('Examination Fees')
	) {
		if (lineItemName.includes('DNB')) return ['DNB Examination Fees'];
		if (lineItemName.includes('EAF')) return ['EAF Examination Fees'];
		if (lineItemName.includes('SIELE')) return ['SIELE Examination Fees'];
		return ['BAC Examination Fees'];
	}

	if (lineItemName === 'DNB' || lineItemName.startsWith('DNB ')) {
		return ['DNB Examination Fees'];
	}

	if (lineItemName === 'EAF' || lineItemName.startsWith('EAF ')) {
		return ['EAF Examination Fees'];
	}

	if (lineItemName === 'SIELE' || lineItemName.startsWith('SIELE ')) {
		return ['SIELE Examination Fees'];
	}

	// Fallback: use executiveCategory to route unmapped items to the right section
	if (executiveCategory === 'REGISTRATION_FEES') {
		return ['New Student Fees (Dossier+DPI)'];
	}
	if (executiveCategory === 'ACTIVITIES_SERVICES') {
		return ['After-School Activities (APS)'];
	}
	if (executiveCategory === 'EXAMINATION_FEES') {
		return ['BAC Examination Fees'];
	}

	return [];
}

export function buildRevenueReportingView(
	tuitionRows: RevenueDetailRow[],
	otherRevenueRows: OtherRevenueDetailRow[]
): RevenueReportingView {
	const tuitionByLine = new Map<string, MonthBucket>();
	const discountByPeriod = new Map<'AY1' | 'AY2', MonthBucket>([
		['AY1', makeEmptyMonths()],
		['AY2', makeEmptyMonths()],
	]);
	const otherRevenueByLine = new Map<string, MonthBucket>();

	for (const row of tuitionRows) {
		addAmountByKey(
			tuitionByLine,
			mapTuitionLine(row.gradeLevel),
			row.month,
			new Decimal(row.grossRevenueHt)
		);
		discountByPeriod.set(
			row.academicPeriod,
			addToMonthBucket(
				discountByPeriod.get(row.academicPeriod) ?? makeEmptyMonths(),
				row.month,
				new Decimal(row.discountAmount).negated()
			)
		);
	}

	for (const row of otherRevenueRows) {
		const mappedLines = mapOtherRevenueLines(row.lineItemName, row.executiveCategory);
		if (mappedLines.length === 0) {
			continue;
		}

		for (const mappedLine of mappedLines) {
			addAmountByKey(otherRevenueByLine, mappedLine, row.month, new Decimal(row.amount));
		}
	}

	const tuitionLineLabels = [
		'Maternelle PS - Tuition',
		'Maternelle - Tuition',
		'Elementaire - Tuition',
		'College - Tuition',
		'Lycee - Tuition',
	];
	const tuitionTotal = sumRowsByKey(tuitionByLine, tuitionLineLabels);
	const discountAy1 = discountByPeriod.get('AY1') ?? makeEmptyMonths();
	const discountAy2 = discountByPeriod.get('AY2') ?? makeEmptyMonths();
	const totalDiscount = sumMonthBuckets(discountAy1, discountAy2);

	const registrationLineLabels = [
		'New Student Fees (Dossier+DPI)',
		'Re-registration (DAI)',
		'Evaluation Tests',
	];
	const registrationTotal = sumRowsByKey(otherRevenueByLine, registrationLineLabels);

	const activityLineLabels = [
		'After-School Activities (APS)',
		'Daycare (Garderie)',
		'Class Photos',
	];
	const activitiesTotal = sumRowsByKey(otherRevenueByLine, activityLineLabels);

	const examLineLabels = [
		'BAC Examination Fees',
		'DNB Examination Fees',
		'EAF Examination Fees',
		'SIELE Examination Fees',
	];
	const examinationTotal = sumRowsByKey(otherRevenueByLine, examLineLabels);

	const totalOperatingRevenue = sumMonthBuckets(
		sumMonthBuckets(tuitionTotal, totalDiscount),
		sumMonthBuckets(registrationTotal, sumMonthBuckets(activitiesTotal, examinationTotal))
	);
	const totalOperatingRevenueAnnual = annualTotal(totalOperatingRevenue);

	const revenueEngineRows: RevenueMatrixRow[] = [
		...tuitionLineLabels.map((label) =>
			buildMatrixRow(
				'Tuition Fees',
				label,
				tuitionByLine.get(label) ?? makeEmptyMonths(),
				totalOperatingRevenueAnnual
			)
		),
		buildMatrixRow(
			'Tuition Fees',
			'Total Tuition Fees',
			tuitionTotal,
			totalOperatingRevenueAnnual,
			true
		),
		buildMatrixRow(
			'Discount Impact',
			'Discount Impact (AY1)',
			discountAy1,
			totalOperatingRevenueAnnual
		),
		buildMatrixRow(
			'Discount Impact',
			'Discount Impact (AY2)',
			discountAy2,
			totalOperatingRevenueAnnual
		),
		buildMatrixRow(
			'Discount Impact',
			'Total Discount Impact',
			totalDiscount,
			totalOperatingRevenueAnnual,
			true
		),
		...registrationLineLabels.map((label) =>
			buildMatrixRow(
				'Registration Fees',
				label,
				otherRevenueByLine.get(label) ?? makeEmptyMonths(),
				totalOperatingRevenueAnnual
			)
		),
		buildMatrixRow(
			'Registration Fees',
			'Total Registration Fees',
			registrationTotal,
			totalOperatingRevenueAnnual,
			true
		),
		...activityLineLabels.map((label) =>
			buildMatrixRow(
				'Activities & Services',
				label,
				otherRevenueByLine.get(label) ?? makeEmptyMonths(),
				totalOperatingRevenueAnnual
			)
		),
		buildMatrixRow(
			'Activities & Services',
			'Total Activities & Services',
			activitiesTotal,
			totalOperatingRevenueAnnual,
			true
		),
		...examLineLabels.map((label) =>
			buildMatrixRow(
				'Examination Fees',
				label,
				otherRevenueByLine.get(label) ?? makeEmptyMonths(),
				totalOperatingRevenueAnnual
			)
		),
		buildMatrixRow(
			'Examination Fees',
			'Total Examination Fees',
			examinationTotal,
			totalOperatingRevenueAnnual,
			true
		),
		buildMatrixRow(
			'TOTAL',
			'TOTAL OPERATING REVENUE',
			totalOperatingRevenue,
			totalOperatingRevenueAnnual,
			true
		),
	];

	const netTuition = sumMonthBuckets(tuitionTotal, totalDiscount);
	const executiveSummaryRows: RevenueMatrixRow[] = [
		buildMatrixRow(
			'Executive Summary',
			'Tuition Fees',
			tuitionTotal,
			totalOperatingRevenueAnnual,
			true
		),
		buildMatrixRow(
			'Executive Summary',
			'Discount Impact',
			totalDiscount,
			totalOperatingRevenueAnnual,
			true
		),
		buildMatrixRow(
			'Executive Summary',
			'Registration Fees',
			registrationTotal,
			totalOperatingRevenueAnnual,
			true
		),
		buildMatrixRow(
			'Executive Summary',
			'Activities & Services',
			activitiesTotal,
			totalOperatingRevenueAnnual,
			true
		),
		buildMatrixRow(
			'Executive Summary',
			'Examination Fees',
			examinationTotal,
			totalOperatingRevenueAnnual,
			true
		),
		buildMatrixRow(
			'Executive Summary',
			'TOTAL OPERATING REVENUE',
			totalOperatingRevenue,
			totalOperatingRevenueAnnual,
			true
		),
	];

	const composition: RevenueCompositionItem[] = [
		{
			label: 'Net Tuition',
			amount: annualTotal(netTuition).toFixed(4),
			percentageOfRevenue: totalOperatingRevenueAnnual.isZero()
				? '0.000000'
				: annualTotal(netTuition).div(totalOperatingRevenueAnnual).toFixed(6),
		},
		{
			label: 'Registration',
			amount: annualTotal(registrationTotal).toFixed(4),
			percentageOfRevenue: totalOperatingRevenueAnnual.isZero()
				? '0.000000'
				: annualTotal(registrationTotal).div(totalOperatingRevenueAnnual).toFixed(6),
		},
		{
			label: 'Activities',
			amount: annualTotal(activitiesTotal).toFixed(4),
			percentageOfRevenue: totalOperatingRevenueAnnual.isZero()
				? '0.000000'
				: annualTotal(activitiesTotal).div(totalOperatingRevenueAnnual).toFixed(6),
		},
		{
			label: 'Examinations',
			amount: annualTotal(examinationTotal).toFixed(4),
			percentageOfRevenue: totalOperatingRevenueAnnual.isZero()
				? '0.000000'
				: annualTotal(examinationTotal).div(totalOperatingRevenueAnnual).toFixed(6),
		},
	];

	const monthlyTrend = totalOperatingRevenue.map((amount, index) => ({
		month: index + 1,
		amount: amount.toFixed(4),
	}));

	return {
		revenueEngine: {
			rows: revenueEngineRows,
		},
		executiveSummary: {
			rows: executiveSummaryRows,
			composition,
			monthlyTrend,
		},
	};
}

export function buildRevenueReportingTotals(
	tuitionRows: RevenueDetailRow[],
	reporting: RevenueReportingView
): RevenueReportingTotals {
	let totalGross = ZERO;
	let totalDiscount = ZERO;
	let totalNet = ZERO;
	let totalVat = ZERO;

	for (const row of tuitionRows) {
		totalGross = totalGross.plus(new Decimal(row.grossRevenueHt));
		totalDiscount = totalDiscount.plus(new Decimal(row.discountAmount));
		totalNet = totalNet.plus(new Decimal(row.netRevenueHt));
		totalVat = totalVat.plus(new Decimal(row.vatAmount));
	}

	const compositionByLabel = new Map(
		reporting.executiveSummary.composition.map((item) => [item.label, item.amount] as const)
	);
	const totalOperatingRevenue =
		reporting.executiveSummary.rows[reporting.executiveSummary.rows.length - 1]?.annualTotal ??
		'0.0000';
	const registrationRevenue =
		reporting.executiveSummary.rows.find((row) => row.label === 'Registration Fees')?.annualTotal ??
		'0.0000';
	const activitiesRevenue =
		reporting.executiveSummary.rows.find((row) => row.label === 'Activities & Services')
			?.annualTotal ?? '0.0000';
	const examinationRevenue =
		reporting.executiveSummary.rows.find((row) => row.label === 'Examination Fees')?.annualTotal ??
		'0.0000';

	return {
		grossRevenueHt: totalGross.toFixed(4),
		discountAmount: totalDiscount.toFixed(4),
		netRevenueHt: compositionByLabel.get('Net Tuition') ?? totalNet.toFixed(4),
		vatAmount: totalVat.toFixed(4),
		otherRevenueAmount: new Decimal(registrationRevenue)
			.plus(new Decimal(activitiesRevenue))
			.plus(new Decimal(examinationRevenue))
			.toFixed(4),
		totalOperatingRevenue,
	};
}

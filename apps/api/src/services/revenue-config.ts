import type {
	DistributionMethod,
	IfrsCategory,
	OtherRevenueComputeMethod,
	RevenueSettings,
} from '@budfin/types';
import { Decimal } from 'decimal.js';

type CanonicalDynamicOtherRevenueItem = Readonly<{
	lineItemName: string;
	computeMethod: OtherRevenueComputeMethod;
	distributionMethod: DistributionMethod;
	weightArray: null;
	specificMonths: number[] | null;
	ifrsCategory: IfrsCategory;
}>;

type DynamicOtherRevenueRow = {
	lineItemName: string;
	computeMethod: string | null;
	distributionMethod: string;
	weightArray: unknown;
	specificMonths: number[];
	ifrsCategory: string;
};

export const DEFAULT_VERSION_REVENUE_SETTINGS: RevenueSettings = {
	dpiPerStudentHt: '2000.0000',
	dossierPerStudentHt: '1000.0000',
	examBacPerStudent: '2000.0000',
	examDnbPerStudent: '600.0000',
	examEafPerStudent: '800.0000',
	evalPrimairePerStudent: '200.0000',
	evalSecondairePerStudent: '300.0000',
};

export const CANONICAL_DYNAMIC_OTHER_REVENUE_ITEMS: readonly CanonicalDynamicOtherRevenueItem[] = [
	{
		lineItemName: 'DAI - Francais',
		computeMethod: 'DAI',
		distributionMethod: 'SPECIFIC_PERIOD',
		weightArray: null,
		specificMonths: [5, 6],
		ifrsCategory: 'Registration Fees',
	},
	{
		lineItemName: 'DAI - Nationaux',
		computeMethod: 'DAI',
		distributionMethod: 'SPECIFIC_PERIOD',
		weightArray: null,
		specificMonths: [5, 6],
		ifrsCategory: 'Registration Fees',
	},
	{
		lineItemName: 'DAI - Autres',
		computeMethod: 'DAI',
		distributionMethod: 'SPECIFIC_PERIOD',
		weightArray: null,
		specificMonths: [5, 6],
		ifrsCategory: 'Registration Fees',
	},
	{
		lineItemName: 'DPI - Francais',
		computeMethod: 'DPI',
		distributionMethod: 'SPECIFIC_PERIOD',
		weightArray: null,
		specificMonths: [5, 6],
		ifrsCategory: 'Registration Fees',
	},
	{
		lineItemName: 'DPI - Nationaux',
		computeMethod: 'DPI',
		distributionMethod: 'SPECIFIC_PERIOD',
		weightArray: null,
		specificMonths: [5, 6],
		ifrsCategory: 'Registration Fees',
	},
	{
		lineItemName: 'DPI - Autres',
		computeMethod: 'DPI',
		distributionMethod: 'SPECIFIC_PERIOD',
		weightArray: null,
		specificMonths: [5, 6],
		ifrsCategory: 'Registration Fees',
	},
	{
		lineItemName: 'Frais de Dossier - Francais',
		computeMethod: 'FRAIS_DOSSIER',
		distributionMethod: 'SPECIFIC_PERIOD',
		weightArray: null,
		specificMonths: [5, 6],
		ifrsCategory: 'Registration Fees',
	},
	{
		lineItemName: 'Frais de Dossier - Nationaux',
		computeMethod: 'FRAIS_DOSSIER',
		distributionMethod: 'SPECIFIC_PERIOD',
		weightArray: null,
		specificMonths: [5, 6],
		ifrsCategory: 'Registration Fees',
	},
	{
		lineItemName: 'Frais de Dossier - Autres',
		computeMethod: 'FRAIS_DOSSIER',
		distributionMethod: 'SPECIFIC_PERIOD',
		weightArray: null,
		specificMonths: [5, 6],
		ifrsCategory: 'Registration Fees',
	},
	{
		lineItemName: 'BAC',
		computeMethod: 'EXAM_BAC',
		distributionMethod: 'SPECIFIC_PERIOD',
		weightArray: null,
		specificMonths: [4, 5],
		ifrsCategory: 'Examination Fees',
	},
	{
		lineItemName: 'DNB',
		computeMethod: 'EXAM_DNB',
		distributionMethod: 'SPECIFIC_PERIOD',
		weightArray: null,
		specificMonths: [4, 5],
		ifrsCategory: 'Examination Fees',
	},
	{
		lineItemName: 'EAF',
		computeMethod: 'EXAM_EAF',
		distributionMethod: 'SPECIFIC_PERIOD',
		weightArray: null,
		specificMonths: [4, 5],
		ifrsCategory: 'Examination Fees',
	},
	{
		lineItemName: 'Evaluation - Primaire',
		computeMethod: 'EVAL_PRIMAIRE',
		distributionMethod: 'SPECIFIC_PERIOD',
		weightArray: null,
		specificMonths: [10, 11],
		ifrsCategory: 'Registration Fees',
	},
	{
		lineItemName: 'Evaluation - College+Lycee',
		computeMethod: 'EVAL_SECONDAIRE',
		distributionMethod: 'SPECIFIC_PERIOD',
		weightArray: null,
		specificMonths: [10, 11],
		ifrsCategory: 'Registration Fees',
	},
] as const;

const CANONICAL_DYNAMIC_OTHER_REVENUE_BY_NAME = new Map(
	CANONICAL_DYNAMIC_OTHER_REVENUE_ITEMS.map((item) => [item.lineItemName, item] as const)
);

export function formatRevenueSettingsRecord(
	settings: Record<keyof RevenueSettings, unknown>
): RevenueSettings {
	return {
		dpiPerStudentHt: new Decimal(String(settings.dpiPerStudentHt)).toFixed(4),
		dossierPerStudentHt: new Decimal(String(settings.dossierPerStudentHt)).toFixed(4),
		examBacPerStudent: new Decimal(String(settings.examBacPerStudent)).toFixed(4),
		examDnbPerStudent: new Decimal(String(settings.examDnbPerStudent)).toFixed(4),
		examEafPerStudent: new Decimal(String(settings.examEafPerStudent)).toFixed(4),
		evalPrimairePerStudent: new Decimal(String(settings.evalPrimairePerStudent)).toFixed(4),
		evalSecondairePerStudent: new Decimal(String(settings.evalSecondairePerStudent)).toFixed(4),
	};
}

export function buildCanonicalDynamicOtherRevenueRows() {
	return CANONICAL_DYNAMIC_OTHER_REVENUE_ITEMS.map((item) => ({
		lineItemName: item.lineItemName,
		annualAmount: '0.0000',
		distributionMethod: item.distributionMethod,
		weightArray: item.weightArray,
		specificMonths: item.specificMonths,
		ifrsCategory: item.ifrsCategory,
		computeMethod: item.computeMethod,
	}));
}

export function getCanonicalDynamicOtherRevenueItem(lineItemName: string) {
	return CANONICAL_DYNAMIC_OTHER_REVENUE_BY_NAME.get(lineItemName);
}

function weightArrayMatches(weightArray: unknown) {
	return weightArray == null;
}

function specificMonthsMatch(expected: readonly number[] | null, actual: readonly number[]) {
	if (expected === null) {
		return actual.length === 0;
	}

	if (expected.length !== actual.length) {
		return false;
	}

	return expected.every((month, index) => actual[index] === month);
}

export function validateCanonicalDynamicOtherRevenueItems(items: DynamicOtherRevenueRow[]) {
	const unexpected: string[] = [];
	const missing: string[] = [];
	const invalid: Array<{ lineItemName: string; reason: string }> = [];
	const seen = new Set<string>();

	for (const item of items) {
		if (seen.has(item.lineItemName)) {
			invalid.push({
				lineItemName: item.lineItemName,
				reason: 'Duplicate dynamic line item',
			});
			continue;
		}
		seen.add(item.lineItemName);

		const canonical = CANONICAL_DYNAMIC_OTHER_REVENUE_BY_NAME.get(item.lineItemName);
		if (!canonical) {
			unexpected.push(item.lineItemName);
			continue;
		}

		if (item.computeMethod !== canonical.computeMethod) {
			invalid.push({
				lineItemName: item.lineItemName,
				reason: `Expected computeMethod ${canonical.computeMethod}, received ${item.computeMethod ?? 'null'}`,
			});
		}

		if (item.distributionMethod !== canonical.distributionMethod) {
			invalid.push({
				lineItemName: item.lineItemName,
				reason: `Expected distributionMethod ${canonical.distributionMethod}, received ${item.distributionMethod}`,
			});
		}

		if (!weightArrayMatches(item.weightArray)) {
			invalid.push({
				lineItemName: item.lineItemName,
				reason: 'Dynamic rows cannot define custom weight arrays',
			});
		}

		if (!specificMonthsMatch(canonical.specificMonths, item.specificMonths)) {
			invalid.push({
				lineItemName: item.lineItemName,
				reason: 'Dynamic row specificMonths do not match the canonical schedule',
			});
		}

		if (item.ifrsCategory !== canonical.ifrsCategory) {
			invalid.push({
				lineItemName: item.lineItemName,
				reason: `Expected IFRS category ${canonical.ifrsCategory}, received ${item.ifrsCategory}`,
			});
		}
	}

	for (const canonical of CANONICAL_DYNAMIC_OTHER_REVENUE_ITEMS) {
		if (!seen.has(canonical.lineItemName)) {
			missing.push(canonical.lineItemName);
		}
	}

	return {
		missing,
		unexpected,
		invalid,
		validCount: CANONICAL_DYNAMIC_OTHER_REVENUE_ITEMS.length - missing.length - invalid.length,
	};
}

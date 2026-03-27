// P&L calculation engine — pure functions, no DB dependencies
// Epic 5, Story #242: P&L Engine
// TC-001: All monetary arithmetic uses Decimal.js, zero exceptions
// TC-004: Accumulate full precision, round only at final serialization

import { Decimal } from 'decimal.js';
import { toFixed4 } from './decimal-utils.js';

// ── Constants ────────────────────────────────────────────────────────────────

const ZERO = new Decimal(0);
const ZAKAT_RATE = new Decimal('0.025'); // 2.5%
const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

// ── Input Interfaces ─────────────────────────────────────────────────────────

export interface RevenueInput {
	month: number;
	gradeLevel: string;
	nationality: string;
	tariff: string;
	grossRevenueHt: string; // decimal string
	discountAmount: string;
	netRevenueHt: string;
}

export interface OtherRevenueInput {
	month: number;
	lineItemName: string;
	ifrsCategory: string;
	executiveCategory: string;
	amount: string; // decimal string
}

export interface StaffCostInput {
	month: number;
	employeeId: number;
	baseGross: string;
	adjustedGross: string;
	housingAllowance: string;
	transportAllowance: string;
	responsibilityPremium: string;
	hsaAmount: string;
	gosiAmount: string;
	ajeerAmount: string;
	eosMonthlyAccrual: string;
	totalCost: string;
	isNew: boolean; // for new positions separation
}

export interface CategoryCostInput {
	month: number;
	category: string;
	amount: string;
}

export interface OpExInput {
	month: number;
	lineItemName: string;
	sectionType: string; // 'OPERATING' | 'NON_OPERATING'
	ifrsCategory: string;
	amount: string; // decimal string
}

// ── Output Interfaces ────────────────────────────────────────────────────────

export interface PnlLineOutput {
	month: number;
	sectionKey: string;
	categoryKey: string;
	lineItemKey: string;
	displayLabel: string;
	depth: 1 | 2 | 3;
	displayOrder: number;
	amount: string; // decimal string
	signConvention: 'POSITIVE' | 'NEGATIVE';
	isSubtotal: boolean;
	isSeparator: boolean;
}

export interface BudgetSummaryOutput {
	month: number;
	revenueHt: string;
	staffCosts: string;
	opexCosts: string;
	depreciation: string;
	impairment: string;
	ebitda: string;
	operatingProfit: string;
	financeNet: string;
	profitBeforeZakat: string;
	zakatAmount: string;
	netProfit: string;
}

export interface PnlEngineResult {
	lines: PnlLineOutput[];
	summaries: BudgetSummaryOutput[];
	totals: {
		totalRevenueHt: string;
		totalStaffCosts: string;
		ebitda: string;
		ebitdaMarginPct: string;
		netProfit: string;
	};
}

// ── Helpers ──────────────────────────────────────────────────────────────────

type MonthlyAccumulator = Map<number, Decimal>;

function newAccum(): MonthlyAccumulator {
	const acc = new Map<number, Decimal>();
	for (const m of MONTHS) {
		acc.set(m, ZERO);
	}
	return acc;
}

function addToMonth(acc: MonthlyAccumulator, month: number, amount: Decimal): void {
	acc.set(month, (acc.get(month) ?? ZERO).plus(amount));
}

function getM(acc: MonthlyAccumulator, month: number): Decimal {
	return acc.get(month) ?? ZERO;
}

function sumAll(acc: MonthlyAccumulator): Decimal {
	let total = ZERO;
	for (const v of acc.values()) {
		total = total.plus(v);
	}
	return total;
}

function makeLine(
	month: number,
	sectionKey: string,
	categoryKey: string,
	lineItemKey: string,
	displayLabel: string,
	depth: 1 | 2 | 3,
	displayOrder: number,
	amount: Decimal,
	signConvention: 'POSITIVE' | 'NEGATIVE',
	isSubtotal: boolean,
	isSeparator: boolean
): PnlLineOutput {
	return {
		month,
		sectionKey,
		categoryKey,
		lineItemKey,
		displayLabel,
		depth,
		displayOrder,
		amount: toFixed4(amount),
		signConvention,
		isSubtotal,
		isSeparator,
	};
}

// ── Aggregation helpers ──────────────────────────────────────────────────────

function aggregateByMonth<T>(
	items: T[],
	getMonthFn: (item: T) => number,
	getAmount: (item: T) => string
): MonthlyAccumulator {
	const acc = newAccum();
	for (const item of items) {
		addToMonth(acc, getMonthFn(item), new Decimal(getAmount(item)));
	}
	return acc;
}

function aggregateFiltered<T>(
	items: T[],
	predicate: (item: T) => boolean,
	getMonthFn: (item: T) => number,
	getAmount: (item: T) => string
): MonthlyAccumulator {
	const acc = newAccum();
	for (const item of items) {
		if (predicate(item)) {
			addToMonth(acc, getMonthFn(item), new Decimal(getAmount(item)));
		}
	}
	return acc;
}

function groupByKey<T>(
	items: T[],
	getKey: (item: T) => string,
	getMonthFn: (item: T) => number,
	getAmount: (item: T) => string
): Map<string, MonthlyAccumulator> {
	const groups = new Map<string, MonthlyAccumulator>();
	for (const item of items) {
		const key = getKey(item);
		if (!groups.has(key)) {
			groups.set(key, newAccum());
		}
		addToMonth(groups.get(key)!, getMonthFn(item), new Decimal(getAmount(item)));
	}
	return groups;
}

function sumAccumulators(...accs: MonthlyAccumulator[]): MonthlyAccumulator {
	const result = newAccum();
	for (const acc of accs) {
		for (const m of MONTHS) {
			addToMonth(result, m, getM(acc, m));
		}
	}
	return result;
}

function subtractAccumulators(a: MonthlyAccumulator, b: MonthlyAccumulator): MonthlyAccumulator {
	const result = newAccum();
	for (const m of MONTHS) {
		result.set(m, getM(a, m).minus(getM(b, m)));
	}
	return result;
}

// ── Category cost display labels ─────────────────────────────────────────────

const CATEGORY_DISPLAY: Record<string, string> = {
	remplacements: 'Replacement Contracts',
	formation: 'Continuing Education',
	resident_salaires: 'Resident Salaries',
	cotisation_retraite: 'Pension Contribution',
	resident_logement_billets: 'Resident Housing & Flights',
};

function categoryLabel(category: string): string {
	return CATEGORY_DISPLAY[category] ?? category;
}

function safeKey(s: string): string {
	return s
		.toUpperCase()
		.replace(/[^A-Z0-9]/g, '_')
		.replace(/_+/g, '_')
		.replace(/^_|_$/g, '');
}

// ── Main Engine ──────────────────────────────────────────────────────────────

export function calculatePnl(
	revenue: RevenueInput[],
	otherRevenue: OtherRevenueInput[],
	staffCosts: StaffCostInput[],
	categoryCosts: CategoryCostInput[],
	opex: OpExInput[]
): PnlEngineResult {
	const lines: PnlLineOutput[] = [];

	// ── Pre-aggregate all data by month ──────────────────────────────────

	// REVENUE: tuition by grade
	const tuitionByGrade = groupByKey(
		revenue,
		(r) => r.gradeLevel,
		(r) => r.month,
		(r) => r.netRevenueHt
	);
	const totalTuition = aggregateByMonth(
		revenue,
		(r) => r.month,
		(r) => r.netRevenueHt
	);

	// Other revenue by executive category
	const registrationFees = aggregateFiltered(
		otherRevenue,
		(r) =>
			r.executiveCategory === 'Registration Fees' || r.executiveCategory === 'REGISTRATION_FEES',
		(r) => r.month,
		(r) => r.amount
	);
	const registrationByLine = groupByKey(
		otherRevenue.filter(
			(r) =>
				r.executiveCategory === 'Registration Fees' || r.executiveCategory === 'REGISTRATION_FEES'
		),
		(r) => r.lineItemName,
		(r) => r.month,
		(r) => r.amount
	);

	const activitiesServices = aggregateFiltered(
		otherRevenue,
		(r) =>
			r.executiveCategory === 'Activities & Services' ||
			r.executiveCategory === 'ACTIVITIES_SERVICES',
		(r) => r.month,
		(r) => r.amount
	);
	const activitiesByLine = groupByKey(
		otherRevenue.filter(
			(r) =>
				r.executiveCategory === 'Activities & Services' ||
				r.executiveCategory === 'ACTIVITIES_SERVICES'
		),
		(r) => r.lineItemName,
		(r) => r.month,
		(r) => r.amount
	);

	const examinationFees = aggregateFiltered(
		otherRevenue,
		(r) => r.executiveCategory === 'Examination Fees' || r.executiveCategory === 'EXAMINATION_FEES',
		(r) => r.month,
		(r) => r.amount
	);
	const examinationByLine = groupByKey(
		otherRevenue.filter(
			(r) =>
				r.executiveCategory === 'Examination Fees' || r.executiveCategory === 'EXAMINATION_FEES'
		),
		(r) => r.lineItemName,
		(r) => r.month,
		(r) => r.amount
	);

	// Rental income
	const rentalIncome = aggregateFiltered(
		otherRevenue,
		(r) => r.ifrsCategory === 'Rental Income',
		(r) => r.month,
		(r) => r.amount
	);
	const rentalByLine = groupByKey(
		otherRevenue.filter((r) => r.ifrsCategory === 'Rental Income'),
		(r) => r.lineItemName,
		(r) => r.month,
		(r) => r.amount
	);

	const totalContractsRevenue = sumAccumulators(
		totalTuition,
		registrationFees,
		activitiesServices,
		examinationFees
	);
	const totalRevenue = sumAccumulators(totalContractsRevenue, rentalIncome);

	// ── STAFF COSTS pre-aggregation ──────────────────────────────────────

	const isExisting = (s: StaffCostInput) => !s.isNew;
	const isNew = (s: StaffCostInput) => s.isNew;

	// Base salary = adjustedGross minus the component allowances (housing, transport, resp, HSA)
	// This avoids double-counting since components are shown as separate P&L lines.
	const baseSalariesExisting = aggregateFiltered(
		staffCosts,
		isExisting,
		(s) => s.month,
		(s) => {
			const adj = new Decimal(s.adjustedGross);
			return adj
				.minus(new Decimal(s.housingAllowance))
				.minus(new Decimal(s.transportAllowance))
				.minus(new Decimal(s.responsibilityPremium))
				.minus(new Decimal(s.hsaAmount))
				.toFixed(4);
		}
	);
	const housingExisting = aggregateFiltered(
		staffCosts,
		isExisting,
		(s) => s.month,
		(s) => s.housingAllowance
	);
	const transportExisting = aggregateFiltered(
		staffCosts,
		isExisting,
		(s) => s.month,
		(s) => s.transportAllowance
	);
	const responsibilityExisting = aggregateFiltered(
		staffCosts,
		isExisting,
		(s) => s.month,
		(s) => s.responsibilityPremium
	);
	const hsaExisting = aggregateFiltered(
		staffCosts,
		isExisting,
		(s) => s.month,
		(s) => s.hsaAmount
	);
	// New positions: use adjustedGross (salary only), since employer charges
	// (GOSI, Ajeer, EOS) are aggregated separately for all employees.
	const newPositionsCost = aggregateFiltered(
		staffCosts,
		isNew,
		(s) => s.month,
		(s) => s.adjustedGross
	);

	const localSalariesTotal = sumAccumulators(
		baseSalariesExisting,
		housingExisting,
		transportExisting,
		responsibilityExisting,
		hsaExisting,
		newPositionsCost
	);

	// Category costs
	const categoryCostByName = groupByKey(
		categoryCosts,
		(c) => c.category,
		(c) => c.month,
		(c) => c.amount
	);

	let totalCategoryCosts = newAccum();
	for (const acc of categoryCostByName.values()) {
		totalCategoryCosts = sumAccumulators(totalCategoryCosts, acc);
	}

	// Employer charges
	const gosiAll = aggregateByMonth(
		staffCosts,
		(s) => s.month,
		(s) => s.gosiAmount
	);
	const eosAll = aggregateByMonth(
		staffCosts,
		(s) => s.month,
		(s) => s.eosMonthlyAccrual
	);
	const ajeerExisting = aggregateFiltered(
		staffCosts,
		isExisting,
		(s) => s.month,
		(s) => s.ajeerAmount
	);
	const ajeerNew = aggregateFiltered(
		staffCosts,
		isNew,
		(s) => s.month,
		(s) => s.ajeerAmount
	);

	const totalEmployerCharges = sumAccumulators(gosiAll, eosAll, ajeerExisting, ajeerNew);

	const totalStaffCosts = sumAccumulators(
		localSalariesTotal,
		totalCategoryCosts,
		totalEmployerCharges
	);

	// ── OPEX pre-aggregation ─────────────────────────────────────────────

	const operatingOpex = aggregateFiltered(
		opex,
		(o) =>
			o.sectionType === 'OPERATING' &&
			o.ifrsCategory !== 'Depreciation' &&
			o.ifrsCategory !== 'Impairment',
		(o) => o.month,
		(o) => o.amount
	);
	const operatingOpexByCategory = groupByKey(
		opex.filter(
			(o) =>
				o.sectionType === 'OPERATING' &&
				o.ifrsCategory !== 'Depreciation' &&
				o.ifrsCategory !== 'Impairment'
		),
		(o) => o.ifrsCategory,
		(o) => o.month,
		(o) => o.amount
	);
	// Detail lines within each operating opex category
	const operatingOpexByLineItem = groupByKey(
		opex.filter(
			(o) =>
				o.sectionType === 'OPERATING' &&
				o.ifrsCategory !== 'Depreciation' &&
				o.ifrsCategory !== 'Impairment'
		),
		(o) => `${o.ifrsCategory}::${o.lineItemName}`,
		(o) => o.month,
		(o) => o.amount
	);

	const depreciation = aggregateFiltered(
		opex,
		(o) => o.ifrsCategory === 'Depreciation',
		(o) => o.month,
		(o) => o.amount
	);
	const depreciationByLine = groupByKey(
		opex.filter((o) => o.ifrsCategory === 'Depreciation'),
		(o) => o.lineItemName,
		(o) => o.month,
		(o) => o.amount
	);

	const impairment = aggregateFiltered(
		opex,
		(o) => o.ifrsCategory === 'Impairment',
		(o) => o.month,
		(o) => o.amount
	);
	const impairmentByLine = groupByKey(
		opex.filter((o) => o.ifrsCategory === 'Impairment'),
		(o) => o.lineItemName,
		(o) => o.month,
		(o) => o.amount
	);

	const totalOpex = sumAccumulators(totalStaffCosts, operatingOpex, depreciation, impairment);

	// Finance
	const financeIncome = aggregateFiltered(
		opex,
		(o) => o.ifrsCategory === 'Finance Income',
		(o) => o.month,
		(o) => o.amount
	);
	const financeIncomeByLine = groupByKey(
		opex.filter((o) => o.ifrsCategory === 'Finance Income'),
		(o) => o.lineItemName,
		(o) => o.month,
		(o) => o.amount
	);

	const financeCosts = aggregateFiltered(
		opex,
		(o) => o.ifrsCategory === 'Finance Costs',
		(o) => o.month,
		(o) => o.amount
	);
	const financeCostsByLine = groupByKey(
		opex.filter((o) => o.ifrsCategory === 'Finance Costs'),
		(o) => o.lineItemName,
		(o) => o.month,
		(o) => o.amount
	);

	const netFinance = subtractAccumulators(financeIncome, financeCosts);

	// ── Emit lines per month ─────────────────────────────────────────────

	for (const month of MONTHS) {
		// ═══════════════════════════════════════════════════════════════
		// SECTION: REVENUE_CONTRACTS (100)
		// ═══════════════════════════════════════════════════════════════

		lines.push(
			makeLine(
				month,
				'REVENUE_CONTRACTS',
				'REVENUE_CONTRACTS',
				'REVENUE_CONTRACTS_HEADER',
				'Revenue from Contracts with Customers',
				1,
				100,
				ZERO,
				'POSITIVE',
				false,
				false
			)
		);

		// ── Tuition Fees (110) ───────────────────────────────────────
		lines.push(
			makeLine(
				month,
				'REVENUE_CONTRACTS',
				'TUITION_FEES',
				'TUITION_FEES_HEADER',
				'Tuition Fees',
				2,
				110,
				ZERO,
				'POSITIVE',
				false,
				false
			)
		);

		let gradeOrder = 111;
		const sortedGrades = [...tuitionByGrade.keys()].sort();
		for (const grade of sortedGrades) {
			const acc = tuitionByGrade.get(grade)!;
			lines.push(
				makeLine(
					month,
					'REVENUE_CONTRACTS',
					'TUITION_FEES',
					`TUITION_${safeKey(grade)}`,
					grade,
					3,
					gradeOrder++,
					getM(acc, month),
					'POSITIVE',
					false,
					false
				)
			);
		}

		// ── Registration Fees (120) ──────────────────────────────────
		lines.push(
			makeLine(
				month,
				'REVENUE_CONTRACTS',
				'REGISTRATION_FEES',
				'REGISTRATION_FEES_HEADER',
				'Registration Fees',
				2,
				120,
				ZERO,
				'POSITIVE',
				false,
				false
			)
		);

		let regOrder = 121;
		for (const [lineName, acc] of registrationByLine) {
			lines.push(
				makeLine(
					month,
					'REVENUE_CONTRACTS',
					'REGISTRATION_FEES',
					`REG_${safeKey(lineName)}`,
					lineName,
					3,
					regOrder++,
					getM(acc, month),
					'POSITIVE',
					false,
					false
				)
			);
		}

		// ── Activities & Services (130) ──────────────────────────────
		lines.push(
			makeLine(
				month,
				'REVENUE_CONTRACTS',
				'ACTIVITIES_SERVICES',
				'ACTIVITIES_SERVICES_HEADER',
				'Activities & Services',
				2,
				130,
				ZERO,
				'POSITIVE',
				false,
				false
			)
		);

		let actOrder = 131;
		for (const [lineName, acc] of activitiesByLine) {
			lines.push(
				makeLine(
					month,
					'REVENUE_CONTRACTS',
					'ACTIVITIES_SERVICES',
					`ACT_${safeKey(lineName)}`,
					lineName,
					3,
					actOrder++,
					getM(acc, month),
					'POSITIVE',
					false,
					false
				)
			);
		}

		// ── Examination Fees (140) ───────────────────────────────────
		lines.push(
			makeLine(
				month,
				'REVENUE_CONTRACTS',
				'EXAMINATION_FEES',
				'EXAMINATION_FEES_HEADER',
				'Examination Fees',
				2,
				140,
				ZERO,
				'POSITIVE',
				false,
				false
			)
		);

		let examOrder = 141;
		for (const [lineName, acc] of examinationByLine) {
			lines.push(
				makeLine(
					month,
					'REVENUE_CONTRACTS',
					'EXAMINATION_FEES',
					`EXAM_${safeKey(lineName)}`,
					lineName,
					3,
					examOrder++,
					getM(acc, month),
					'POSITIVE',
					false,
					false
				)
			);
		}

		// Revenue from Contracts subtotal (150)
		lines.push(
			makeLine(
				month,
				'REVENUE_CONTRACTS',
				'REVENUE_CONTRACTS',
				'REVENUE_CONTRACTS_SUBTOTAL',
				'Revenue from Contracts with Customers',
				1,
				150,
				getM(totalContractsRevenue, month),
				'POSITIVE',
				true,
				false
			)
		);

		// ═══════════════════════════════════════════════════════════════
		// SECTION: RENTAL_INCOME (200)
		// ═══════════════════════════════════════════════════════════════

		lines.push(
			makeLine(
				month,
				'RENTAL_INCOME',
				'RENTAL_INCOME',
				'RENTAL_INCOME_HEADER',
				'Rental Income',
				1,
				200,
				ZERO,
				'POSITIVE',
				false,
				false
			)
		);

		lines.push(
			makeLine(
				month,
				'RENTAL_INCOME',
				'RENTAL_INCOME',
				'RENTAL_INCOME_CAT',
				'Rental Income',
				2,
				210,
				ZERO,
				'POSITIVE',
				false,
				false
			)
		);

		let rentalOrder = 211;
		for (const [lineName, acc] of rentalByLine) {
			lines.push(
				makeLine(
					month,
					'RENTAL_INCOME',
					'RENTAL_INCOME',
					`RENTAL_${safeKey(lineName)}`,
					lineName,
					3,
					rentalOrder++,
					getM(acc, month),
					'POSITIVE',
					false,
					false
				)
			);
		}

		// Total Rental Income subtotal (220)
		lines.push(
			makeLine(
				month,
				'RENTAL_INCOME',
				'RENTAL_INCOME',
				'RENTAL_INCOME_SUBTOTAL',
				'Total Rental Income',
				1,
				220,
				getM(rentalIncome, month),
				'POSITIVE',
				true,
				false
			)
		);

		// ═══════════════════════════════════════════════════════════════
		// TOTAL_REVENUE (300) + separator (301)
		// ═══════════════════════════════════════════════════════════════

		lines.push(
			makeLine(
				month,
				'TOTAL_REVENUE',
				'TOTAL_REVENUE',
				'TOTAL_REVENUE',
				'Total Revenue',
				1,
				300,
				getM(totalRevenue, month),
				'POSITIVE',
				true,
				false
			)
		);

		lines.push(
			makeLine(
				month,
				'SEPARATOR',
				'SEPARATOR',
				'SEP_301',
				'',
				1,
				301,
				ZERO,
				'POSITIVE',
				false,
				true
			)
		);

		// ═══════════════════════════════════════════════════════════════
		// SECTION: STAFF_COSTS (400)
		// ═══════════════════════════════════════════════════════════════

		lines.push(
			makeLine(
				month,
				'STAFF_COSTS',
				'STAFF_COSTS',
				'STAFF_COSTS_HEADER',
				'Staff Costs',
				1,
				400,
				ZERO,
				'NEGATIVE',
				false,
				false
			)
		);

		// ── LOCAL_SALARIES (410) ─────────────────────────────────────
		lines.push(
			makeLine(
				month,
				'STAFF_COSTS',
				'LOCAL_SALARIES',
				'LOCAL_SALARIES_HEADER',
				'Local Staff Salaries',
				2,
				410,
				ZERO,
				'NEGATIVE',
				false,
				false
			)
		);

		lines.push(
			makeLine(
				month,
				'STAFF_COSTS',
				'LOCAL_SALARIES',
				'BASE_SALARIES_EXISTING',
				'Base Salaries (Existing Staff)',
				3,
				411,
				getM(baseSalariesExisting, month),
				'NEGATIVE',
				false,
				false
			)
		);

		lines.push(
			makeLine(
				month,
				'STAFF_COSTS',
				'LOCAL_SALARIES',
				'HOUSING_EXISTING',
				'Housing Allowance (Existing)',
				3,
				412,
				getM(housingExisting, month),
				'NEGATIVE',
				false,
				false
			)
		);

		lines.push(
			makeLine(
				month,
				'STAFF_COSTS',
				'LOCAL_SALARIES',
				'TRANSPORT_EXISTING',
				'Transport Allowance (Existing)',
				3,
				413,
				getM(transportExisting, month),
				'NEGATIVE',
				false,
				false
			)
		);

		lines.push(
			makeLine(
				month,
				'STAFF_COSTS',
				'LOCAL_SALARIES',
				'RESPONSIBILITY_EXISTING',
				'Responsibility Premium (Existing)',
				3,
				414,
				getM(responsibilityExisting, month),
				'NEGATIVE',
				false,
				false
			)
		);

		lines.push(
			makeLine(
				month,
				'STAFF_COSTS',
				'LOCAL_SALARIES',
				'HSA_EXISTING',
				'HSA Overtime (Existing)',
				3,
				415,
				getM(hsaExisting, month),
				'NEGATIVE',
				false,
				false
			)
		);

		lines.push(
			makeLine(
				month,
				'STAFF_COSTS',
				'LOCAL_SALARIES',
				'NEW_POSITIONS',
				'New Positions',
				3,
				416,
				getM(newPositionsCost, month),
				'NEGATIVE',
				false,
				false
			)
		);

		// ── ADDITIONAL_COSTS (420) ───────────────────────────────────
		lines.push(
			makeLine(
				month,
				'STAFF_COSTS',
				'ADDITIONAL_COSTS',
				'ADDITIONAL_COSTS_HEADER',
				'Additional Staff Costs',
				2,
				420,
				ZERO,
				'NEGATIVE',
				false,
				false
			)
		);

		let catOrder = 421;
		const sortedCategories = [...categoryCostByName.keys()].sort();
		for (const category of sortedCategories) {
			const acc = categoryCostByName.get(category)!;
			lines.push(
				makeLine(
					month,
					'STAFF_COSTS',
					'ADDITIONAL_COSTS',
					`CAT_${safeKey(category)}`,
					categoryLabel(category),
					3,
					catOrder++,
					getM(acc, month),
					'NEGATIVE',
					false,
					false
				)
			);
		}

		// ── EMPLOYER_CHARGES (430) ───────────────────────────────────
		lines.push(
			makeLine(
				month,
				'STAFF_COSTS',
				'EMPLOYER_CHARGES',
				'EMPLOYER_CHARGES_HEADER',
				'Employer Charges',
				2,
				430,
				ZERO,
				'NEGATIVE',
				false,
				false
			)
		);

		lines.push(
			makeLine(
				month,
				'STAFF_COSTS',
				'EMPLOYER_CHARGES',
				'GOSI_SAUDI',
				'GOSI -- Saudi Employees',
				3,
				431,
				getM(gosiAll, month),
				'NEGATIVE',
				false,
				false
			)
		);

		lines.push(
			makeLine(
				month,
				'STAFF_COSTS',
				'EMPLOYER_CHARGES',
				'EOS_PROVISION',
				'End of Service Provision',
				3,
				432,
				getM(eosAll, month),
				'NEGATIVE',
				false,
				false
			)
		);

		lines.push(
			makeLine(
				month,
				'STAFF_COSTS',
				'EMPLOYER_CHARGES',
				'AJEER_EXISTING',
				'Ajeer Costs -- Existing',
				3,
				433,
				getM(ajeerExisting, month),
				'NEGATIVE',
				false,
				false
			)
		);

		lines.push(
			makeLine(
				month,
				'STAFF_COSTS',
				'EMPLOYER_CHARGES',
				'AJEER_NEW',
				'Ajeer Costs -- New',
				3,
				434,
				getM(ajeerNew, month),
				'NEGATIVE',
				false,
				false
			)
		);

		// Total Staff Costs subtotal (450)
		lines.push(
			makeLine(
				month,
				'STAFF_COSTS',
				'STAFF_COSTS',
				'STAFF_COSTS_SUBTOTAL',
				'Total Staff Costs',
				1,
				450,
				getM(totalStaffCosts, month),
				'NEGATIVE',
				true,
				false
			)
		);

		// ═══════════════════════════════════════════════════════════════
		// SECTION: OTHER_OPEX (500)
		// ═══════════════════════════════════════════════════════════════

		lines.push(
			makeLine(
				month,
				'OTHER_OPEX',
				'OTHER_OPEX',
				'OTHER_OPEX_HEADER',
				'Other Operating Expenses',
				1,
				500,
				ZERO,
				'NEGATIVE',
				false,
				false
			)
		);

		let opexCatOrder = 501;
		const sortedOpexCategories = [...operatingOpexByCategory.keys()].sort();
		for (const category of sortedOpexCategories) {
			const catAcc = operatingOpexByCategory.get(category)!;

			// Category header (depth 2)
			lines.push(
				makeLine(
					month,
					'OTHER_OPEX',
					`OPEX_${safeKey(category)}`,
					`OPEX_${safeKey(category)}_HEADER`,
					category,
					2,
					opexCatOrder++,
					ZERO,
					'NEGATIVE',
					false,
					false
				)
			);

			// Detail lines within this category (depth 3)
			for (const [compositeKey, lineAcc] of operatingOpexByLineItem) {
				const [cat, lineName] = compositeKey.split('::');
				if (cat !== category) continue;
				lines.push(
					makeLine(
						month,
						'OTHER_OPEX',
						`OPEX_${safeKey(category)}`,
						`OPEX_${safeKey(lineName!)}`,
						lineName!,
						3,
						opexCatOrder++,
						getM(lineAcc, month),
						'NEGATIVE',
						false,
						false
					)
				);
			}

			// Category subtotal not emitted individually — section total covers it
			// but we can optionally add category totals for the "detailed" view
			lines.push(
				makeLine(
					month,
					'OTHER_OPEX',
					`OPEX_${safeKey(category)}`,
					`OPEX_${safeKey(category)}_SUBTOTAL`,
					`Total ${category}`,
					2,
					opexCatOrder++,
					getM(catAcc, month),
					'NEGATIVE',
					true,
					false
				)
			);
		}

		// Total Other Operating Expenses subtotal (590)
		lines.push(
			makeLine(
				month,
				'OTHER_OPEX',
				'OTHER_OPEX',
				'OTHER_OPEX_SUBTOTAL',
				'Total Other Operating Expenses',
				1,
				590,
				getM(operatingOpex, month),
				'NEGATIVE',
				true,
				false
			)
		);

		// ═══════════════════════════════════════════════════════════════
		// SECTION: DEPRECIATION (600)
		// ═══════════════════════════════════════════════════════════════

		lines.push(
			makeLine(
				month,
				'DEPRECIATION',
				'DEPRECIATION',
				'DEPRECIATION_HEADER',
				'Depreciation & Amortization',
				1,
				600,
				ZERO,
				'NEGATIVE',
				false,
				false
			)
		);

		let depOrder = 601;
		for (const [lineName, acc] of depreciationByLine) {
			lines.push(
				makeLine(
					month,
					'DEPRECIATION',
					'DEPRECIATION',
					`DEP_${safeKey(lineName)}`,
					lineName,
					3,
					depOrder++,
					getM(acc, month),
					'NEGATIVE',
					false,
					false
				)
			);
		}

		lines.push(
			makeLine(
				month,
				'DEPRECIATION',
				'DEPRECIATION',
				'DEPRECIATION_SUBTOTAL',
				'Total Depreciation & Amortization',
				1,
				650,
				getM(depreciation, month),
				'NEGATIVE',
				true,
				false
			)
		);

		// ═══════════════════════════════════════════════════════════════
		// SECTION: IMPAIRMENT (700)
		// ═══════════════════════════════════════════════════════════════

		lines.push(
			makeLine(
				month,
				'IMPAIRMENT',
				'IMPAIRMENT',
				'IMPAIRMENT_HEADER',
				'Impairment Losses',
				1,
				700,
				ZERO,
				'NEGATIVE',
				false,
				false
			)
		);

		let impOrder = 701;
		for (const [lineName, acc] of impairmentByLine) {
			lines.push(
				makeLine(
					month,
					'IMPAIRMENT',
					'IMPAIRMENT',
					`IMP_${safeKey(lineName)}`,
					lineName,
					3,
					impOrder++,
					getM(acc, month),
					'NEGATIVE',
					false,
					false
				)
			);
		}

		lines.push(
			makeLine(
				month,
				'IMPAIRMENT',
				'IMPAIRMENT',
				'IMPAIRMENT_SUBTOTAL',
				'Total Impairment Losses',
				1,
				750,
				getM(impairment, month),
				'NEGATIVE',
				true,
				false
			)
		);

		// ═══════════════════════════════════════════════════════════════
		// TOTAL_OPEX (800)
		// ═══════════════════════════════════════════════════════════════

		lines.push(
			makeLine(
				month,
				'TOTAL_OPEX',
				'TOTAL_OPEX',
				'TOTAL_OPEX',
				'Total Operating Expenses',
				1,
				800,
				getM(totalOpex, month),
				'NEGATIVE',
				true,
				false
			)
		);

		// ═══════════════════════════════════════════════════════════════
		// OPERATING_PROFIT (900) + separator (901)
		// ═══════════════════════════════════════════════════════════════

		const monthRevAmt = getM(totalRevenue, month);
		const monthOpexAmt = getM(totalOpex, month);
		const operatingProfit = monthRevAmt.minus(monthOpexAmt);

		lines.push(
			makeLine(
				month,
				'OPERATING_PROFIT',
				'OPERATING_PROFIT',
				'OPERATING_PROFIT',
				'Operating Profit / (Loss)',
				1,
				900,
				operatingProfit,
				'POSITIVE',
				true,
				false
			)
		);

		lines.push(
			makeLine(
				month,
				'SEPARATOR',
				'SEPARATOR',
				'SEP_901',
				'',
				1,
				901,
				ZERO,
				'POSITIVE',
				false,
				true
			)
		);

		// ═══════════════════════════════════════════════════════════════
		// SECTION: FINANCE_INCOME (1000)
		// ═══════════════════════════════════════════════════════════════

		lines.push(
			makeLine(
				month,
				'FINANCE_INCOME',
				'FINANCE_INCOME',
				'FINANCE_INCOME_HEADER',
				'Finance Income',
				1,
				1000,
				ZERO,
				'POSITIVE',
				false,
				false
			)
		);

		let finIncOrder = 1001;
		for (const [lineName, acc] of financeIncomeByLine) {
			lines.push(
				makeLine(
					month,
					'FINANCE_INCOME',
					'FINANCE_INCOME',
					`FININC_${safeKey(lineName)}`,
					lineName,
					3,
					finIncOrder++,
					getM(acc, month),
					'POSITIVE',
					false,
					false
				)
			);
		}

		lines.push(
			makeLine(
				month,
				'FINANCE_INCOME',
				'FINANCE_INCOME',
				'FINANCE_INCOME_SUBTOTAL',
				'Total Finance Income',
				1,
				1050,
				getM(financeIncome, month),
				'POSITIVE',
				true,
				false
			)
		);

		// ═══════════════════════════════════════════════════════════════
		// SECTION: FINANCE_COSTS (1100)
		// ═══════════════════════════════════════════════════════════════

		lines.push(
			makeLine(
				month,
				'FINANCE_COSTS',
				'FINANCE_COSTS',
				'FINANCE_COSTS_HEADER',
				'Finance Costs',
				1,
				1100,
				ZERO,
				'NEGATIVE',
				false,
				false
			)
		);

		let finCostOrder = 1101;
		for (const [lineName, acc] of financeCostsByLine) {
			lines.push(
				makeLine(
					month,
					'FINANCE_COSTS',
					'FINANCE_COSTS',
					`FINCOST_${safeKey(lineName)}`,
					lineName,
					3,
					finCostOrder++,
					getM(acc, month),
					'NEGATIVE',
					false,
					false
				)
			);
		}

		lines.push(
			makeLine(
				month,
				'FINANCE_COSTS',
				'FINANCE_COSTS',
				'FINANCE_COSTS_SUBTOTAL',
				'Total Finance Costs',
				1,
				1150,
				getM(financeCosts, month),
				'NEGATIVE',
				true,
				false
			)
		);

		// ═══════════════════════════════════════════════════════════════
		// NET_FINANCE (1200) + separator (1201)
		// ═══════════════════════════════════════════════════════════════

		lines.push(
			makeLine(
				month,
				'NET_FINANCE',
				'NET_FINANCE',
				'NET_FINANCE',
				'Net Finance Income / (Cost)',
				1,
				1200,
				getM(netFinance, month),
				'POSITIVE',
				true,
				false
			)
		);

		lines.push(
			makeLine(
				month,
				'SEPARATOR',
				'SEPARATOR',
				'SEP_1201',
				'',
				1,
				1201,
				ZERO,
				'POSITIVE',
				false,
				true
			)
		);

		// ═══════════════════════════════════════════════════════════════
		// PROFIT_BEFORE_ZAKAT (1300)
		// ═══════════════════════════════════════════════════════════════

		const profitBeforeZakat = operatingProfit.plus(getM(netFinance, month));

		lines.push(
			makeLine(
				month,
				'PROFIT_BEFORE_ZAKAT',
				'PROFIT_BEFORE_ZAKAT',
				'PROFIT_BEFORE_ZAKAT',
				'Profit / (Loss) Before Zakat',
				1,
				1300,
				profitBeforeZakat,
				'POSITIVE',
				true,
				false
			)
		);

		// ═══════════════════════════════════════════════════════════════
		// ZAKAT (1400) + separator (1401)
		// AC-05: per-month independently, 2.5% when positive, zero otherwise
		// ═══════════════════════════════════════════════════════════════

		const zakatAmount = profitBeforeZakat.gt(ZERO) ? profitBeforeZakat.times(ZAKAT_RATE) : ZERO;

		lines.push(
			makeLine(
				month,
				'ZAKAT',
				'ZAKAT',
				'ZAKAT',
				'Estimated Zakat (2.5%)',
				1,
				1400,
				zakatAmount,
				'NEGATIVE',
				true,
				false
			)
		);

		lines.push(
			makeLine(
				month,
				'SEPARATOR',
				'SEPARATOR',
				'SEP_1401',
				'',
				1,
				1401,
				ZERO,
				'POSITIVE',
				false,
				true
			)
		);

		// ═══════════════════════════════════════════════════════════════
		// NET_PROFIT (1500)
		// ═══════════════════════════════════════════════════════════════

		const netProfit = profitBeforeZakat.minus(zakatAmount);

		lines.push(
			makeLine(
				month,
				'NET_PROFIT',
				'NET_PROFIT',
				'NET_PROFIT',
				'Net Profit / (Loss)',
				1,
				1500,
				netProfit,
				'POSITIVE',
				true,
				false
			)
		);
	}

	// ── Build monthly summaries ──────────────────────────────────────────

	const summaries: BudgetSummaryOutput[] = [];

	for (const month of MONTHS) {
		const monthRev = getM(totalRevenue, month);
		const monthStaff = getM(totalStaffCosts, month);
		const monthOtherOpex = getM(operatingOpex, month);
		const monthDep = getM(depreciation, month);
		const monthImp = getM(impairment, month);

		// EBITDA = Total Revenue - Staff Costs - Other OpEx (excludes D&A, impairment, finance)
		const ebitda = monthRev.minus(monthStaff).minus(monthOtherOpex);
		const opProfit = monthRev
			.minus(monthStaff)
			.minus(monthOtherOpex)
			.minus(monthDep)
			.minus(monthImp);
		const monthNetFinance = getM(netFinance, month);
		const pBZ = opProfit.plus(monthNetFinance);
		const zakat = pBZ.gt(ZERO) ? pBZ.times(ZAKAT_RATE) : ZERO;
		const np = pBZ.minus(zakat);

		summaries.push({
			month,
			revenueHt: toFixed4(monthRev),
			staffCosts: toFixed4(monthStaff),
			opexCosts: toFixed4(monthOtherOpex),
			depreciation: toFixed4(monthDep),
			impairment: toFixed4(monthImp),
			ebitda: toFixed4(ebitda),
			operatingProfit: toFixed4(opProfit),
			financeNet: toFixed4(monthNetFinance),
			profitBeforeZakat: toFixed4(pBZ),
			zakatAmount: toFixed4(zakat),
			netProfit: toFixed4(np),
		});
	}

	// ── Build annual totals ──────────────────────────────────────────────

	const annualRevenue = sumAll(totalRevenue);
	const annualStaffCosts = sumAll(totalStaffCosts);
	const annualOtherOpex = sumAll(operatingOpex);
	const annualEbitda = annualRevenue.minus(annualStaffCosts).minus(annualOtherOpex);

	// Net profit from monthly summaries (preserves per-month Zakat behavior)
	let annualNetProfit = ZERO;
	for (const s of summaries) {
		annualNetProfit = annualNetProfit.plus(new Decimal(s.netProfit));
	}

	const ebitdaMarginPct = annualRevenue.isZero()
		? ZERO
		: annualEbitda.div(annualRevenue).times(100);

	return {
		lines,
		summaries,
		totals: {
			totalRevenueHt: toFixed4(annualRevenue),
			totalStaffCosts: toFixed4(annualStaffCosts),
			ebitda: toFixed4(annualEbitda),
			ebitdaMarginPct: toFixed4(ebitdaMarginPct),
			netProfit: toFixed4(annualNetProfit),
		},
	};
}

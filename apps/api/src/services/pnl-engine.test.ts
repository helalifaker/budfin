import { describe, it, expect } from 'vitest';
import {
	calculatePnl,
	type RevenueInput,
	type StaffCostInput,
	type CategoryCostInput,
	type OpExInput,
	type PnlLineOutput,
} from './pnl-engine.js';

// ── Test helpers ─────────────────────────────────────────────────────────────

function makeRevenue(overrides: Partial<RevenueInput> = {}): RevenueInput {
	return {
		month: 1,
		gradeLevel: 'CP',
		nationality: 'Nationaux',
		tariff: 'Plein',
		grossRevenueHt: '10000.0000',
		discountAmount: '500.0000',
		netRevenueHt: '9500.0000',
		...overrides,
	};
}

function makeOtherRevenue(
	overrides: Partial<import('./pnl-engine.js').OtherRevenueInput> = {}
): import('./pnl-engine.js').OtherRevenueInput {
	return {
		month: 1,
		lineItemName: 'DAI',
		ifrsCategory: 'Registration Fees',
		executiveCategory: 'REGISTRATION_FEES',
		amount: '1000.0000',
		...overrides,
	};
}

function makeStaffCost(overrides: Partial<StaffCostInput> = {}): StaffCostInput {
	return {
		month: 1,
		employeeId: 1,
		baseGross: '5000.0000',
		adjustedGross: '6000.0000',
		housingAllowance: '1500.0000',
		transportAllowance: '500.0000',
		responsibilityPremium: '200.0000',
		hsaAmount: '0.0000',
		gosiAmount: '705.0000',
		ajeerAmount: '910.4200',
		eosMonthlyAccrual: '300.0000',
		totalCost: '9115.4200',
		isNew: false,
		...overrides,
	};
}

function makeCategoryCost(overrides: Partial<CategoryCostInput> = {}): CategoryCostInput {
	return {
		month: 1,
		category: 'remplacements',
		amount: '200.0000',
		...overrides,
	};
}

function makeOpEx(overrides: Partial<OpExInput> = {}): OpExInput {
	return {
		month: 1,
		lineItemName: 'Utilities',
		sectionType: 'OPERATING',
		ifrsCategory: 'General & Administrative',
		amount: '3000.0000',
		...overrides,
	};
}

function findLines(
	lines: PnlLineOutput[],
	predicate: (l: PnlLineOutput) => boolean
): PnlLineOutput[] {
	return lines.filter(predicate);
}

function findLine(
	lines: PnlLineOutput[],
	lineItemKey: string,
	month: number
): PnlLineOutput | undefined {
	return lines.find((l) => l.lineItemKey === lineItemKey && l.month === month);
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('pnl-engine', () => {
	describe('calculatePnl with empty inputs', () => {
		it('should produce results with empty inputs', () => {
			const result = calculatePnl([], [], [], [], []);
			expect(result.lines.length).toBeGreaterThan(0);
			expect(result.summaries).toHaveLength(12);
			expect(result.totals.totalRevenueHt).toBe('0.0000');
			expect(result.totals.totalStaffCosts).toBe('0.0000');
			expect(result.totals.ebitda).toBe('0.0000');
			expect(result.totals.ebitdaMarginPct).toBe('0.0000');
			expect(result.totals.netProfit).toBe('0.0000');
		});

		it('should produce zero-amount summaries for all months', () => {
			const result = calculatePnl([], [], [], [], []);
			for (const summary of result.summaries) {
				expect(summary.revenueHt).toBe('0.0000');
				expect(summary.staffCosts).toBe('0.0000');
				expect(summary.netProfit).toBe('0.0000');
			}
		});
	});

	describe('revenue calculation', () => {
		it('should produce lines for all 12 months', () => {
			const revenue = [makeRevenue({ month: 3 })];
			const result = calculatePnl(revenue, [], [], [], []);
			expect(result.summaries).toHaveLength(12);
			const months = new Set(result.summaries.map((s) => s.month));
			expect(months.size).toBe(12);
		});

		it('should calculate revenue correctly for a single month', () => {
			const revenue = [makeRevenue({ month: 1, netRevenueHt: '9500.0000' })];
			const result = calculatePnl(revenue, [], [], [], []);
			expect(findLine(result.lines, 'TOTAL_REVENUE', 1)!.amount).toBe('9500.0000');
			expect(findLine(result.lines, 'TOTAL_REVENUE', 2)!.amount).toBe('0.0000');
		});

		it('should aggregate tuition by grade level', () => {
			const revenue = [
				makeRevenue({ month: 1, gradeLevel: 'CP', netRevenueHt: '5000.0000' }),
				makeRevenue({ month: 1, gradeLevel: 'CP', netRevenueHt: '3000.0000' }),
				makeRevenue({ month: 1, gradeLevel: 'CE1', netRevenueHt: '4000.0000' }),
			];
			const result = calculatePnl(revenue, [], [], [], []);
			expect(findLine(result.lines, 'TUITION_CP', 1)!.amount).toBe('8000.0000');
			expect(findLine(result.lines, 'TUITION_CE1', 1)!.amount).toBe('4000.0000');
			expect(findLine(result.lines, 'REVENUE_CONTRACTS_SUBTOTAL', 1)!.amount).toBe('12000.0000');
		});

		it('should include other revenue detail lines by category', () => {
			const otherRevenue = [
				makeOtherRevenue({
					month: 1,
					lineItemName: 'Registration Fee',
					executiveCategory: 'REGISTRATION_FEES',
					amount: '2000.0000',
				}),
				makeOtherRevenue({
					month: 1,
					lineItemName: 'After School Activity',
					executiveCategory: 'ACTIVITIES_SERVICES',
					amount: '1500.0000',
				}),
				makeOtherRevenue({
					month: 1,
					lineItemName: 'Baccalaureat Exam',
					executiveCategory: 'EXAMINATION_FEES',
					amount: '800.0000',
				}),
			];
			const result = calculatePnl([], otherRevenue, [], [], []);
			expect(findLine(result.lines, 'REG_REGISTRATION_FEE', 1)!.amount).toBe('2000.0000');
			expect(findLine(result.lines, 'ACT_AFTER_SCHOOL_ACTIVITY', 1)!.amount).toBe('1500.0000');
			expect(findLine(result.lines, 'EXAM_BACCALAUREAT_EXAM', 1)!.amount).toBe('800.0000');
			expect(findLine(result.lines, 'REVENUE_CONTRACTS_SUBTOTAL', 1)!.amount).toBe('4300.0000');
		});

		it('should include rental income in total revenue', () => {
			const otherRevenue = [
				makeOtherRevenue({
					month: 1,
					lineItemName: 'PSG Academy Rental',
					ifrsCategory: 'Rental Income',
					executiveCategory: '',
					amount: '5000.0000',
				}),
			];
			const result = calculatePnl([], otherRevenue, [], [], []);
			expect(findLine(result.lines, 'RENTAL_INCOME_SUBTOTAL', 1)!.amount).toBe('5000.0000');
			expect(findLine(result.lines, 'TOTAL_REVENUE', 1)!.amount).toBe('5000.0000');
		});
	});

	describe('sign conventions', () => {
		it('should output revenue as POSITIVE', () => {
			const revenue = [makeRevenue({ month: 1, netRevenueHt: '10000.0000' })];
			const result = calculatePnl(revenue, [], [], [], []);
			const totalRev = findLine(result.lines, 'TOTAL_REVENUE', 1);
			expect(totalRev!.signConvention).toBe('POSITIVE');
			expect(totalRev!.amount).toBe('10000.0000');
		});

		it('should output staff costs with NEGATIVE sign and positive magnitude', () => {
			const staffCosts = [makeStaffCost({ month: 1, baseGross: '5000.0000' })];
			const result = calculatePnl([], [], staffCosts, [], []);
			const baseSalaries = findLine(result.lines, 'BASE_SALARIES_EXISTING', 1);
			expect(baseSalaries!.signConvention).toBe('NEGATIVE');
			expect(baseSalaries!.amount).toBe('5000.0000');
		});

		it('should output operating expenses with NEGATIVE sign convention', () => {
			const opex = [makeOpEx({ month: 1, amount: '3000.0000' })];
			const result = calculatePnl([], [], [], [], opex);
			expect(findLine(result.lines, 'OTHER_OPEX_SUBTOTAL', 1)!.signConvention).toBe('NEGATIVE');
			expect(findLine(result.lines, 'OTHER_OPEX_SUBTOTAL', 1)!.amount).toBe('3000.0000');
		});

		it('should output finance costs with NEGATIVE sign convention', () => {
			const opex = [
				makeOpEx({
					month: 1,
					lineItemName: 'Bank Interest',
					sectionType: 'NON_OPERATING',
					ifrsCategory: 'Finance Costs',
					amount: '500.0000',
				}),
			];
			const result = calculatePnl([], [], [], [], opex);
			const finCostLines = findLines(
				result.lines,
				(l) => l.lineItemKey.startsWith('FINCOST_') && l.month === 1 && l.depth === 3
			);
			expect(finCostLines).toHaveLength(1);
			expect(finCostLines[0]!.amount).toBe('500.0000');
			expect(finCostLines[0]!.signConvention).toBe('NEGATIVE');
		});

		it('should output Zakat with NEGATIVE sign convention', () => {
			const revenue = [makeRevenue({ month: 1, netRevenueHt: '100000.0000' })];
			const result = calculatePnl(revenue, [], [], [], []);
			const zakatLine = findLine(result.lines, 'ZAKAT', 1);
			expect(zakatLine!.signConvention).toBe('NEGATIVE');
			expect(zakatLine!.amount).toBe('2500.0000');
		});
	});

	describe('staff cost breakdown with existing/new separation', () => {
		it('should break down existing staff costs into components', () => {
			const staffCosts = [
				makeStaffCost({
					month: 1,
					isNew: false,
					baseGross: '5000.0000',
					housingAllowance: '1500.0000',
					transportAllowance: '500.0000',
					responsibilityPremium: '200.0000',
					hsaAmount: '100.0000',
					gosiAmount: '705.0000',
					eosMonthlyAccrual: '300.0000',
					ajeerAmount: '910.4200',
				}),
			];
			const result = calculatePnl([], [], staffCosts, [], []);

			expect(findLine(result.lines, 'BASE_SALARIES_EXISTING', 1)!.amount).toBe('5000.0000');
			expect(findLine(result.lines, 'HOUSING_EXISTING', 1)!.amount).toBe('1500.0000');
			expect(findLine(result.lines, 'TRANSPORT_EXISTING', 1)!.amount).toBe('500.0000');
			expect(findLine(result.lines, 'RESPONSIBILITY_EXISTING', 1)!.amount).toBe('200.0000');
			expect(findLine(result.lines, 'HSA_EXISTING', 1)!.amount).toBe('100.0000');
			expect(findLine(result.lines, 'GOSI_SAUDI', 1)!.amount).toBe('705.0000');
			expect(findLine(result.lines, 'EOS_PROVISION', 1)!.amount).toBe('300.0000');
			expect(findLine(result.lines, 'AJEER_EXISTING', 1)!.amount).toBe('910.4200');
		});

		it('should separate new positions from existing staff', () => {
			const staffCosts = [
				makeStaffCost({
					month: 1,
					employeeId: 1,
					isNew: false,
					baseGross: '5000.0000',
					totalCost: '8000.0000',
					ajeerAmount: '500.0000',
				}),
				makeStaffCost({
					month: 1,
					employeeId: 2,
					isNew: true,
					baseGross: '4000.0000',
					totalCost: '6000.0000',
					ajeerAmount: '400.0000',
				}),
			];
			const result = calculatePnl([], [], staffCosts, [], []);

			expect(findLine(result.lines, 'BASE_SALARIES_EXISTING', 1)!.amount).toBe('5000.0000');
			expect(findLine(result.lines, 'NEW_POSITIONS', 1)!.amount).toBe('6000.0000');
			expect(findLine(result.lines, 'AJEER_EXISTING', 1)!.amount).toBe('500.0000');
			expect(findLine(result.lines, 'AJEER_NEW', 1)!.amount).toBe('400.0000');
		});

		it('should include category costs in staff costs total', () => {
			const staffCosts = [makeStaffCost({ month: 1, isNew: false })];
			const categoryCosts = [
				makeCategoryCost({ month: 1, category: 'remplacements', amount: '200.0000' }),
				makeCategoryCost({ month: 1, category: 'formation', amount: '100.0000' }),
			];
			const result = calculatePnl([], [], staffCosts, categoryCosts, []);
			const totalStaff = findLine(result.lines, 'STAFF_COSTS_SUBTOTAL', 1);
			expect(totalStaff!.isSubtotal).toBe(true);
			// Local: 5000+1500+500+200+0+0new=7200, Cat: 300, Emp: 705+300+910.42+0new=1915.42
			expect(totalStaff!.amount).toBe('9415.4200');
		});

		it('should display correct category cost labels', () => {
			const categoryCosts = [
				makeCategoryCost({ month: 1, category: 'remplacements', amount: '100.0000' }),
				makeCategoryCost({ month: 1, category: 'formation', amount: '50.0000' }),
			];
			const result = calculatePnl([], [], [], categoryCosts, []);
			expect(findLine(result.lines, 'CAT_REMPLACEMENTS', 1)!.displayLabel).toBe(
				'Replacement Contracts'
			);
			expect(findLine(result.lines, 'CAT_FORMATION', 1)!.displayLabel).toBe('Continuing Education');
		});
	});

	describe('EBITDA calculation', () => {
		it('should calculate EBITDA = revenue - staff - other opex (before D&A)', () => {
			const revenue = [makeRevenue({ month: 1, netRevenueHt: '50000.0000' })];
			const staffCosts = [
				makeStaffCost({
					month: 1,
					isNew: false,
					baseGross: '10000.0000',
					adjustedGross: '10000.0000',
					housingAllowance: '0.0000',
					transportAllowance: '0.0000',
					responsibilityPremium: '0.0000',
					hsaAmount: '0.0000',
					gosiAmount: '0.0000',
					ajeerAmount: '0.0000',
					eosMonthlyAccrual: '0.0000',
					totalCost: '10000.0000',
				}),
			];
			const opex = [
				makeOpEx({ month: 1, amount: '5000.0000' }),
				makeOpEx({
					month: 1,
					lineItemName: 'Building Dep',
					ifrsCategory: 'Depreciation',
					amount: '2000.0000',
				}),
			];
			const result = calculatePnl(revenue, [], staffCosts, [], opex);
			expect(result.summaries[0]!.ebitda).toBe('35000.0000');
		});

		it('should calculate EBITDA margin percentage', () => {
			const revenue: RevenueInput[] = [];
			const staffCosts: StaffCostInput[] = [];
			for (let m = 1; m <= 12; m++) {
				revenue.push(makeRevenue({ month: m, netRevenueHt: '10000.0000' }));
				staffCosts.push(
					makeStaffCost({
						month: m,
						isNew: false,
						baseGross: '3000.0000',
						adjustedGross: '3000.0000',
						housingAllowance: '0.0000',
						transportAllowance: '0.0000',
						responsibilityPremium: '0.0000',
						hsaAmount: '0.0000',
						gosiAmount: '0.0000',
						ajeerAmount: '0.0000',
						eosMonthlyAccrual: '0.0000',
						totalCost: '3000.0000',
					})
				);
			}
			const result = calculatePnl(revenue, [], staffCosts, [], []);
			expect(result.totals.ebitda).toBe('84000.0000');
			expect(result.totals.ebitdaMarginPct).toBe('70.0000');
		});

		it('should return 0 margin when revenue is zero', () => {
			const result = calculatePnl([], [], [], [], []);
			expect(result.totals.ebitdaMarginPct).toBe('0.0000');
		});
	});

	describe('Zakat calculation (AC-05)', () => {
		it('should apply 2.5% when profit before Zakat is positive', () => {
			const revenue = [makeRevenue({ month: 1, netRevenueHt: '100000.0000' })];
			const result = calculatePnl(revenue, [], [], [], []);
			expect(findLine(result.lines, 'ZAKAT', 1)!.amount).toBe('2500.0000');
		});

		it('should be zero when profit before Zakat is zero', () => {
			const result = calculatePnl([], [], [], [], []);
			expect(findLine(result.lines, 'ZAKAT', 1)!.amount).toBe('0.0000');
		});

		it('should be zero when profit is negative', () => {
			const staffCosts = [
				makeStaffCost({
					month: 1,
					isNew: false,
					baseGross: '50000.0000',
					adjustedGross: '50000.0000',
					housingAllowance: '0.0000',
					transportAllowance: '0.0000',
					responsibilityPremium: '0.0000',
					hsaAmount: '0.0000',
					gosiAmount: '0.0000',
					ajeerAmount: '0.0000',
					eosMonthlyAccrual: '0.0000',
					totalCost: '50000.0000',
				}),
			];
			const result = calculatePnl([], [], staffCosts, [], []);
			expect(findLine(result.lines, 'ZAKAT', 1)!.amount).toBe('0.0000');
		});

		it('should apply independently per month', () => {
			const revenue = [makeRevenue({ month: 1, netRevenueHt: '100000.0000' })];
			const staffCosts = [
				makeStaffCost({
					month: 2,
					isNew: false,
					baseGross: '20000.0000',
					adjustedGross: '20000.0000',
					housingAllowance: '0.0000',
					transportAllowance: '0.0000',
					responsibilityPremium: '0.0000',
					hsaAmount: '0.0000',
					gosiAmount: '0.0000',
					ajeerAmount: '0.0000',
					eosMonthlyAccrual: '0.0000',
					totalCost: '20000.0000',
				}),
			];
			const result = calculatePnl(revenue, [], staffCosts, [], []);
			expect(findLine(result.lines, 'ZAKAT', 1)!.amount).toBe('2500.0000');
			expect(findLine(result.lines, 'ZAKAT', 2)!.amount).toBe('0.0000');
		});
	});

	describe('net profit', () => {
		it('should calculate net profit = profit before zakat - zakat', () => {
			const revenue = [makeRevenue({ month: 1, netRevenueHt: '100000.0000' })];
			const result = calculatePnl(revenue, [], [], [], []);
			expect(findLine(result.lines, 'NET_PROFIT', 1)!.amount).toBe('97500.0000');
		});
	});

	describe('operating profit', () => {
		it('should calculate operating profit = revenue - total opex', () => {
			const revenue = [makeRevenue({ month: 1, netRevenueHt: '50000.0000' })];
			const staffCosts = [
				makeStaffCost({
					month: 1,
					isNew: false,
					baseGross: '10000.0000',
					adjustedGross: '10000.0000',
					housingAllowance: '0.0000',
					transportAllowance: '0.0000',
					responsibilityPremium: '0.0000',
					hsaAmount: '0.0000',
					gosiAmount: '0.0000',
					ajeerAmount: '0.0000',
					eosMonthlyAccrual: '0.0000',
					totalCost: '10000.0000',
				}),
			];
			const opex = [
				makeOpEx({ month: 1, amount: '5000.0000' }),
				makeOpEx({
					month: 1,
					lineItemName: 'Dep',
					ifrsCategory: 'Depreciation',
					amount: '2000.0000',
				}),
			];
			const result = calculatePnl(revenue, [], staffCosts, [], opex);
			expect(findLine(result.lines, 'OPERATING_PROFIT', 1)!.amount).toBe('33000.0000');
		});
	});

	describe('finance section', () => {
		it('should calculate net finance = income - costs', () => {
			const opex = [
				makeOpEx({
					month: 1,
					lineItemName: 'Bank Interest Income',
					sectionType: 'NON_OPERATING',
					ifrsCategory: 'Finance Income',
					amount: '1000.0000',
				}),
				makeOpEx({
					month: 1,
					lineItemName: 'Loan Interest',
					sectionType: 'NON_OPERATING',
					ifrsCategory: 'Finance Costs',
					amount: '400.0000',
				}),
			];
			const result = calculatePnl([], [], [], [], opex);
			expect(findLine(result.lines, 'NET_FINANCE', 1)!.amount).toBe('600.0000');
		});

		it('should show finance income detail lines', () => {
			const opex = [
				makeOpEx({
					month: 1,
					lineItemName: 'Bank Interest',
					sectionType: 'NON_OPERATING',
					ifrsCategory: 'Finance Income',
					amount: '750.0000',
				}),
			];
			const result = calculatePnl([], [], [], [], opex);
			const finIncLine = findLine(result.lines, 'FININC_BANK_INTEREST', 1);
			expect(finIncLine!.amount).toBe('750.0000');
			expect(finIncLine!.signConvention).toBe('POSITIVE');
			expect(finIncLine!.depth).toBe(3);
		});
	});

	describe('IFRS sections structure', () => {
		it('should contain all 15 required IFRS section keys', () => {
			const result = calculatePnl([], [], [], [], []);
			const sectionKeys = new Set(result.lines.map((l) => l.sectionKey));
			for (const section of [
				'REVENUE_CONTRACTS',
				'RENTAL_INCOME',
				'TOTAL_REVENUE',
				'STAFF_COSTS',
				'OTHER_OPEX',
				'DEPRECIATION',
				'IMPAIRMENT',
				'TOTAL_OPEX',
				'OPERATING_PROFIT',
				'FINANCE_INCOME',
				'FINANCE_COSTS',
				'NET_FINANCE',
				'PROFIT_BEFORE_ZAKAT',
				'ZAKAT',
				'NET_PROFIT',
			]) {
				expect(sectionKeys.has(section), `Missing section: ${section}`).toBe(true);
			}
		});

		it('should have non-decreasing display orders within each month', () => {
			const result = calculatePnl(
				[makeRevenue({ month: 1 })],
				[],
				[makeStaffCost({ month: 1 })],
				[],
				[makeOpEx({ month: 1 })]
			);
			const month1Lines = result.lines.filter((l) => l.month === 1);
			for (let i = 1; i < month1Lines.length; i++) {
				expect(month1Lines[i]!.displayOrder).toBeGreaterThanOrEqual(
					month1Lines[i - 1]!.displayOrder
				);
			}
		});

		it('should include separators between major sections', () => {
			const result = calculatePnl([], [], [], [], []);
			const m1 = result.lines.filter((l) => l.month === 1);
			for (const key of ['SEP_301', 'SEP_901', 'SEP_1201', 'SEP_1401']) {
				const sep = m1.find((l) => l.lineItemKey === key);
				expect(sep, `Missing separator: ${key}`).toBeDefined();
				expect(sep!.isSeparator).toBe(true);
			}
		});

		it('should mark subtotals correctly', () => {
			const result = calculatePnl(
				[makeRevenue({ month: 1 })],
				[],
				[makeStaffCost({ month: 1 })],
				[],
				[]
			);
			const m1 = result.lines.filter((l) => l.month === 1);
			for (const key of [
				'REVENUE_CONTRACTS_SUBTOTAL',
				'RENTAL_INCOME_SUBTOTAL',
				'TOTAL_REVENUE',
				'STAFF_COSTS_SUBTOTAL',
				'OTHER_OPEX_SUBTOTAL',
				'DEPRECIATION_SUBTOTAL',
				'IMPAIRMENT_SUBTOTAL',
				'TOTAL_OPEX',
				'OPERATING_PROFIT',
				'NET_FINANCE',
				'PROFIT_BEFORE_ZAKAT',
				'NET_PROFIT',
			]) {
				const line = m1.find((l) => l.lineItemKey === key);
				expect(line, `Expected ${key} to exist`).toBeDefined();
				expect(line!.isSubtotal, `Expected ${key} to be subtotal`).toBe(true);
			}
		});

		it('should use correct display order ranges', () => {
			const result = calculatePnl([], [], [], [], []);
			const m1 = result.lines.filter((l) => l.month === 1);
			expect(m1.find((l) => l.lineItemKey === 'REVENUE_CONTRACTS_HEADER')!.displayOrder).toBe(100);
			expect(m1.find((l) => l.lineItemKey === 'TOTAL_REVENUE')!.displayOrder).toBe(300);
			expect(m1.find((l) => l.lineItemKey === 'STAFF_COSTS_HEADER')!.displayOrder).toBe(400);
			expect(m1.find((l) => l.lineItemKey === 'STAFF_COSTS_SUBTOTAL')!.displayOrder).toBe(450);
			expect(m1.find((l) => l.lineItemKey === 'TOTAL_OPEX')!.displayOrder).toBe(800);
			expect(m1.find((l) => l.lineItemKey === 'OPERATING_PROFIT')!.displayOrder).toBe(900);
			expect(m1.find((l) => l.lineItemKey === 'NET_PROFIT')!.displayOrder).toBe(1500);
		});
	});

	describe('monthly aggregation', () => {
		it('should aggregate multiple employees in the same month', () => {
			const staffCosts = [
				makeStaffCost({ month: 1, employeeId: 1, isNew: false, baseGross: '5000.0000' }),
				makeStaffCost({ month: 1, employeeId: 2, isNew: false, baseGross: '7000.0000' }),
				makeStaffCost({ month: 1, employeeId: 3, isNew: false, baseGross: '3000.0000' }),
			];
			const result = calculatePnl([], [], staffCosts, [], []);
			expect(findLine(result.lines, 'BASE_SALARIES_EXISTING', 1)!.amount).toBe('15000.0000');
		});

		it('should keep months independent', () => {
			const revenue = [
				makeRevenue({ month: 1, netRevenueHt: '10000.0000' }),
				makeRevenue({ month: 6, netRevenueHt: '20000.0000' }),
				makeRevenue({ month: 12, netRevenueHt: '15000.0000' }),
			];
			const result = calculatePnl(revenue, [], [], [], []);
			expect(findLine(result.lines, 'TOTAL_REVENUE', 1)!.amount).toBe('10000.0000');
			expect(findLine(result.lines, 'TOTAL_REVENUE', 6)!.amount).toBe('20000.0000');
			expect(findLine(result.lines, 'TOTAL_REVENUE', 12)!.amount).toBe('15000.0000');
			expect(findLine(result.lines, 'TOTAL_REVENUE', 3)!.amount).toBe('0.0000');
		});

		it('should compute annual totals from all 12 months', () => {
			const revenue: RevenueInput[] = [];
			for (let m = 1; m <= 12; m++) {
				revenue.push(makeRevenue({ month: m, netRevenueHt: '10000.0000' }));
			}
			const result = calculatePnl(revenue, [], [], [], []);
			expect(result.totals.totalRevenueHt).toBe('120000.0000');
		});
	});

	describe('depreciation and impairment', () => {
		it('should separate depreciation from other opex', () => {
			const opex = [
				makeOpEx({ month: 1, ifrsCategory: 'General & Administrative', amount: '3000.0000' }),
				makeOpEx({
					month: 1,
					lineItemName: 'Building Dep',
					ifrsCategory: 'Depreciation',
					amount: '2000.0000',
				}),
			];
			const result = calculatePnl([], [], [], [], opex);
			expect(findLine(result.lines, 'OTHER_OPEX_SUBTOTAL', 1)!.amount).toBe('3000.0000');
			expect(findLine(result.lines, 'DEPRECIATION_SUBTOTAL', 1)!.amount).toBe('2000.0000');
		});

		it('should include impairment in total opex', () => {
			const opex = [
				makeOpEx({
					month: 1,
					lineItemName: 'Goodwill',
					ifrsCategory: 'Impairment',
					amount: '1000.0000',
				}),
			];
			const result = calculatePnl([], [], [], [], opex);
			expect(findLine(result.lines, 'IMPAIRMENT_SUBTOTAL', 1)!.amount).toBe('1000.0000');
			expect(findLine(result.lines, 'TOTAL_OPEX', 1)!.amount).toBe('1000.0000');
		});
	});

	describe('full integration', () => {
		it('should compute a complete P&L with all input types', () => {
			const revenue = [makeRevenue({ month: 1, netRevenueHt: '100000.0000' })];
			const otherRevenue = [
				makeOtherRevenue({
					month: 1,
					lineItemName: 'Registration',
					executiveCategory: 'REGISTRATION_FEES',
					amount: '5000.0000',
				}),
				makeOtherRevenue({
					month: 1,
					lineItemName: 'PSG Academy Rental',
					ifrsCategory: 'Rental Income',
					executiveCategory: '',
					amount: '2000.0000',
				}),
			];
			const staffCosts = [
				makeStaffCost({
					month: 1,
					isNew: false,
					baseGross: '20000.0000',
					adjustedGross: '20000.0000',
					housingAllowance: '5000.0000',
					transportAllowance: '1000.0000',
					responsibilityPremium: '500.0000',
					hsaAmount: '0.0000',
					gosiAmount: '2350.0000',
					ajeerAmount: '910.4200',
					eosMonthlyAccrual: '1000.0000',
					totalCost: '30760.4200',
				}),
			];
			const categoryCosts = [
				makeCategoryCost({ month: 1, category: 'remplacements', amount: '400.0000' }),
			];
			const opex = [
				makeOpEx({ month: 1, amount: '8000.0000' }),
				makeOpEx({
					month: 1,
					lineItemName: 'Depreciation',
					ifrsCategory: 'Depreciation',
					amount: '3000.0000',
				}),
				makeOpEx({
					month: 1,
					lineItemName: 'Interest Income',
					sectionType: 'NON_OPERATING',
					ifrsCategory: 'Finance Income',
					amount: '500.0000',
				}),
			];

			const result = calculatePnl(revenue, otherRevenue, staffCosts, categoryCosts, opex);

			expect(findLine(result.lines, 'TOTAL_REVENUE', 1)!.amount).toBe('107000.0000');
			expect(findLine(result.lines, 'STAFF_COSTS_SUBTOTAL', 1)!.amount).toBe('31160.4200');
			expect(findLine(result.lines, 'TOTAL_OPEX', 1)!.amount).toBe('42160.4200');
			expect(findLine(result.lines, 'OPERATING_PROFIT', 1)!.amount).toBe('64839.5800');
			expect(findLine(result.lines, 'NET_FINANCE', 1)!.amount).toBe('500.0000');
			expect(findLine(result.lines, 'PROFIT_BEFORE_ZAKAT', 1)!.amount).toBe('65339.5800');
			expect(findLine(result.lines, 'ZAKAT', 1)!.amount).toBe('1633.4895');
			expect(findLine(result.lines, 'NET_PROFIT', 1)!.amount).toBe('63706.0905');
			expect(result.summaries[0]!.revenueHt).toBe('107000.0000');
			expect(result.summaries[0]!.staffCosts).toBe('31160.4200');
			expect(result.summaries[0]!.ebitda).toBe('67839.5800');
		});

		it('should compute full 12-month P&L', () => {
			const revenue: RevenueInput[] = [];
			const staffCosts: StaffCostInput[] = [];
			for (let m = 1; m <= 12; m++) {
				revenue.push(makeRevenue({ month: m, netRevenueHt: '100000.0000' }));
				staffCosts.push(
					makeStaffCost({
						month: m,
						isNew: false,
						baseGross: '20000.0000',
						adjustedGross: '20000.0000',
						housingAllowance: '5000.0000',
						transportAllowance: '1000.0000',
						responsibilityPremium: '500.0000',
						hsaAmount: '0.0000',
						gosiAmount: '2350.0000',
						ajeerAmount: '910.4200',
						eosMonthlyAccrual: '1000.0000',
						totalCost: '30760.4200',
					})
				);
			}
			const result = calculatePnl(revenue, [], staffCosts, [], []);
			expect(result.summaries).toHaveLength(12);
			expect(result.totals.totalRevenueHt).toBe('1200000.0000');
			expect(result.summaries[5]!.revenueHt).toBe('100000.0000');
		});
	});

	describe('decimal precision (TC-001, TC-004)', () => {
		it('should preserve 4 decimal places in all outputs', () => {
			const revenue = [makeRevenue({ month: 1, netRevenueHt: '33333.3333' })];
			const result = calculatePnl(revenue, [], [], [], []);
			expect(findLine(result.lines, 'TOTAL_REVENUE', 1)!.amount).toMatch(/^-?\d+\.\d{4}$/);
		});

		it('should accumulate without intermediate rounding (TC-004)', () => {
			const revenue = [
				makeRevenue({ month: 1, gradeLevel: 'CP', netRevenueHt: '33333.3333' }),
				makeRevenue({ month: 1, gradeLevel: 'CE1', netRevenueHt: '33333.3333' }),
				makeRevenue({ month: 1, gradeLevel: 'CE2', netRevenueHt: '33333.3334' }),
			];
			const result = calculatePnl(revenue, [], [], [], []);
			expect(findLine(result.lines, 'REVENUE_CONTRACTS_SUBTOTAL', 1)!.amount).toBe('100000.0000');
		});

		it('should use Decimal.js ROUND_HALF_UP for final serialization', () => {
			const revenue = [makeRevenue({ month: 1, netRevenueHt: '100.00005' })];
			const result = calculatePnl(revenue, [], [], [], []);
			expect(findLine(result.lines, 'TOTAL_REVENUE', 1)!.amount).toBe('100.0001');
		});
	});
});

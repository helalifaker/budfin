import type { PrismaClient } from '@prisma/client';
import type { MigrationLog } from '../lib/types.js';
import { MigrationLogger } from '../lib/logger.js';

// ── Nationality seed data ───────────────────────────────────────────────────

const NATIONALITIES = [
	{ code: 'FR', label: 'Francais', vatExempt: false },
	{ code: 'NAT', label: 'Nationaux', vatExempt: false },
	{ code: 'AUT', label: 'Autres', vatExempt: false },
] as const;

// ── Tariff seed data ────────────────────────────────────────────────────────

const TARIFFS = [
	{ code: 'PLEIN', label: 'Plein Tarif' },
	{ code: 'RP', label: 'Reduit Personnel' },
	{ code: 'R3P', label: 'Reduit 3+' },
] as const;

// ── Department seed data ────────────────────────────────────────────────────

const DEPARTMENTS = [
	{ code: 'TEACHING', label: 'Teaching', bandMapping: 'NON_ACADEMIC' as const },
	{ code: 'ADMIN', label: 'Administration', bandMapping: 'NON_ACADEMIC' as const },
	{ code: 'SUPPORT', label: 'Support', bandMapping: 'NON_ACADEMIC' as const },
	{ code: 'MGMT', label: 'Management', bandMapping: 'NON_ACADEMIC' as const },
	{ code: 'MAINT', label: 'Maintenance', bandMapping: 'NON_ACADEMIC' as const },
] as const;

// ── Academic Year seed data ─────────────────────────────────────────────────

function buildAcademicYears() {
	const years: Array<{
		fiscalYear: string;
		ay1Start: Date;
		ay1End: Date;
		summerStart: Date;
		summerEnd: Date;
		ay2Start: Date;
		ay2End: Date;
		academicWeeks: number;
	}> = [];

	for (let fy = 2022; fy <= 2027; fy++) {
		// AY1 runs Jan-Jun of the fiscal year
		// Summer runs Jul-Aug
		// AY2 runs Sep-Dec
		years.push({
			fiscalYear: `FY${fy}`,
			ay1Start: new Date(`${fy}-01-01`),
			ay1End: new Date(`${fy}-06-30`),
			summerStart: new Date(`${fy}-07-01`),
			summerEnd: new Date(`${fy}-08-31`),
			ay2Start: new Date(`${fy}-09-01`),
			ay2End: new Date(`${fy}-12-31`),
			academicWeeks: 36,
		});
	}

	return years;
}

// ── Chart of Accounts seed data ─────────────────────────────────────────────

interface AccountDef {
	accountCode: string;
	accountName: string;
	type: 'REVENUE' | 'EXPENSE';
	ifrsCategory: string;
	centerType: 'PROFIT_CENTER' | 'COST_CENTER';
}

const REVENUE_ACCOUNTS: AccountDef[] = [
	{
		accountCode: 'R001',
		accountName: 'Tuition HT — Maternelle',
		type: 'REVENUE',
		ifrsCategory: 'Tuition Revenue',
		centerType: 'PROFIT_CENTER',
	},
	{
		accountCode: 'R002',
		accountName: 'Tuition HT — Elementaire',
		type: 'REVENUE',
		ifrsCategory: 'Tuition Revenue',
		centerType: 'PROFIT_CENTER',
	},
	{
		accountCode: 'R003',
		accountName: 'Tuition HT — College',
		type: 'REVENUE',
		ifrsCategory: 'Tuition Revenue',
		centerType: 'PROFIT_CENTER',
	},
	{
		accountCode: 'R004',
		accountName: 'Tuition HT — Lycee',
		type: 'REVENUE',
		ifrsCategory: 'Tuition Revenue',
		centerType: 'PROFIT_CENTER',
	},
	{
		accountCode: 'R005',
		accountName: 'DAI Revenue',
		type: 'REVENUE',
		ifrsCategory: 'Registration Fees',
		centerType: 'PROFIT_CENTER',
	},
	{
		accountCode: 'R006',
		accountName: 'DPI Revenue',
		type: 'REVENUE',
		ifrsCategory: 'Registration Fees',
		centerType: 'PROFIT_CENTER',
	},
	{
		accountCode: 'R007',
		accountName: 'Frais de Dossier',
		type: 'REVENUE',
		ifrsCategory: 'Registration Fees',
		centerType: 'PROFIT_CENTER',
	},
	{
		accountCode: 'R008',
		accountName: 'Examination Fees — BAC',
		type: 'REVENUE',
		ifrsCategory: 'Examination Fees',
		centerType: 'PROFIT_CENTER',
	},
	{
		accountCode: 'R009',
		accountName: 'Examination Fees — DNB',
		type: 'REVENUE',
		ifrsCategory: 'Examination Fees',
		centerType: 'PROFIT_CENTER',
	},
	{
		accountCode: 'R010',
		accountName: 'Examination Fees — EAF',
		type: 'REVENUE',
		ifrsCategory: 'Examination Fees',
		centerType: 'PROFIT_CENTER',
	},
	{
		accountCode: 'R011',
		accountName: 'Examination Fees — SIELE',
		type: 'REVENUE',
		ifrsCategory: 'Examination Fees',
		centerType: 'PROFIT_CENTER',
	},
	{
		accountCode: 'R012',
		accountName: 'After-School Activities',
		type: 'REVENUE',
		ifrsCategory: 'Activities & Services',
		centerType: 'PROFIT_CENTER',
	},
	{
		accountCode: 'R013',
		accountName: 'Daycare Revenue',
		type: 'REVENUE',
		ifrsCategory: 'Activities & Services',
		centerType: 'PROFIT_CENTER',
	},
	{
		accountCode: 'R014',
		accountName: 'Class Photos Revenue',
		type: 'REVENUE',
		ifrsCategory: 'Activities & Services',
		centerType: 'PROFIT_CENTER',
	},
	{
		accountCode: 'R015',
		accountName: 'PSG Academy Rental',
		type: 'REVENUE',
		ifrsCategory: 'Activities & Services',
		centerType: 'PROFIT_CENTER',
	},
	{
		accountCode: 'R016',
		accountName: 'Evaluation Fees',
		type: 'REVENUE',
		ifrsCategory: 'Registration Fees',
		centerType: 'PROFIT_CENTER',
	},
	{
		accountCode: 'R017',
		accountName: 'Bourses AEFE',
		type: 'REVENUE',
		ifrsCategory: 'Other Revenue',
		centerType: 'PROFIT_CENTER',
	},
	{
		accountCode: 'R018',
		accountName: 'Bourses AESH',
		type: 'REVENUE',
		ifrsCategory: 'Other Revenue',
		centerType: 'PROFIT_CENTER',
	},
];

const STAFF_COST_ACCOUNTS: AccountDef[] = [
	{
		accountCode: 'SC001',
		accountName: 'Base Salary — Residents',
		type: 'EXPENSE',
		ifrsCategory: 'Staff Costs',
		centerType: 'COST_CENTER',
	},
	{
		accountCode: 'SC002',
		accountName: 'Base Salary — Contrats Locaux',
		type: 'EXPENSE',
		ifrsCategory: 'Staff Costs',
		centerType: 'COST_CENTER',
	},
	{
		accountCode: 'SC003',
		accountName: 'Housing Allowance',
		type: 'EXPENSE',
		ifrsCategory: 'Staff Costs',
		centerType: 'COST_CENTER',
	},
	{
		accountCode: 'SC004',
		accountName: 'Transport Allowance',
		type: 'EXPENSE',
		ifrsCategory: 'Staff Costs',
		centerType: 'COST_CENTER',
	},
	{
		accountCode: 'SC005',
		accountName: 'Responsibility Premium',
		type: 'EXPENSE',
		ifrsCategory: 'Staff Costs',
		centerType: 'COST_CENTER',
	},
	{
		accountCode: 'SC006',
		accountName: 'HSA Payments',
		type: 'EXPENSE',
		ifrsCategory: 'Staff Costs',
		centerType: 'COST_CENTER',
	},
	{
		accountCode: 'SC007',
		accountName: 'Augmentation Costs',
		type: 'EXPENSE',
		ifrsCategory: 'Staff Costs',
		centerType: 'COST_CENTER',
	},
	{
		accountCode: 'SC008',
		accountName: 'GOSI Employer Contribution',
		type: 'EXPENSE',
		ifrsCategory: 'Staff Costs',
		centerType: 'COST_CENTER',
	},
	{
		accountCode: 'SC009',
		accountName: 'GOSI Employee Contribution',
		type: 'EXPENSE',
		ifrsCategory: 'Staff Costs',
		centerType: 'COST_CENTER',
	},
	{
		accountCode: 'SC010',
		accountName: 'Ajeer Levy',
		type: 'EXPENSE',
		ifrsCategory: 'Staff Costs',
		centerType: 'COST_CENTER',
	},
	{
		accountCode: 'SC011',
		accountName: 'Ajeer Monthly Fee',
		type: 'EXPENSE',
		ifrsCategory: 'Staff Costs',
		centerType: 'COST_CENTER',
	},
	{
		accountCode: 'SC012',
		accountName: 'End of Service — Accrual',
		type: 'EXPENSE',
		ifrsCategory: 'Staff Costs',
		centerType: 'COST_CENTER',
	},
	{
		accountCode: 'SC013',
		accountName: 'Recruitment Costs',
		type: 'EXPENSE',
		ifrsCategory: 'Staff Costs',
		centerType: 'COST_CENTER',
	},
	{
		accountCode: 'SC014',
		accountName: 'Training & Development',
		type: 'EXPENSE',
		ifrsCategory: 'Staff Costs',
		centerType: 'COST_CENTER',
	},
	{
		accountCode: 'SC015',
		accountName: 'Staff Insurance',
		type: 'EXPENSE',
		ifrsCategory: 'Staff Costs',
		centerType: 'COST_CENTER',
	},
];

const OPEX_ACCOUNTS: AccountDef[] = [
	{
		accountCode: 'OX001',
		accountName: 'Building Rent',
		type: 'EXPENSE',
		ifrsCategory: 'Occupancy',
		centerType: 'COST_CENTER',
	},
	{
		accountCode: 'OX002',
		accountName: 'Building Maintenance',
		type: 'EXPENSE',
		ifrsCategory: 'Occupancy',
		centerType: 'COST_CENTER',
	},
	{
		accountCode: 'OX003',
		accountName: 'Utilities — Electricity',
		type: 'EXPENSE',
		ifrsCategory: 'Occupancy',
		centerType: 'COST_CENTER',
	},
	{
		accountCode: 'OX004',
		accountName: 'Utilities — Water',
		type: 'EXPENSE',
		ifrsCategory: 'Occupancy',
		centerType: 'COST_CENTER',
	},
	{
		accountCode: 'OX005',
		accountName: 'Utilities — Gas',
		type: 'EXPENSE',
		ifrsCategory: 'Occupancy',
		centerType: 'COST_CENTER',
	},
	{
		accountCode: 'OX006',
		accountName: 'Security Services',
		type: 'EXPENSE',
		ifrsCategory: 'Occupancy',
		centerType: 'COST_CENTER',
	},
	{
		accountCode: 'OX007',
		accountName: 'Cleaning Services',
		type: 'EXPENSE',
		ifrsCategory: 'Occupancy',
		centerType: 'COST_CENTER',
	},
	{
		accountCode: 'OX008',
		accountName: 'Insurance — Property',
		type: 'EXPENSE',
		ifrsCategory: 'Insurance',
		centerType: 'COST_CENTER',
	},
	{
		accountCode: 'OX009',
		accountName: 'Insurance — Liability',
		type: 'EXPENSE',
		ifrsCategory: 'Insurance',
		centerType: 'COST_CENTER',
	},
	{
		accountCode: 'OX010',
		accountName: 'Insurance — Vehicle',
		type: 'EXPENSE',
		ifrsCategory: 'Insurance',
		centerType: 'COST_CENTER',
	},
	{
		accountCode: 'OX011',
		accountName: 'IT Infrastructure',
		type: 'EXPENSE',
		ifrsCategory: 'Technology',
		centerType: 'COST_CENTER',
	},
	{
		accountCode: 'OX012',
		accountName: 'Software Licenses',
		type: 'EXPENSE',
		ifrsCategory: 'Technology',
		centerType: 'COST_CENTER',
	},
	{
		accountCode: 'OX013',
		accountName: 'Network & Internet',
		type: 'EXPENSE',
		ifrsCategory: 'Technology',
		centerType: 'COST_CENTER',
	},
	{
		accountCode: 'OX014',
		accountName: 'IT Equipment',
		type: 'EXPENSE',
		ifrsCategory: 'Technology',
		centerType: 'COST_CENTER',
	},
	{
		accountCode: 'OX015',
		accountName: 'IT Support Services',
		type: 'EXPENSE',
		ifrsCategory: 'Technology',
		centerType: 'COST_CENTER',
	},
	{
		accountCode: 'OX016',
		accountName: 'Textbooks & Curriculum',
		type: 'EXPENSE',
		ifrsCategory: 'Educational',
		centerType: 'COST_CENTER',
	},
	{
		accountCode: 'OX017',
		accountName: 'Library Resources',
		type: 'EXPENSE',
		ifrsCategory: 'Educational',
		centerType: 'COST_CENTER',
	},
	{
		accountCode: 'OX018',
		accountName: 'Laboratory Supplies',
		type: 'EXPENSE',
		ifrsCategory: 'Educational',
		centerType: 'COST_CENTER',
	},
	{
		accountCode: 'OX019',
		accountName: 'Sports Equipment',
		type: 'EXPENSE',
		ifrsCategory: 'Educational',
		centerType: 'COST_CENTER',
	},
	{
		accountCode: 'OX020',
		accountName: 'Art & Music Supplies',
		type: 'EXPENSE',
		ifrsCategory: 'Educational',
		centerType: 'COST_CENTER',
	},
	{
		accountCode: 'OX021',
		accountName: 'Office Supplies',
		type: 'EXPENSE',
		ifrsCategory: 'Administrative',
		centerType: 'COST_CENTER',
	},
	{
		accountCode: 'OX022',
		accountName: 'Printing & Stationery',
		type: 'EXPENSE',
		ifrsCategory: 'Administrative',
		centerType: 'COST_CENTER',
	},
	{
		accountCode: 'OX023',
		accountName: 'Postage & Courier',
		type: 'EXPENSE',
		ifrsCategory: 'Administrative',
		centerType: 'COST_CENTER',
	},
	{
		accountCode: 'OX024',
		accountName: 'Legal Fees',
		type: 'EXPENSE',
		ifrsCategory: 'Professional Services',
		centerType: 'COST_CENTER',
	},
	{
		accountCode: 'OX025',
		accountName: 'Audit Fees',
		type: 'EXPENSE',
		ifrsCategory: 'Professional Services',
		centerType: 'COST_CENTER',
	},
	{
		accountCode: 'OX026',
		accountName: 'Consultancy Fees',
		type: 'EXPENSE',
		ifrsCategory: 'Professional Services',
		centerType: 'COST_CENTER',
	},
	{
		accountCode: 'OX027',
		accountName: 'Bank Charges',
		type: 'EXPENSE',
		ifrsCategory: 'Financial',
		centerType: 'COST_CENTER',
	},
	{
		accountCode: 'OX028',
		accountName: 'Currency Exchange Loss',
		type: 'EXPENSE',
		ifrsCategory: 'Financial',
		centerType: 'COST_CENTER',
	},
	{
		accountCode: 'OX029',
		accountName: 'Marketing & Communications',
		type: 'EXPENSE',
		ifrsCategory: 'Marketing',
		centerType: 'COST_CENTER',
	},
	{
		accountCode: 'OX030',
		accountName: 'Events & Activities',
		type: 'EXPENSE',
		ifrsCategory: 'Marketing',
		centerType: 'COST_CENTER',
	},
	{
		accountCode: 'OX031',
		accountName: 'Travel — Staff',
		type: 'EXPENSE',
		ifrsCategory: 'Travel',
		centerType: 'COST_CENTER',
	},
	{
		accountCode: 'OX032',
		accountName: 'Travel — Management',
		type: 'EXPENSE',
		ifrsCategory: 'Travel',
		centerType: 'COST_CENTER',
	},
	{
		accountCode: 'OX033',
		accountName: 'Vehicle Fuel',
		type: 'EXPENSE',
		ifrsCategory: 'Transport',
		centerType: 'COST_CENTER',
	},
	{
		accountCode: 'OX034',
		accountName: 'Vehicle Maintenance',
		type: 'EXPENSE',
		ifrsCategory: 'Transport',
		centerType: 'COST_CENTER',
	},
	{
		accountCode: 'OX035',
		accountName: 'School Bus Costs',
		type: 'EXPENSE',
		ifrsCategory: 'Transport',
		centerType: 'COST_CENTER',
	},
	{
		accountCode: 'OX036',
		accountName: 'AEFE Fees',
		type: 'EXPENSE',
		ifrsCategory: 'Regulatory',
		centerType: 'COST_CENTER',
	},
	{
		accountCode: 'OX037',
		accountName: 'Government Licenses',
		type: 'EXPENSE',
		ifrsCategory: 'Regulatory',
		centerType: 'COST_CENTER',
	},
	{
		accountCode: 'OX038',
		accountName: 'Accreditation Fees',
		type: 'EXPENSE',
		ifrsCategory: 'Regulatory',
		centerType: 'COST_CENTER',
	},
	{
		accountCode: 'OX039',
		accountName: 'Depreciation — Furniture',
		type: 'EXPENSE',
		ifrsCategory: 'Depreciation',
		centerType: 'COST_CENTER',
	},
	{
		accountCode: 'OX040',
		accountName: 'Depreciation — Equipment',
		type: 'EXPENSE',
		ifrsCategory: 'Depreciation',
		centerType: 'COST_CENTER',
	},
	{
		accountCode: 'OX041',
		accountName: 'Depreciation — Vehicles',
		type: 'EXPENSE',
		ifrsCategory: 'Depreciation',
		centerType: 'COST_CENTER',
	},
	{
		accountCode: 'OX042',
		accountName: 'Contingency Reserve',
		type: 'EXPENSE',
		ifrsCategory: 'Contingency',
		centerType: 'COST_CENTER',
	},
	{
		accountCode: 'OX043',
		accountName: 'Miscellaneous OPEX',
		type: 'EXPENSE',
		ifrsCategory: 'Miscellaneous',
		centerType: 'COST_CENTER',
	},
];

const ALL_ACCOUNTS = [...REVENUE_ACCOUNTS, ...STAFF_COST_ACCOUNTS, ...OPEX_ACCOUNTS];

// ── Main export ─────────────────────────────────────────────────────────────

export async function seedMasterData(prisma: PrismaClient, userId: number): Promise<MigrationLog> {
	const logger = new MigrationLogger('master-data');

	try {
		// 1. Nationalities
		for (const nat of NATIONALITIES) {
			await prisma.nationality.upsert({
				where: { code: nat.code },
				update: {
					label: nat.label,
					vatExempt: nat.vatExempt,
					updatedBy: userId,
				},
				create: {
					code: nat.code,
					label: nat.label,
					vatExempt: nat.vatExempt,
					createdBy: userId,
					updatedBy: userId,
				},
			});
		}
		logger.addRowCount('nationalities', NATIONALITIES.length);

		// 2. Tariffs
		for (const tariff of TARIFFS) {
			await prisma.tariff.upsert({
				where: { code: tariff.code },
				update: {
					label: tariff.label,
					updatedBy: userId,
				},
				create: {
					code: tariff.code,
					label: tariff.label,
					createdBy: userId,
					updatedBy: userId,
				},
			});
		}
		logger.addRowCount('tariffs', TARIFFS.length);

		// 3. Departments
		for (const dept of DEPARTMENTS) {
			await prisma.department.upsert({
				where: { code: dept.code },
				update: {
					label: dept.label,
					bandMapping: dept.bandMapping,
					updatedBy: userId,
				},
				create: {
					code: dept.code,
					label: dept.label,
					bandMapping: dept.bandMapping,
					createdBy: userId,
					updatedBy: userId,
				},
			});
		}
		logger.addRowCount('departments', DEPARTMENTS.length);

		// 4. Academic Years
		const academicYears = buildAcademicYears();
		for (const ay of academicYears) {
			await prisma.academicYear.upsert({
				where: { fiscalYear: ay.fiscalYear },
				update: {
					ay1Start: ay.ay1Start,
					ay1End: ay.ay1End,
					summerStart: ay.summerStart,
					summerEnd: ay.summerEnd,
					ay2Start: ay.ay2Start,
					ay2End: ay.ay2End,
					academicWeeks: ay.academicWeeks,
					updatedBy: userId,
				},
				create: {
					fiscalYear: ay.fiscalYear,
					ay1Start: ay.ay1Start,
					ay1End: ay.ay1End,
					summerStart: ay.summerStart,
					summerEnd: ay.summerEnd,
					ay2Start: ay.ay2Start,
					ay2End: ay.ay2End,
					academicWeeks: ay.academicWeeks,
					createdBy: userId,
					updatedBy: userId,
				},
			});
		}
		logger.addRowCount('academic_years', academicYears.length);

		// 5. Chart of Accounts
		for (const acct of ALL_ACCOUNTS) {
			await prisma.chartOfAccount.upsert({
				where: { accountCode: acct.accountCode },
				update: {
					accountName: acct.accountName,
					type: acct.type,
					ifrsCategory: acct.ifrsCategory,
					centerType: acct.centerType,
					updatedBy: userId,
				},
				create: {
					accountCode: acct.accountCode,
					accountName: acct.accountName,
					type: acct.type,
					ifrsCategory: acct.ifrsCategory,
					centerType: acct.centerType,
					createdBy: userId,
					updatedBy: userId,
				},
			});
		}
		logger.addRowCount('chart_of_accounts', ALL_ACCOUNTS.length);

		return logger.complete('SUCCESS');
	} catch (err) {
		logger.error({
			code: 'MASTER_DATA_FAILED',
			message: err instanceof Error ? err.message : String(err),
			fatal: true,
		});
		return logger.complete('FAILED');
	}
}

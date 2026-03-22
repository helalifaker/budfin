export interface MigrationLog {
	module: string;
	startedAt: string;
	completedAt?: string;
	durationMs?: number;
	rowCounts: Record<string, number>;
	warnings: MigrationWarning[];
	errors: MigrationError[];
	status: 'SUCCESS' | 'FAILED' | 'RUNNING';
}

export interface MigrationWarning {
	code: string;
	message: string;
	row?: number;
	field?: string;
	value?: string;
}

export interface MigrationError {
	code: string;
	message: string;
	row?: number;
	field?: string;
	fatal: boolean;
}

export interface FeeGridFixture {
	academicPeriod: 'AY1' | 'AY2';
	gradeLevel: string;
	nationality: string;
	tariff: string;
	tuitionTtc: string;
	tuitionHt: string;
	dai: string;
	term1Amount: string;
	term2Amount: string;
	term3Amount: string;
}

export interface EnrollmentDetailFixture {
	academicPeriod: 'AY1' | 'AY2';
	gradeLevel: string;
	nationality: string;
	tariff: string;
	headcount: number;
}

export interface OtherRevenueFixture {
	lineItemName: string;
	annualAmount: string;
	distributionMethod: string;
	weightArray: number[] | null;
	specificMonths: number[] | null;
	ifrsCategory: string;
	computeMethod: string | null;
}

export interface StaffCostsFixture {
	employeeCode: string;
	name: string;
	functionRole: string;
	department: string;
	costMode: string;
	subject: string;
	homeBand: string | null;
	level: string;
	status: string;
	joiningDate: string;
	paymentMethod: string;
	isSaudi: boolean;
	isAjeer: boolean;
	isTeaching: boolean;
	hourlyPercentage: string;
	baseSalary: string;
	housingAllowance: string;
	transportAllowance: string;
	responsibilityPremium: string;
	hsaAmount: string;
	augmentation: string;
	augmentationEffectiveDate: string | null;
	ajeerAnnualLevy: string;
	ajeerMonthlyFee: string;
}

export interface GradeCodeMapping {
	excelCode: string;
	appCode: string;
	gradeName: string;
	band: string;
	feeBand: string;
}

export interface ExpectedRevenueFixture {
	month: number;
	totalOperatingRevenue: string;
}

export interface DhgMaternelleEntry {
	subject: string;
	hoursPerWeek: Record<string, number>;
}

export interface DhgCollegeEntry {
	level: string;
	discipline: string;
	hoursPerWeekPerStudent: number;
	totalHoursPerWeek: number;
	sections: number;
}

export interface DhgLyceeEntry {
	level: string;
	discipline: string;
	hoursPerWeekPerStudent: number;
	totalHoursPerWeek: number;
	sections: number;
}

export interface DhgStructureFixture {
	maternelleHours: DhgMaternelleEntry[];
	elementaireHours: DhgMaternelleEntry[];
	collegeDHG: DhgCollegeEntry[];
	lyceeDHG: {
		seconde: DhgLyceeEntry[];
		premiere: DhgLyceeEntry[];
		terminale: DhgLyceeEntry[];
	};
}

export interface ValidationResult {
	step: number;
	name: string;
	status: 'PASS' | 'FAIL' | 'SKIPPED';
	details: string;
	expected?: string | number;
	actual?: string | number;
}

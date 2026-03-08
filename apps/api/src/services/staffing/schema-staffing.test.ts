import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';

describe('Staffing Prisma schema models', () => {
	describe('Employee model', () => {
		it('has all required fields in the type definition', () => {
			const employee: Prisma.EmployeeUncheckedCreateInput = {
				versionId: 1,
				employeeCode: 'EMP001',
				name: 'Test Employee',
				functionRole: 'Teacher',
				department: 'Primaire',
				joiningDate: new Date('2020-01-01'),
				paymentMethod: 'Bank Transfer',
				baseSalary: new Uint8Array([1, 2, 3]),
				housingAllowance: new Uint8Array([1, 2, 3]),
				transportAllowance: new Uint8Array([1, 2, 3]),
				createdBy: 1,
			};
			expect(employee.employeeCode).toBe('EMP001');
			expect(employee.versionId).toBe(1);
		});

		it('has optional fields with correct defaults', () => {
			const employee: Prisma.EmployeeUncheckedCreateInput = {
				versionId: 1,
				employeeCode: 'EMP002',
				name: 'Test',
				functionRole: 'Admin',
				department: 'Admin',
				joiningDate: new Date('2020-01-01'),
				paymentMethod: 'Cash',
				baseSalary: new Uint8Array([1]),
				housingAllowance: new Uint8Array([1]),
				transportAllowance: new Uint8Array([1]),
				createdBy: 1,
			};
			// Optional fields should not be required
			expect(employee.isSaudi).toBeUndefined();
			expect(employee.isAjeer).toBeUndefined();
			expect(employee.isTeaching).toBeUndefined();
			expect(employee.updatedBy).toBeUndefined();
			expect(employee.augmentationEffectiveDate).toBeUndefined();
		});

		it('salary fields use Uint8Array (Prisma 6 Bytes)', () => {
			const salaryData = new Uint8Array([1, 2, 3, 4]);
			const employee: Prisma.EmployeeUncheckedCreateInput = {
				versionId: 1,
				employeeCode: 'EMP003',
				name: 'Test',
				functionRole: 'Teacher',
				department: 'Primaire',
				joiningDate: new Date('2020-01-01'),
				paymentMethod: 'Bank Transfer',
				baseSalary: salaryData,
				housingAllowance: salaryData,
				transportAllowance: salaryData,
				createdBy: 1,
			};
			expect(employee.baseSalary).toBeInstanceOf(Uint8Array);
		});
	});

	describe('DhgGrilleConfig model', () => {
		it('has all required fields', () => {
			const config: Prisma.DhgGrilleConfigUncheckedCreateInput = {
				gradeLevel: 'CP',
				subject: 'Français',
				hoursPerWeekPerSection: 8.0,
				effectiveFromYear: 2026,
			};
			expect(config.gradeLevel).toBe('CP');
			expect(config.effectiveFromYear).toBe(2026);
		});

		it('has optional dhgType defaulting to Structural', () => {
			const config: Prisma.DhgGrilleConfigUncheckedCreateInput = {
				gradeLevel: 'CP',
				subject: 'Français',
				hoursPerWeekPerSection: 8.0,
				effectiveFromYear: 2026,
			};
			expect(config.dhgType).toBeUndefined(); // defaults to 'Structural' in DB
		});
	});

	describe('MonthlyStaffCost model', () => {
		it('has all required monetary fields as Decimal', () => {
			const cost: Prisma.MonthlyStaffCostUncheckedCreateInput = {
				versionId: 1,
				employeeId: 1,
				month: 1,
				baseGross: '15000.0000',
				adjustedGross: '15000.0000',
				totalCost: '17000.0000',
			};
			expect(cost.month).toBe(1);
			expect(cost.baseGross).toBe('15000.0000');
		});

		it('optional fields default to 0', () => {
			const cost: Prisma.MonthlyStaffCostUncheckedCreateInput = {
				versionId: 1,
				employeeId: 1,
				month: 6,
				baseGross: '10000.0000',
				adjustedGross: '10000.0000',
				totalCost: '12000.0000',
			};
			// These should not be required (DB defaults to 0)
			expect(cost.gosiAmount).toBeUndefined();
			expect(cost.ajeerAmount).toBeUndefined();
			expect(cost.eosMonthlyAccrual).toBeUndefined();
		});
	});

	describe('EosProvision model', () => {
		it('has all required fields', () => {
			const provision: Prisma.EosProvisionUncheckedCreateInput = {
				versionId: 1,
				employeeId: 1,
				yearsOfService: '5.5000',
				eosBase: '20000.0000',
				eosAnnual: '55000.0000',
				eosMonthlyAccrual: '4583.3333',
				asOfDate: new Date('2026-01-01'),
			};
			expect(provision.yearsOfService).toBe('5.5000');
			expect(provision.eosBase).toBe('20000.0000');
		});
	});

	describe('DhgRequirement FTE fields', () => {
		it('accepts FTE fields in create input', () => {
			const req: Prisma.DhgRequirementUncheckedCreateInput = {
				versionId: 1,
				academicPeriod: 'AY1',
				gradeLevel: 'CP',
				maxClassSize: 28,
				totalWeeklyHours: '24.0000',
				totalAnnualHours: '864.0000',
				fte: '1.3333',
			};
			expect(req.totalWeeklyHours).toBe('24.0000');
			expect(req.totalAnnualHours).toBe('864.0000');
			expect(req.fte).toBe('1.3333');
		});
	});
});

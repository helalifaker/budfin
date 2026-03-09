import type { PrismaClient } from '@prisma/client';
import { Decimal } from 'decimal.js';
import type { MigrationLog, StaffCostsFixture } from '../lib/types.js';
import { MigrationLogger } from '../lib/logger.js';
import { loadFixture } from '../lib/fixture-loader.js';
import { getEncryptionKey } from '../../services/staffing/crypto-helper.js';

// ── Main export ─────────────────────────────────────────────────────────────

export async function importEmployees(
	prisma: PrismaClient,
	versionId: number,
	userId: number
): Promise<MigrationLog> {
	const logger = new MigrationLogger('employees');

	try {
		const rawEmployees = loadFixture<StaffCostsFixture[]>('fy2026-staff-costs.json');
		const key = getEncryptionKey();

		// Deduplicate by employeeCode: last occurrence wins
		const employeeMap = new Map<string, StaffCostsFixture>();
		let rowIdx = 0;
		for (const emp of rawEmployees) {
			rowIdx++;
			if (employeeMap.has(emp.employeeCode)) {
				logger.warn({
					code: 'DUPLICATE_EMPLOYEE_CODE',
					message: `Duplicate employeeCode "${emp.employeeCode}" at row ${rowIdx} — last occurrence wins`,
					row: rowIdx,
					field: 'employeeCode',
					value: emp.employeeCode,
				});
			}
			employeeMap.set(emp.employeeCode, emp);
		}

		const employees = Array.from(employeeMap.values());
		let count = 0;

		for (const emp of employees) {
			const joiningDate = emp.joiningDate ? new Date(emp.joiningDate) : new Date();
			const augEffDate = emp.augmentationEffectiveDate
				? new Date(emp.augmentationEffectiveDate)
				: null;

			// Use raw SQL with pgp_sym_encrypt for salary fields + ON CONFLICT for idempotency
			// Pattern from apps/api/src/routes/staffing/import.ts lines 472-519
			await prisma.$executeRawUnsafe(
				`INSERT INTO employees (
					version_id, employee_code, name, function_role, department,
					status, joining_date, payment_method,
					is_saudi, is_ajeer, is_teaching, hourly_percentage,
					base_salary, housing_allowance, transport_allowance,
					responsibility_premium, hsa_amount, augmentation,
					augmentation_effective_date,
					ajeer_annual_levy, ajeer_monthly_fee,
					created_by, created_at, updated_at
				) VALUES (
					$1, $2, $3, $4, $5,
					$6, $7, $8,
					$9, $10, $11, $12,
					pgp_sym_encrypt($13, $14),
					pgp_sym_encrypt($15, $14),
					pgp_sym_encrypt($16, $14),
					pgp_sym_encrypt($17, $14),
					pgp_sym_encrypt($18, $14),
					pgp_sym_encrypt($19, $14),
					$20,
					$21, $22,
					$23, NOW(), NOW()
				)
				ON CONFLICT (version_id, employee_code)
				DO UPDATE SET
					name = EXCLUDED.name,
					function_role = EXCLUDED.function_role,
					department = EXCLUDED.department,
					status = EXCLUDED.status,
					joining_date = EXCLUDED.joining_date,
					payment_method = EXCLUDED.payment_method,
					is_saudi = EXCLUDED.is_saudi,
					is_ajeer = EXCLUDED.is_ajeer,
					is_teaching = EXCLUDED.is_teaching,
					hourly_percentage = EXCLUDED.hourly_percentage,
					base_salary = EXCLUDED.base_salary,
					housing_allowance = EXCLUDED.housing_allowance,
					transport_allowance = EXCLUDED.transport_allowance,
					responsibility_premium = EXCLUDED.responsibility_premium,
					hsa_amount = EXCLUDED.hsa_amount,
					augmentation = EXCLUDED.augmentation,
					augmentation_effective_date = EXCLUDED.augmentation_effective_date,
					ajeer_annual_levy = EXCLUDED.ajeer_annual_levy,
					ajeer_monthly_fee = EXCLUDED.ajeer_monthly_fee,
					updated_by = EXCLUDED.created_by,
					updated_at = NOW()`,
				versionId,
				emp.employeeCode,
				emp.name,
				emp.functionRole,
				emp.department,
				emp.status,
				joiningDate,
				emp.paymentMethod,
				emp.isSaudi,
				emp.isAjeer,
				emp.isTeaching,
				new Decimal(emp.hourlyPercentage).toFixed(4),
				emp.baseSalary,
				key,
				emp.housingAllowance,
				emp.transportAllowance,
				emp.responsibilityPremium,
				emp.hsaAmount,
				emp.augmentation,
				augEffDate,
				new Decimal(emp.ajeerAnnualLevy).toFixed(4),
				new Decimal(emp.ajeerMonthlyFee).toFixed(4),
				userId
			);
			count++;
		}

		logger.addRowCount('employees', count);
		return logger.complete('SUCCESS');
	} catch (err) {
		logger.error({
			code: 'EMPLOYEES_IMPORT_FAILED',
			message: err instanceof Error ? err.message : String(err),
			fatal: true,
		});
		return logger.complete('FAILED');
	}
}

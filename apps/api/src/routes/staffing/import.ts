import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Decimal } from 'decimal.js';
import { Prisma } from '@prisma/client';
import multipart from '@fastify/multipart';
import ExcelJS from 'exceljs';
import { prisma } from '../../lib/prisma.js';
import { getEncryptionKey } from '../../services/staffing/crypto-helper.js';

const versionIdParams = z.object({
	versionId: z.coerce.number().int().positive(),
});

// ── Column Mapping ──────────────────────────────────────────────────────────

const REQUIRED_COLUMNS = [
	'employee_code',
	'name',
	'function_role',
	'department',
	'joining_date',
	'base_salary',
	'housing_allowance',
	'transport_allowance',
] as const;

const OPTIONAL_COLUMNS = [
	'status',
	'payment_method',
	'is_saudi',
	'is_ajeer',
	'is_teaching',
	'hourly_percentage',
	'responsibility_premium',
	'hsa_amount',
	'augmentation',
	'augmentation_effective_date',
	'ajeer_annual_levy',
	'ajeer_monthly_fee',
] as const;

const ALL_COLUMNS = [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS];

// ── Helpers ─────────────────────────────────────────────────────────────────

function cellStr(cell: ExcelJS.Cell): string {
	if (cell.value === null || cell.value === undefined) return '';
	if (typeof cell.value === 'object' && 'result' in cell.value) {
		return String(cell.value.result ?? '');
	}
	return String(cell.value).trim();
}

function normalizeHeader(header: string): string {
	return header
		.trim()
		.toLowerCase()
		.replace(/[\s-]+/g, '_');
}

function parseBoolCell(val: string): boolean {
	const lower = val.toLowerCase();
	return lower === 'true' || lower === 'yes' || lower === '1' || lower === 'y';
}

function parseDateCell(cell: ExcelJS.Cell): Date | null {
	const raw = cell.value;
	if (raw instanceof Date) return raw;
	if (typeof raw === 'object' && raw !== null && 'result' in raw) {
		const r = (raw as { result: unknown }).result;
		if (r instanceof Date) return r;
	}
	const str = cellStr(cell);
	if (!str) return null;
	const d = new Date(str);
	return isNaN(d.getTime()) ? null : d;
}

interface RowError {
	row: number;
	field: string;
	message: string;
}

interface ParsedEmployee {
	employeeCode: string;
	name: string;
	functionRole: string;
	department: string;
	status: string;
	joiningDate: Date;
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
	augmentationEffectiveDate: Date | null;
	ajeerAnnualLevy: string;
	ajeerMonthlyFee: string;
}

const VALID_STATUSES = new Set(['Existing', 'New', 'Departed']);
const VALID_DEPARTMENTS = new Set([
	'Teaching',
	'Administration',
	'Support',
	'Management',
	'Maintenance',
]);

function validateRow(
	colMap: Map<string, number>,
	row: ExcelJS.Row,
	rowNum: number
): { employee: ParsedEmployee | null; errors: RowError[] } {
	const errors: RowError[] = [];

	function getCell(col: string): ExcelJS.Cell {
		const idx = colMap.get(col);
		if (idx === undefined) return row.getCell(1); // fallback, won't be used if required check passed
		return row.getCell(idx);
	}

	function getStr(col: string): string {
		return cellStr(getCell(col));
	}

	// Required fields
	const employeeCode = getStr('employee_code');
	if (!employeeCode) {
		errors.push({ row: rowNum, field: 'employee_code', message: 'Required' });
	}

	const name = getStr('name');
	if (!name) {
		errors.push({ row: rowNum, field: 'name', message: 'Required' });
	}

	const functionRole = getStr('function_role');
	if (!functionRole) {
		errors.push({ row: rowNum, field: 'function_role', message: 'Required' });
	}

	const department = getStr('department');
	if (!department) {
		errors.push({ row: rowNum, field: 'department', message: 'Required' });
	} else if (!VALID_DEPARTMENTS.has(department)) {
		errors.push({
			row: rowNum,
			field: 'department',
			message: `Invalid department: "${department}". Expected: ${[...VALID_DEPARTMENTS].join(', ')}`,
		});
	}

	const joiningDate = parseDateCell(getCell('joining_date'));
	if (!joiningDate) {
		errors.push({
			row: rowNum,
			field: 'joining_date',
			message: 'Required, must be a valid date',
		});
	}

	// Salary fields (required)
	const baseSalaryStr = getStr('base_salary');
	if (!baseSalaryStr || isNaN(Number(baseSalaryStr))) {
		errors.push({
			row: rowNum,
			field: 'base_salary',
			message: 'Required, must be a number',
		});
	}

	const housingStr = getStr('housing_allowance');
	if (!housingStr || isNaN(Number(housingStr))) {
		errors.push({
			row: rowNum,
			field: 'housing_allowance',
			message: 'Required, must be a number',
		});
	}

	const transportStr = getStr('transport_allowance');
	if (!transportStr || isNaN(Number(transportStr))) {
		errors.push({
			row: rowNum,
			field: 'transport_allowance',
			message: 'Required, must be a number',
		});
	}

	if (errors.length > 0) {
		return { employee: null, errors };
	}

	// Optional fields
	const statusRaw = getStr('status') || 'Existing';
	const status = VALID_STATUSES.has(statusRaw) ? statusRaw : 'Existing';
	if (colMap.has('status') && getStr('status') && !VALID_STATUSES.has(getStr('status'))) {
		errors.push({
			row: rowNum,
			field: 'status',
			message: `Invalid status: "${getStr('status')}". Expected: Existing, New, Departed`,
		});
	}

	const paymentMethod = getStr('payment_method') || 'Bank Transfer';
	const isSaudi = colMap.has('is_saudi') ? parseBoolCell(getStr('is_saudi')) : false;
	const isAjeer = colMap.has('is_ajeer') ? parseBoolCell(getStr('is_ajeer')) : false;
	const isTeaching = colMap.has('is_teaching') ? parseBoolCell(getStr('is_teaching')) : false;

	const hourlyPctStr = getStr('hourly_percentage');
	const hourlyPercentage = hourlyPctStr && !isNaN(Number(hourlyPctStr)) ? hourlyPctStr : '1.0000';

	const responsibilityStr = getStr('responsibility_premium');
	const responsibilityPremium =
		responsibilityStr && !isNaN(Number(responsibilityStr)) ? responsibilityStr : '0';

	const hsaStr = getStr('hsa_amount');
	const hsaAmount = hsaStr && !isNaN(Number(hsaStr)) ? hsaStr : '0';

	const augStr = getStr('augmentation');
	const augmentation = augStr && !isNaN(Number(augStr)) ? augStr : '0';

	const augDateRaw = colMap.has('augmentation_effective_date')
		? parseDateCell(getCell('augmentation_effective_date'))
		: null;

	const ajeerLevyStr = getStr('ajeer_annual_levy');
	const ajeerAnnualLevy = ajeerLevyStr && !isNaN(Number(ajeerLevyStr)) ? ajeerLevyStr : '0';

	const ajeerFeeStr = getStr('ajeer_monthly_fee');
	const ajeerMonthlyFee = ajeerFeeStr && !isNaN(Number(ajeerFeeStr)) ? ajeerFeeStr : '0';

	if (errors.length > 0) {
		return { employee: null, errors };
	}

	return {
		employee: {
			employeeCode,
			name,
			functionRole,
			department,
			status,
			joiningDate: joiningDate!,
			paymentMethod,
			isSaudi,
			isAjeer,
			isTeaching,
			hourlyPercentage,
			baseSalary: baseSalaryStr,
			housingAllowance: housingStr,
			transportAllowance: transportStr,
			responsibilityPremium,
			hsaAmount,
			augmentation,
			augmentationEffectiveDate: augDateRaw,
			ajeerAnnualLevy,
			ajeerMonthlyFee,
		},
		errors,
	};
}

// ── Duplicate Detection ─────────────────────────────────────────────────────

interface DuplicateWarning {
	row: number;
	employeeCode: string;
	matchedFields: string[];
}

function detectDuplicates(employees: ParsedEmployee[]): DuplicateWarning[] {
	const warnings: DuplicateWarning[] = [];

	for (let i = 0; i < employees.length; i++) {
		for (let j = i + 1; j < employees.length; j++) {
			const a = employees[i]!;
			const b = employees[j]!;
			const matched: string[] = [];

			if (a.name === b.name) matched.push('name');
			if (a.department === b.department) matched.push('department');
			if (a.joiningDate.getTime() === b.joiningDate.getTime()) matched.push('joining_date');

			if (matched.length >= 2) {
				warnings.push({
					row: j + 2, // 1-based, header is row 1
					employeeCode: b.employeeCode,
					matchedFields: matched,
				});
			}
		}
	}

	return warnings;
}

// ── Route ───────────────────────────────────────────────────────────────────

export async function employeeImportRoutes(app: FastifyInstance) {
	await app.register(multipart, { limits: { fileSize: 5_242_880 } }); // 5 MB

	app.post('/employees/import', {
		schema: { params: versionIdParams },
		preHandler: [app.authenticate, app.requireRole('Admin', 'BudgetOwner', 'Editor')],
		handler: async (request, reply) => {
			const { versionId } = request.params as z.infer<typeof versionIdParams>;

			// Version guard
			const version = await prisma.budgetVersion.findUnique({
				where: { id: versionId },
			});
			if (!version) {
				return reply.status(404).send({
					code: 'VERSION_NOT_FOUND',
					message: `Version ${versionId} not found`,
				});
			}
			if (version.status !== 'Draft') {
				return reply.status(409).send({
					code: 'VERSION_LOCKED',
					message: 'Cannot import into a locked or archived version',
				});
			}

			// Read multipart
			const fileData = await request.file();
			if (!fileData) {
				return reply.status(400).send({
					code: 'FILE_REQUIRED',
					message: 'An xlsx file is required',
				});
			}

			// Extract mode field
			const fields = fileData.fields as Record<string, { value: string } | undefined>;
			const mode = fields['mode']?.value;
			if (!mode || !['validate', 'commit'].includes(mode)) {
				return reply.status(400).send({
					code: 'INVALID_MODE',
					message: 'mode must be "validate" or "commit"',
				});
			}

			// Parse xlsx
			const buffer = await fileData.toBuffer();
			const workbook = new ExcelJS.Workbook();
			await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

			const sheet = workbook.worksheets[0];
			if (!sheet || sheet.rowCount < 2) {
				return reply.status(400).send({
					code: 'EMPTY_FILE',
					message: 'Workbook has no data rows',
				});
			}

			// Build column map from header row
			const headerRow = sheet.getRow(1);
			const colMap = new Map<string, number>();
			for (let c = 1; c <= sheet.columnCount; c++) {
				const header = normalizeHeader(cellStr(headerRow.getCell(c)));
				if (header && ALL_COLUMNS.includes(header as (typeof ALL_COLUMNS)[number])) {
					colMap.set(header, c);
				}
			}

			// Check required columns
			const missingCols = REQUIRED_COLUMNS.filter((c) => !colMap.has(c));
			if (missingCols.length > 0) {
				return reply.status(400).send({
					code: 'MISSING_COLUMNS',
					message: `Missing required columns: ${missingCols.join(', ')}`,
					missingColumns: missingCols,
				});
			}

			// Parse rows
			const allErrors: RowError[] = [];
			const validEmployees: ParsedEmployee[] = [];

			for (let r = 2; r <= sheet.rowCount; r++) {
				const row = sheet.getRow(r);
				// Skip entirely empty rows
				const firstCell = cellStr(row.getCell(colMap.get('employee_code')!));
				if (!firstCell && !cellStr(row.getCell(colMap.get('name')!))) continue;

				const { employee, errors } = validateRow(colMap, row, r);
				allErrors.push(...errors);
				if (employee) {
					validEmployees.push(employee);
				}
			}

			// Check for duplicate employee_codes within the file
			const codeSet = new Set<string>();
			for (const emp of validEmployees) {
				if (codeSet.has(emp.employeeCode)) {
					allErrors.push({
						row: 0,
						field: 'employee_code',
						message: `Duplicate employee_code in file: "${emp.employeeCode}"`,
					});
				}
				codeSet.add(emp.employeeCode);
			}

			// Check for duplicates against existing employees in DB
			const existingCodes = await prisma.employee.findMany({
				where: { versionId },
				select: { employeeCode: true },
			});
			const existingCodeSet = new Set(existingCodes.map((e) => e.employeeCode));
			const conflictingCodes = validEmployees
				.filter((e) => existingCodeSet.has(e.employeeCode))
				.map((e) => e.employeeCode);

			// Detect potential duplicates (fuzzy: 2+ of name/department/joining_date match)
			const duplicateWarnings = detectDuplicates(validEmployees);

			// Validate mode — return preview
			if (mode === 'validate') {
				return {
					totalRows: sheet.rowCount - 1,
					validRows: validEmployees.length,
					errors: allErrors,
					conflictingCodes,
					duplicateWarnings,
					preview: validEmployees.map((e) => ({
						employee_code: e.employeeCode,
						name: e.name,
						department: e.department,
						status: e.status,
						base_salary: e.baseSalary,
					})),
				};
			}

			// Commit mode — persist
			if (allErrors.length > 0) {
				return reply.status(422).send({
					code: 'VALIDATION_ERRORS',
					message: `${allErrors.length} validation error(s) must be fixed before committing`,
					errors: allErrors,
				});
			}

			if (conflictingCodes.length > 0) {
				return reply.status(409).send({
					code: 'DUPLICATE_EMPLOYEE_CODES',
					message: `${conflictingCodes.length} employee code(s) already exist in this version`,
					conflictingCodes,
				});
			}

			const key = getEncryptionKey();

			const result = await prisma.$transaction(async (tx) => {
				const txPrisma = tx as typeof prisma;
				let inserted = 0;

				for (const emp of validEmployees) {
					// Use raw SQL for pgcrypto encryption of salary fields
					await txPrisma.$executeRawUnsafe(
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
						)`,
						versionId,
						emp.employeeCode,
						emp.name,
						emp.functionRole,
						emp.department,
						emp.status,
						emp.joiningDate,
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
						emp.augmentationEffectiveDate,
						new Decimal(emp.ajeerAnnualLevy).toFixed(4),
						new Decimal(emp.ajeerMonthlyFee).toFixed(4),
						request.user.id
					);
					inserted++;
				}

				// Mark staffing as stale
				await txPrisma.$executeRaw`
					UPDATE budget_versions
					SET stale_modules = CASE
						WHEN NOT ('STAFFING' = ANY(stale_modules))
						THEN array_append(stale_modules, 'STAFFING')
						ELSE stale_modules
					END,
					updated_at = NOW()
					WHERE id = ${versionId}
				`;

				// Audit log
				await txPrisma.auditEntry.create({
					data: {
						userId: request.user.id,
						userEmail: request.user.email,
						operation: 'EMPLOYEE_BULK_IMPORT',
						tableName: 'employees',
						recordId: versionId,
						ipAddress: request.ip,
						newValues: {
							employeesImported: inserted,
							duplicateWarnings: duplicateWarnings.length,
						} as unknown as Prisma.InputJsonValue,
					},
				});

				return { inserted };
			});

			return reply.status(201).send({
				imported: result.inserted,
				duplicateWarnings,
			});
		},
	});
}

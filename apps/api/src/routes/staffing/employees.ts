import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { getEncryptionKey } from '../../services/staffing/crypto-helper.js';

// ── Constants ──────────────────────────────────────────────────────────────

const VALID_RECORD_TYPES = ['EMPLOYEE', 'VACANCY'] as const;
const VALID_COST_MODES = ['LOCAL_PAYROLL', 'AEFE_RECHARGE', 'NO_LOCAL_COST'] as const;
const VALID_BANDS = ['MATERNELLE', 'ELEMENTAIRE', 'COLLEGE', 'LYCEE'] as const;

// ── Schemas ──────────────────────────────────────────────────────────────────

const versionIdParams = z.object({
	versionId: z.coerce.number().int().positive(),
});

const employeeIdParams = z.object({
	versionId: z.coerce.number().int().positive(),
	id: z.coerce.number().int().positive(),
});

const employeeListQuery = z.object({
	department: z.string().optional(),
	status: z.enum(['Existing', 'New', 'Departed']).optional(),
	recordType: z.enum(VALID_RECORD_TYPES).optional(),
	page: z.coerce.number().int().positive().default(1),
	page_size: z.coerce.number().int().positive().max(100).default(50),
});

/**
 * Base employee body schema.
 * - hsaAmount is deliberately omitted (computed by pipeline only, AC-03).
 * - When isTeaching is true, disciplineId/serviceProfileId/homeBand are
 *   validated as required in the handler (superRefine cannot express this
 *   cleanly with default values).
 */
const employeeBody = z.object({
	employeeCode: z.string().min(1).max(20).optional(),
	name: z.string().min(1).max(200),
	functionRole: z.string().min(1).max(100),
	department: z.string().min(1).max(50),
	status: z.enum(['Existing', 'New', 'Departed']).default('Existing'),
	joiningDate: z.string().date(),
	paymentMethod: z.string().min(1).max(50),
	isSaudi: z.boolean().default(false),
	isAjeer: z.boolean().default(false),
	isTeaching: z.boolean().default(false),
	hourlyPercentage: z.string().default('1.0000'),
	baseSalary: z.string().nullable().default('0.0000'),
	housingAllowance: z.string().nullable().default('0.0000'),
	transportAllowance: z.string().nullable().default('0.0000'),
	responsibilityPremium: z.string().default('0.0000'),
	augmentation: z.string().default('0.0000'),
	augmentationEffectiveDate: z.string().date().nullable().optional(),
	ajeerAnnualLevy: z.string().default('0.0000'),
	ajeerMonthlyFee: z.string().default('0.0000'),
	// Epic 18 — new fields
	recordType: z.enum(VALID_RECORD_TYPES).default('EMPLOYEE'),
	costMode: z.enum(VALID_COST_MODES).default('LOCAL_PAYROLL'),
	disciplineId: z.number().int().positive().nullable().optional(),
	serviceProfileId: z.number().int().positive().nullable().optional(),
	homeBand: z.enum(VALID_BANDS).nullable().optional(),
	contractEndDate: z.string().date().nullable().optional(),
});

// ── Salary field encryption/decryption helpers ───────────────────────────────

interface DecryptedEmployee {
	id: number;
	version_id: number;
	employee_code: string;
	name: string;
	function_role: string;
	department: string;
	status: string;
	joining_date: Date;
	payment_method: string;
	is_saudi: boolean;
	is_ajeer: boolean;
	is_teaching: boolean;
	hourly_percentage: string;
	base_salary: string | null;
	housing_allowance: string | null;
	transport_allowance: string | null;
	responsibility_premium: string | null;
	hsa_amount: string | null;
	augmentation: string | null;
	augmentation_effective_date: Date | null;
	ajeer_annual_levy: string;
	ajeer_monthly_fee: string;
	// Epic 18 new fields
	record_type: string;
	cost_mode: string;
	discipline_id: number | null;
	service_profile_id: number | null;
	home_band: string | null;
	contract_end_date: Date | null;
	discipline_name: string | null;
	service_profile_name: string | null;
	created_at: Date;
	updated_at: Date;
	created_by: number;
	updated_by: number | null;
}

function formatEmployee(raw: DecryptedEmployee, redactSalary: boolean) {
	return {
		id: raw.id,
		employee_code: raw.employee_code,
		name: raw.name,
		function_role: raw.function_role,
		department: raw.department,
		status: raw.status,
		joining_date: raw.joining_date,
		payment_method: raw.payment_method,
		is_saudi: raw.is_saudi,
		is_ajeer: raw.is_ajeer,
		is_teaching: raw.is_teaching,
		hourly_percentage: raw.hourly_percentage,
		base_salary: redactSalary ? null : raw.base_salary,
		housing_allowance: redactSalary ? null : raw.housing_allowance,
		transport_allowance: redactSalary ? null : raw.transport_allowance,
		responsibility_premium: redactSalary ? null : raw.responsibility_premium,
		hsa_amount: redactSalary ? null : raw.hsa_amount,
		augmentation: redactSalary ? null : raw.augmentation,
		augmentation_effective_date: raw.augmentation_effective_date,
		ajeer_annual_levy: raw.ajeer_annual_levy,
		ajeer_monthly_fee: raw.ajeer_monthly_fee,
		// Epic 18 new fields (AC-01)
		record_type: raw.record_type,
		cost_mode: raw.cost_mode,
		discipline_id: raw.discipline_id,
		service_profile_id: raw.service_profile_id,
		home_band: raw.home_band,
		contract_end_date: raw.contract_end_date,
		discipline_name: raw.discipline_name,
		service_profile_name: raw.service_profile_name,
		updated_at: raw.updated_at,
	};
}

async function addStaleFlag(versionId: number): Promise<void> {
	await prisma.$executeRaw`
		UPDATE budget_versions
		SET stale_modules = CASE
			WHEN NOT ('STAFFING' = ANY(stale_modules)) THEN array_append(stale_modules, 'STAFFING')
			ELSE stale_modules
		END,
		updated_at = NOW()
		WHERE id = ${versionId}
	`;
}

function buildDecryptSelect(key: string): Prisma.Sql {
	return Prisma.sql`
		pgp_sym_decrypt(e.base_salary, ${key}) as base_salary,
		pgp_sym_decrypt(e.housing_allowance, ${key}) as housing_allowance,
		pgp_sym_decrypt(e.transport_allowance, ${key}) as transport_allowance,
		pgp_sym_decrypt(e.responsibility_premium, ${key}) as responsibility_premium,
		pgp_sym_decrypt(e.hsa_amount, ${key}) as hsa_amount,
		pgp_sym_decrypt(e.augmentation, ${key}) as augmentation
	`;
}

const REDACTED_SALARY_SELECT = Prisma.sql`
	NULL as base_salary,
	NULL as housing_allowance,
	NULL as transport_allowance,
	NULL as responsibility_premium,
	NULL as hsa_amount,
	NULL as augmentation
`;

function buildEmployeeSelect(salaryFragment: Prisma.Sql): Prisma.Sql {
	return Prisma.sql`
		e.id, e.version_id, e.employee_code, e.name,
		e.function_role, e.department, e.status, e.joining_date,
		e.payment_method, e.is_saudi, e.is_ajeer, e.is_teaching,
		e.hourly_percentage::text as hourly_percentage,
		${salaryFragment},
		e.augmentation_effective_date,
		e.ajeer_annual_levy::text as ajeer_annual_levy,
		e.ajeer_monthly_fee::text as ajeer_monthly_fee,
		e.record_type, e.cost_mode, e.discipline_id,
		e.service_profile_id, e.home_band, e.contract_end_date,
		d.name as discipline_name,
		sp.name as service_profile_name,
		e.created_at, e.updated_at, e.created_by, e.updated_by
	`;
}

/**
 * Validates isTeaching constraint: when isTeaching is true,
 * disciplineId, serviceProfileId, and homeBand must not be null (AC-02).
 * Returns array of field-specific error messages, empty if valid.
 */
function validateTeachingFields(body: z.infer<typeof employeeBody>): string[] {
	if (!body.isTeaching) return [];

	const errors: string[] = [];
	if (!body.disciplineId) {
		errors.push('disciplineId is required when isTeaching is true');
	}
	if (!body.serviceProfileId) {
		errors.push('serviceProfileId is required when isTeaching is true');
	}
	if (!body.homeBand) {
		errors.push('homeBand is required when isTeaching is true');
	}
	return errors;
}

/**
 * Generates the next vacancy code (VAC-NNN) for a given version (AC-04).
 * Finds the max existing VAC-NNN code and increments.
 */
async function generateVacancyCode(versionId: number): Promise<string> {
	const result = await prisma.$queryRaw<[{ max_num: number | null }]>`
		SELECT MAX(
			CAST(SUBSTRING(employee_code FROM 5) AS INTEGER)
		) as max_num
		FROM employees
		WHERE version_id = ${versionId}
		AND employee_code LIKE 'VAC-%'
	`;
	const nextNum = (result[0]?.max_num ?? 0) + 1;
	return `VAC-${String(nextNum).padStart(3, '0')}`;
}

// ── Routes ───────────────────────────────────────────────────────────────────

export async function employeeRoutes(app: FastifyInstance) {
	// GET /employees — list with pagination, filtering, salary redaction
	app.get('/employees', {
		schema: {
			params: versionIdParams,
			querystring: employeeListQuery,
		},
		preHandler: [app.authenticate],
		handler: async (request, reply) => {
			const { versionId } = request.params as z.infer<typeof versionIdParams>;
			const { department, status, recordType, page, page_size } = request.query as z.infer<
				typeof employeeListQuery
			>;

			const version = await prisma.budgetVersion.findUnique({
				where: { id: versionId },
			});
			if (!version) {
				return reply.status(404).send({
					code: 'VERSION_NOT_FOUND',
					message: `Version ${versionId} not found`,
				});
			}

			const redactSalary = request.user.role === 'Viewer';
			const key = redactSalary ? '' : getEncryptionKey();
			const offset = (page - 1) * page_size;

			const salaryFragment = redactSalary ? REDACTED_SALARY_SELECT : buildDecryptSelect(key);
			const selectCols = buildEmployeeSelect(salaryFragment);

			// Build WHERE conditions dynamically
			const conditions: Prisma.Sql[] = [Prisma.sql`e.version_id = ${versionId}`];
			if (department) {
				conditions.push(Prisma.sql`e.department = ${department}`);
			}
			if (status) {
				conditions.push(Prisma.sql`e.status = ${status}`);
			}
			if (recordType) {
				conditions.push(Prisma.sql`e.record_type = ${recordType}`);
			}
			const whereClause = Prisma.join(conditions, ' AND ');

			const employees = await prisma.$queryRaw<DecryptedEmployee[]>`
				SELECT ${selectCols}
				FROM employees e
				LEFT JOIN disciplines d ON d.id = e.discipline_id
				LEFT JOIN service_obligation_profiles sp
					ON sp.id = e.service_profile_id
				WHERE ${whereClause}
				ORDER BY e.department, e.name
				LIMIT ${page_size} OFFSET ${offset}
			`;

			const countResult = await prisma.$queryRaw<[{ count: bigint }]>`
				SELECT COUNT(*) as count FROM employees e WHERE ${whereClause}
			`;
			const total = Number(countResult[0]?.count ?? 0);

			return {
				employees: employees.map((e) => formatEmployee(e, redactSalary)),
				total,
				page,
				page_size,
			};
		},
	});

	// GET /employees/:id — single employee with salary decryption
	app.get('/employees/:id', {
		schema: {
			params: employeeIdParams,
		},
		preHandler: [app.authenticate],
		handler: async (request, reply) => {
			const { versionId, id } = request.params as z.infer<typeof employeeIdParams>;

			const redactSalary = request.user.role === 'Viewer';
			const key = redactSalary ? '' : getEncryptionKey();

			const salaryFragment = redactSalary ? REDACTED_SALARY_SELECT : buildDecryptSelect(key);
			const selectCols = buildEmployeeSelect(salaryFragment);

			const employees = await prisma.$queryRaw<DecryptedEmployee[]>`
				SELECT ${selectCols}
				FROM employees e
				LEFT JOIN disciplines d ON d.id = e.discipline_id
				LEFT JOIN service_obligation_profiles sp
					ON sp.id = e.service_profile_id
				WHERE e.version_id = ${versionId} AND e.id = ${id}
			`;

			if (employees.length === 0) {
				return reply.status(404).send({
					code: 'EMPLOYEE_NOT_FOUND',
					message: `Employee ${id} not found in version ${versionId}`,
				});
			}

			return formatEmployee(employees[0]!, redactSalary);
		},
	});

	// POST /employees — create with pgcrypto encryption
	app.post('/employees', {
		schema: {
			params: versionIdParams,
			body: employeeBody,
		},
		preHandler: [app.authenticate, app.requirePermission('data:edit')],
		handler: async (request, reply) => {
			const { versionId } = request.params as z.infer<typeof versionIdParams>;
			const body = request.body as z.infer<typeof employeeBody>;

			// AC-02: isTeaching validation
			const teachingErrors = validateTeachingFields(body);
			if (teachingErrors.length > 0) {
				return reply.status(400).send({
					code: 'TEACHING_FIELDS_REQUIRED',
					message: teachingErrors.join('; '),
					errors: teachingErrors,
				});
			}

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
					message: 'Cannot modify a locked or archived version',
				});
			}

			// AC-04: VACANCY auto-generates employeeCode
			let employeeCode = body.employeeCode;
			if (body.recordType === 'VACANCY') {
				employeeCode = await generateVacancyCode(versionId);
			} else if (!employeeCode) {
				return reply.status(400).send({
					code: 'EMPLOYEE_CODE_REQUIRED',
					message: 'employeeCode is required for non-vacancy records',
				});
			}

			// Duplicate check
			const existing = await prisma.employee.findUnique({
				where: {
					versionId_employeeCode: {
						versionId,
						employeeCode: employeeCode!,
					},
				},
			});
			if (existing) {
				return reply.status(409).send({
					code: 'DUPLICATE_EMPLOYEE_CODE',
					message: `Employee code ${employeeCode} already exists` + ` in version ${versionId}`,
				});
			}

			const key = getEncryptionKey();

			const augEffDate = body.augmentationEffectiveDate
				? Prisma.sql`${body.augmentationEffectiveDate}::date`
				: Prisma.sql`NULL`;

			const contractEnd = body.contractEndDate
				? Prisma.sql`${body.contractEndDate}::date`
				: Prisma.sql`NULL`;

			// AC-04: For vacancies, salary fields can be null (null = zero cost)
			const baseSalary = body.baseSalary ?? '0.0000';
			const housingAllowance = body.housingAllowance ?? '0.0000';
			const transportAllowance = body.transportAllowance ?? '0.0000';

			// AC-03: hsaAmount always defaults to '0.0000' (computed by pipeline)
			const hsaAmount = '0.0000';

			// Insert with pgcrypto encryption for salary fields
			const result = await prisma.$queryRaw<[{ id: number }]>`
				INSERT INTO employees (
					version_id, employee_code, name, function_role, department,
					status, joining_date, payment_method, is_saudi, is_ajeer,
					is_teaching, hourly_percentage, base_salary, housing_allowance,
					transport_allowance, responsibility_premium, hsa_amount,
					augmentation, augmentation_effective_date,
					ajeer_annual_levy, ajeer_monthly_fee,
					record_type, cost_mode, discipline_id,
					service_profile_id, home_band, contract_end_date,
					created_by, created_at, updated_at
				) VALUES (
					${versionId}, ${employeeCode!}, ${body.name},
					${body.functionRole}, ${body.department},
					${body.status}, ${body.joiningDate}::date,
					${body.paymentMethod},
					${body.isSaudi}, ${body.isAjeer}, ${body.isTeaching},
					${Number(body.hourlyPercentage)},
					pgp_sym_encrypt(${baseSalary}, ${key}),
					pgp_sym_encrypt(${housingAllowance}, ${key}),
					pgp_sym_encrypt(${transportAllowance}, ${key}),
					pgp_sym_encrypt(${body.responsibilityPremium}, ${key}),
					pgp_sym_encrypt(${hsaAmount}, ${key}),
					pgp_sym_encrypt(${body.augmentation}, ${key}),
					${augEffDate},
					${Number(body.ajeerAnnualLevy)},
					${Number(body.ajeerMonthlyFee)},
					${body.recordType}, ${body.costMode},
					${body.disciplineId ?? null},
					${body.serviceProfileId ?? null},
					${body.homeBand ?? null},
					${contractEnd},
					${request.user.id}, NOW(), NOW()
				)
				RETURNING id
			`;

			await addStaleFlag(versionId);

			// Audit
			await prisma.auditEntry.create({
				data: {
					userId: request.user.id,
					userEmail: request.user.email,
					operation: 'EMPLOYEE_CREATED',
					tableName: 'employees',
					recordId: result[0]!.id,
					newValues: {
						employee_code: employeeCode,
						name: body.name,
						department: body.department,
						record_type: body.recordType,
					} as unknown as Prisma.InputJsonValue,
					ipAddress: request.ip,
				},
			});

			// Return the created employee
			const salaryFragment = buildDecryptSelect(key);
			const selectCols = buildEmployeeSelect(salaryFragment);

			const employees = await prisma.$queryRaw<DecryptedEmployee[]>`
				SELECT ${selectCols}
				FROM employees e
				LEFT JOIN disciplines d ON d.id = e.discipline_id
				LEFT JOIN service_obligation_profiles sp
					ON sp.id = e.service_profile_id
				WHERE e.id = ${result[0]!.id}
			`;

			return reply.status(201).send(formatEmployee(employees[0]!, false));
		},
	});

	// PUT /employees/:id — update with optimistic locking
	app.put('/employees/:id', {
		schema: {
			params: employeeIdParams,
			body: employeeBody,
		},
		preHandler: [app.authenticate, app.requirePermission('data:edit')],
		handler: async (request, reply) => {
			const { versionId, id } = request.params as z.infer<typeof employeeIdParams>;
			const body = request.body as z.infer<typeof employeeBody>;

			// AC-02: isTeaching validation
			const teachingErrors = validateTeachingFields(body);
			if (teachingErrors.length > 0) {
				return reply.status(400).send({
					code: 'TEACHING_FIELDS_REQUIRED',
					message: teachingErrors.join('; '),
					errors: teachingErrors,
				});
			}

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
					message: 'Cannot modify a locked or archived version',
				});
			}

			// Find existing
			const existing = await prisma.employee.findFirst({
				where: { id, versionId },
			});
			if (!existing) {
				return reply.status(404).send({
					code: 'EMPLOYEE_NOT_FOUND',
					message: `Employee ${id} not found in version ${versionId}`,
				});
			}

			// Optimistic locking
			const ifMatch = request.headers['if-match'];
			if (ifMatch) {
				const existingTimestamp = existing.updatedAt.toISOString();
				if (ifMatch !== existingTimestamp) {
					return reply.status(409).send({
						code: 'OPTIMISTIC_LOCK',
						message: 'Record was modified by another user',
					});
				}
			}

			// For PUT, use existing employeeCode if not provided, or
			// existing vacancy code (vacancies keep their code on update)
			const employeeCode = body.employeeCode ?? existing.employeeCode;

			// Duplicate code check (if code changed)
			if (employeeCode !== existing.employeeCode) {
				const dup = await prisma.employee.findUnique({
					where: {
						versionId_employeeCode: {
							versionId,
							employeeCode,
						},
					},
				});
				if (dup) {
					return reply.status(409).send({
						code: 'DUPLICATE_EMPLOYEE_CODE',
						message: `Employee code ${employeeCode} already exists`,
					});
				}
			}

			const key = getEncryptionKey();

			const augEffDate = body.augmentationEffectiveDate
				? Prisma.sql`${body.augmentationEffectiveDate}::date`
				: Prisma.sql`NULL`;

			const contractEnd = body.contractEndDate
				? Prisma.sql`${body.contractEndDate}::date`
				: Prisma.sql`NULL`;

			// AC-04: For vacancies, salary fields can be null
			const baseSalary = body.baseSalary ?? '0.0000';
			const housingAllowance = body.housingAllowance ?? '0.0000';
			const transportAllowance = body.transportAllowance ?? '0.0000';

			// AC-03: hsaAmount always '0.0000' (computed by pipeline)
			const hsaAmount = '0.0000';

			await prisma.$executeRaw`
				UPDATE employees SET
					employee_code = ${employeeCode},
					name = ${body.name},
					function_role = ${body.functionRole},
					department = ${body.department},
					status = ${body.status},
					joining_date = ${body.joiningDate}::date,
					payment_method = ${body.paymentMethod},
					is_saudi = ${body.isSaudi},
					is_ajeer = ${body.isAjeer},
					is_teaching = ${body.isTeaching},
					hourly_percentage = ${Number(body.hourlyPercentage)},
					base_salary = pgp_sym_encrypt(${baseSalary}, ${key}),
					housing_allowance =
						pgp_sym_encrypt(${housingAllowance}, ${key}),
					transport_allowance =
						pgp_sym_encrypt(${transportAllowance}, ${key}),
					responsibility_premium =
						pgp_sym_encrypt(${body.responsibilityPremium}, ${key}),
					hsa_amount = pgp_sym_encrypt(${hsaAmount}, ${key}),
					augmentation =
						pgp_sym_encrypt(${body.augmentation}, ${key}),
					augmentation_effective_date = ${augEffDate},
					ajeer_annual_levy = ${Number(body.ajeerAnnualLevy)},
					ajeer_monthly_fee = ${Number(body.ajeerMonthlyFee)},
					record_type = ${body.recordType},
					cost_mode = ${body.costMode},
					discipline_id = ${body.disciplineId ?? null},
					service_profile_id = ${body.serviceProfileId ?? null},
					home_band = ${body.homeBand ?? null},
					contract_end_date = ${contractEnd},
					updated_by = ${request.user.id},
					updated_at = NOW()
				WHERE id = ${id} AND version_id = ${versionId}
			`;

			await addStaleFlag(versionId);

			// Audit
			await prisma.auditEntry.create({
				data: {
					userId: request.user.id,
					userEmail: request.user.email,
					operation: 'EMPLOYEE_UPDATED',
					tableName: 'employees',
					recordId: id,
					newValues: {
						employee_code: employeeCode,
						department: body.department,
					} as unknown as Prisma.InputJsonValue,
					ipAddress: request.ip,
				},
			});

			// Return updated
			const salaryFragment = buildDecryptSelect(key);
			const selectCols = buildEmployeeSelect(salaryFragment);

			const employees = await prisma.$queryRaw<DecryptedEmployee[]>`
				SELECT ${selectCols}
				FROM employees e
				LEFT JOIN disciplines d ON d.id = e.discipline_id
				LEFT JOIN service_obligation_profiles sp
					ON sp.id = e.service_profile_id
				WHERE e.id = ${id}
			`;

			return formatEmployee(employees[0]!, false);
		},
	});

	// DELETE /employees/:id
	app.delete('/employees/:id', {
		schema: {
			params: employeeIdParams,
		},
		preHandler: [app.authenticate, app.requireRole('Admin', 'BudgetOwner')],
		handler: async (request, reply) => {
			const { versionId, id } = request.params as z.infer<typeof employeeIdParams>;

			const version = await prisma.budgetVersion.findUnique({
				where: { id: versionId },
			});
			if (!version) {
				return reply.status(404).send({
					code: 'VERSION_NOT_FOUND',
					message: `Version ${versionId} not found`,
				});
			}
			if (version.status === 'Locked' || version.status === 'Archived') {
				return reply.status(409).send({
					code: 'VERSION_LOCKED',
					message: 'Cannot modify a locked or archived version',
				});
			}

			const existing = await prisma.employee.findFirst({
				where: { id, versionId },
			});
			if (!existing) {
				return reply.status(404).send({
					code: 'EMPLOYEE_NOT_FOUND',
					message: `Employee ${id} not found in version ${versionId}`,
				});
			}

			if (version.status === 'Draft') {
				// Hard delete on Draft
				await prisma.employee.delete({ where: { id } });
			} else {
				// Soft delete on Published — set status to Departed
				await prisma.employee.update({
					where: { id },
					data: { status: 'Departed', updatedBy: request.user.id },
				});
			}

			await addStaleFlag(versionId);

			// Audit
			await prisma.auditEntry.create({
				data: {
					userId: request.user.id,
					userEmail: request.user.email,
					operation: version.status === 'Draft' ? 'EMPLOYEE_DELETED' : 'EMPLOYEE_DEPARTED',
					tableName: 'employees',
					recordId: id,
					oldValues: {
						employee_code: existing.employeeCode,
					} as unknown as Prisma.InputJsonValue,
					ipAddress: request.ip,
				},
			});

			return reply.status(204).send();
		},
	});
}

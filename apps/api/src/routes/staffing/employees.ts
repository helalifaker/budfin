import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { getEncryptionKey } from '../../services/staffing/crypto-helper.js';

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
	page: z.coerce.number().int().positive().default(1),
	page_size: z.coerce.number().int().positive().max(100).default(50),
});

const employeeBody = z.object({
	employeeCode: z.string().min(1).max(20),
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
	baseSalary: z.string(),
	housingAllowance: z.string(),
	transportAllowance: z.string(),
	responsibilityPremium: z.string().default('0.0000'),
	hsaAmount: z.string().default('0.0000'),
	augmentation: z.string().default('0.0000'),
	augmentationEffectiveDate: z.string().date().nullable().optional(),
	ajeerAnnualLevy: z.string().default('0.0000'),
	ajeerMonthlyFee: z.string().default('0.0000'),
});

// ── Salary field encryption/decryption helpers ───────────────────────────────

const SALARY_FIELDS = [
	'base_salary',
	'housing_allowance',
	'transport_allowance',
	'responsibility_premium',
	'hsa_amount',
	'augmentation',
] as const;

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
			const { department, status, page, page_size } = request.query as z.infer<
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

			// Build WHERE conditions
			const conditions = [`e.version_id = ${versionId}`];
			if (department) conditions.push(`e.department = '${department}'`);
			if (status) conditions.push(`e.status = '${status}'`);
			const whereClause = conditions.join(' AND ');

			const salarySelect = redactSalary
				? SALARY_FIELDS.map((f) => `NULL as ${f}`).join(', ')
				: SALARY_FIELDS.map((f) => `pgp_sym_decrypt(e.${f}, '${key}') as ${f}`).join(', ');

			const employees = await prisma.$queryRawUnsafe<DecryptedEmployee[]>(`
				SELECT e.id, e.version_id, e.employee_code, e.name,
					e.function_role, e.department, e.status, e.joining_date,
					e.payment_method, e.is_saudi, e.is_ajeer, e.is_teaching,
					e.hourly_percentage::text as hourly_percentage,
					${salarySelect},
					e.augmentation_effective_date,
					e.ajeer_annual_levy::text as ajeer_annual_levy,
					e.ajeer_monthly_fee::text as ajeer_monthly_fee,
					e.created_at, e.updated_at, e.created_by, e.updated_by
				FROM employees e
				WHERE ${whereClause}
				ORDER BY e.department, e.name
				LIMIT ${page_size} OFFSET ${offset}
			`);

			const countResult = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
				`SELECT COUNT(*) as count FROM employees e WHERE ${whereClause}`
			);
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

			const salarySelect = redactSalary
				? SALARY_FIELDS.map((f) => `NULL as ${f}`).join(', ')
				: SALARY_FIELDS.map((f) => `pgp_sym_decrypt(e.${f}, '${key}') as ${f}`).join(', ');

			const employees = await prisma.$queryRawUnsafe<DecryptedEmployee[]>(`
				SELECT e.id, e.version_id, e.employee_code, e.name,
					e.function_role, e.department, e.status, e.joining_date,
					e.payment_method, e.is_saudi, e.is_ajeer, e.is_teaching,
					e.hourly_percentage::text as hourly_percentage,
					${salarySelect},
					e.augmentation_effective_date,
					e.ajeer_annual_levy::text as ajeer_annual_levy,
					e.ajeer_monthly_fee::text as ajeer_monthly_fee,
					e.created_at, e.updated_at, e.created_by, e.updated_by
				FROM employees e
				WHERE e.version_id = ${versionId} AND e.id = ${id}
			`);

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

			// Duplicate check
			const existing = await prisma.employee.findUnique({
				where: {
					versionId_employeeCode: {
						versionId,
						employeeCode: body.employeeCode,
					},
				},
			});
			if (existing) {
				return reply.status(409).send({
					code: 'DUPLICATE_EMPLOYEE_CODE',
					message: `Employee code ${body.employeeCode} already exists in version ${versionId}`,
				});
			}

			const key = getEncryptionKey();

			// Insert with pgcrypto encryption for salary fields
			const result = await prisma.$queryRawUnsafe<[{ id: number }]>(`
				INSERT INTO employees (
					version_id, employee_code, name, function_role, department,
					status, joining_date, payment_method, is_saudi, is_ajeer,
					is_teaching, hourly_percentage, base_salary, housing_allowance,
					transport_allowance, responsibility_premium, hsa_amount,
					augmentation, augmentation_effective_date,
					ajeer_annual_levy, ajeer_monthly_fee,
					created_by, created_at, updated_at
				) VALUES (
					${versionId}, '${body.employeeCode}', '${body.name.replace(/'/g, "''")}',
					'${body.functionRole.replace(/'/g, "''")}', '${body.department.replace(/'/g, "''")}',
					'${body.status}', '${body.joiningDate}'::date,
					'${body.paymentMethod.replace(/'/g, "''")}',
					${body.isSaudi}, ${body.isAjeer}, ${body.isTeaching},
					${body.hourlyPercentage},
					pgp_sym_encrypt('${body.baseSalary}', '${key}'),
					pgp_sym_encrypt('${body.housingAllowance}', '${key}'),
					pgp_sym_encrypt('${body.transportAllowance}', '${key}'),
					pgp_sym_encrypt('${body.responsibilityPremium}', '${key}'),
					pgp_sym_encrypt('${body.hsaAmount}', '${key}'),
					pgp_sym_encrypt('${body.augmentation}', '${key}'),
					${body.augmentationEffectiveDate ? `'${body.augmentationEffectiveDate}'::date` : 'NULL'},
					${body.ajeerAnnualLevy}, ${body.ajeerMonthlyFee},
					${request.user.id}, NOW(), NOW()
				)
				RETURNING id
			`);

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
						employee_code: body.employeeCode,
						name: body.name,
						department: body.department,
					} as unknown as Prisma.InputJsonValue,
					ipAddress: request.ip,
				},
			});

			// Return the created employee
			const salarySelect = SALARY_FIELDS.map(
				(f) => `pgp_sym_decrypt(e.${f}, '${key}') as ${f}`
			).join(', ');

			const employees = await prisma.$queryRawUnsafe<DecryptedEmployee[]>(`
				SELECT e.id, e.version_id, e.employee_code, e.name,
					e.function_role, e.department, e.status, e.joining_date,
					e.payment_method, e.is_saudi, e.is_ajeer, e.is_teaching,
					e.hourly_percentage::text as hourly_percentage,
					${salarySelect},
					e.augmentation_effective_date,
					e.ajeer_annual_levy::text as ajeer_annual_levy,
					e.ajeer_monthly_fee::text as ajeer_monthly_fee,
					e.created_at, e.updated_at, e.created_by, e.updated_by
				FROM employees e WHERE e.id = ${result[0]!.id}
			`);

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

			// Duplicate code check (if code changed)
			if (body.employeeCode !== existing.employeeCode) {
				const dup = await prisma.employee.findUnique({
					where: {
						versionId_employeeCode: {
							versionId,
							employeeCode: body.employeeCode,
						},
					},
				});
				if (dup) {
					return reply.status(409).send({
						code: 'DUPLICATE_EMPLOYEE_CODE',
						message: `Employee code ${body.employeeCode} already exists`,
					});
				}
			}

			const key = getEncryptionKey();

			await prisma.$executeRawUnsafe(`
				UPDATE employees SET
					employee_code = '${body.employeeCode}',
					name = '${body.name.replace(/'/g, "''")}',
					function_role = '${body.functionRole.replace(/'/g, "''")}',
					department = '${body.department.replace(/'/g, "''")}',
					status = '${body.status}',
					joining_date = '${body.joiningDate}'::date,
					payment_method = '${body.paymentMethod.replace(/'/g, "''")}',
					is_saudi = ${body.isSaudi},
					is_ajeer = ${body.isAjeer},
					is_teaching = ${body.isTeaching},
					hourly_percentage = ${body.hourlyPercentage},
					base_salary = pgp_sym_encrypt('${body.baseSalary}', '${key}'),
					housing_allowance = pgp_sym_encrypt('${body.housingAllowance}', '${key}'),
					transport_allowance = pgp_sym_encrypt('${body.transportAllowance}', '${key}'),
					responsibility_premium = pgp_sym_encrypt('${body.responsibilityPremium}', '${key}'),
					hsa_amount = pgp_sym_encrypt('${body.hsaAmount}', '${key}'),
					augmentation = pgp_sym_encrypt('${body.augmentation}', '${key}'),
					augmentation_effective_date = ${body.augmentationEffectiveDate ? `'${body.augmentationEffectiveDate}'::date` : 'NULL'},
					ajeer_annual_levy = ${body.ajeerAnnualLevy},
					ajeer_monthly_fee = ${body.ajeerMonthlyFee},
					updated_by = ${request.user.id},
					updated_at = NOW()
				WHERE id = ${id} AND version_id = ${versionId}
			`);

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
						employee_code: body.employeeCode,
						department: body.department,
					} as unknown as Prisma.InputJsonValue,
					ipAddress: request.ip,
				},
			});

			// Return updated
			const salarySelect = SALARY_FIELDS.map(
				(f) => `pgp_sym_decrypt(e.${f}, '${key}') as ${f}`
			).join(', ');

			const employees = await prisma.$queryRawUnsafe<DecryptedEmployee[]>(`
				SELECT e.id, e.version_id, e.employee_code, e.name,
					e.function_role, e.department, e.status, e.joining_date,
					e.payment_method, e.is_saudi, e.is_ajeer, e.is_teaching,
					e.hourly_percentage::text as hourly_percentage,
					${salarySelect},
					e.augmentation_effective_date,
					e.ajeer_annual_levy::text as ajeer_annual_levy,
					e.ajeer_monthly_fee::text as ajeer_monthly_fee,
					e.created_at, e.updated_at, e.created_by, e.updated_by
				FROM employees e WHERE e.id = ${id}
			`);

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

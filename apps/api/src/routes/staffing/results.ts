import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Decimal } from 'decimal.js';
import { prisma } from '../../lib/prisma.js';

const versionIdParams = z.object({
	versionId: z.coerce.number().int().positive(),
});

const staffCostsQuery = z.object({
	group_by: z.enum(['employee', 'department', 'month', 'category_month']).default('month'),
	include_breakdown: z.coerce.boolean().default(false),
});

const CATEGORY_DEFINITIONS = [
	{
		category: 'gross_salaries_existing',
		label: 'Existing Staff',
		parent: 'local_staff_salaries',
	},
	{
		category: 'gross_salaries_new',
		label: 'New Staff',
		parent: 'local_staff_salaries',
	},
	{ category: 'gosi', label: 'GOSI', parent: null },
	{ category: 'ajeer', label: 'Ajeer', parent: null },
	{ category: 'eos_accrual', label: 'EoS Accrual', parent: null },
] as const;

export async function staffingResultRoutes(app: FastifyInstance) {
	// GET /staff-costs
	app.get('/staff-costs', {
		schema: {
			params: versionIdParams,
			querystring: staffCostsQuery,
		},
		preHandler: [app.authenticate],
		handler: async (request, reply) => {
			const { versionId } = request.params as z.infer<typeof versionIdParams>;
			const { group_by, include_breakdown } = request.query as z.infer<typeof staffCostsQuery>;
			const redactSalary = request.user.role === 'Viewer';

			const version = await prisma.budgetVersion.findUnique({
				where: { id: versionId },
			});
			if (!version) {
				return reply.status(404).send({
					code: 'VERSION_NOT_FOUND',
					message: `Version ${versionId} not found`,
				});
			}

			if (version.staleModules.includes('STAFFING')) {
				return reply.status(409).send({
					code: 'STALE_DATA',
					message: 'Staffing has not been (re)calculated since last input change',
				});
			}

			const costs = await prisma.monthlyStaffCost.findMany({
				where: { versionId },
				include: { employee: true },
				orderBy: [{ employeeId: 'asc' }, { month: 'asc' }],
			});

			// Category-month breakdown (Tab C: Monthly Cost Budget)
			if (group_by === 'category_month') {
				return buildCategoryMonthResponse(costs, redactSalary);
			}

			// Group based on query param
			const groups = new Map<
				string,
				{
					totalGross: Decimal;
					totalAllowances: Decimal;
					totalSocialCharges: Decimal;
					totalCost: Decimal;
				}
			>();

			for (const c of costs) {
				let groupKey: string;
				switch (group_by) {
					case 'employee':
						groupKey = c.employee.name;
						break;
					case 'department':
						groupKey = c.employee.department;
						break;
					case 'month':
					default:
						groupKey = `Month ${c.month}`;
						break;
				}

				const existing = groups.get(groupKey) ?? {
					totalGross: new Decimal(0),
					totalAllowances: new Decimal(0),
					totalSocialCharges: new Decimal(0),
					totalCost: new Decimal(0),
				};

				existing.totalGross = existing.totalGross.plus(c.baseGross);
				existing.totalAllowances = existing.totalAllowances
					.plus(c.housingAllowance)
					.plus(c.transportAllowance)
					.plus(c.responsibilityPremium)
					.plus(c.hsaAmount);
				existing.totalSocialCharges = existing.totalSocialCharges
					.plus(c.gosiAmount)
					.plus(c.ajeerAmount)
					.plus(c.eosMonthlyAccrual);
				existing.totalCost = existing.totalCost.plus(c.totalCost);

				groups.set(groupKey, existing);
			}

			const data = [...groups.entries()].map(([key, vals]) => ({
				group_key: key,
				total_gross_salary: redactSalary ? null : vals.totalGross.toFixed(4),
				total_allowances: redactSalary ? null : vals.totalAllowances.toFixed(4),
				total_social_charges: vals.totalSocialCharges.toFixed(4),
				total_staff_cost: vals.totalCost.toFixed(4),
			}));

			// Totals
			let totalGross = new Decimal(0);
			let totalAllowances = new Decimal(0);
			let totalSocial = new Decimal(0);
			let totalCost = new Decimal(0);
			for (const vals of groups.values()) {
				totalGross = totalGross.plus(vals.totalGross);
				totalAllowances = totalAllowances.plus(vals.totalAllowances);
				totalSocial = totalSocial.plus(vals.totalSocialCharges);
				totalCost = totalCost.plus(vals.totalCost);
			}

			const response: Record<string, unknown> = {
				data,
				totals: {
					total_gross_salary: redactSalary ? null : totalGross.toFixed(4),
					total_allowances: redactSalary ? null : totalAllowances.toFixed(4),
					total_social_charges: totalSocial.toFixed(4),
					total_staff_cost: totalCost.toFixed(4),
				},
			};

			if (include_breakdown && !redactSalary) {
				response.breakdown = costs.map((c) => ({
					employee_id: c.employeeId,
					employee_name: c.employee.name,
					department: c.employee.department,
					month: c.month,
					base_gross: c.baseGross.toString(),
					adjusted_gross: c.adjustedGross.toString(),
					housing_allowance: c.housingAllowance.toString(),
					transport_allowance: c.transportAllowance.toString(),
					responsibility_premium: c.responsibilityPremium.toString(),
					hsa_amount: c.hsaAmount.toString(),
					gosi_amount: c.gosiAmount.toString(),
					ajeer_amount: c.ajeerAmount.toString(),
					eos_monthly_accrual: c.eosMonthlyAccrual.toString(),
					total_cost: c.totalCost.toString(),
				}));
			} else {
				response.breakdown = null;
			}

			return response;
		},
	});

	// GET /staffing-summary
	app.get('/staffing-summary', {
		schema: { params: versionIdParams },
		preHandler: [app.authenticate],
		handler: async (request, reply) => {
			const { versionId } = request.params as z.infer<typeof versionIdParams>;

			const version = await prisma.budgetVersion.findUnique({
				where: { id: versionId },
			});
			if (!version) {
				return reply.status(404).send({
					code: 'VERSION_NOT_FOUND',
					message: `Version ${versionId} not found`,
				});
			}

			if (version.staleModules.includes('STAFFING')) {
				return reply.status(409).send({
					code: 'STALE_DATA',
					message: 'Staffing has not been (re)calculated since last input change',
				});
			}

			// FTE from DHG requirements
			const dhgReqs = await prisma.dhgRequirement.findMany({
				where: { versionId },
			});
			const totalFTE = dhgReqs.reduce((sum, r) => sum.plus(r.fte), new Decimal(0)).toFixed(4);

			// Cost by department
			const costs = await prisma.monthlyStaffCost.findMany({
				where: { versionId },
				include: { employee: true },
			});

			const deptMap = new Map<string, Decimal>();
			let totalSalaryCost = new Decimal(0);

			for (const c of costs) {
				const dept = c.employee.department;
				const existing = deptMap.get(dept) ?? new Decimal(0);
				deptMap.set(dept, existing.plus(c.totalCost));
				totalSalaryCost = totalSalaryCost.plus(c.totalCost);
			}

			const byDepartment = [...deptMap.entries()].map(([dept, cost]) => ({
				department: dept,
				total_cost: cost.toFixed(4),
			}));

			return {
				fte: totalFTE,
				cost: totalSalaryCost.toFixed(4),
				byDepartment,
			};
		},
	});
	// GET /category-costs — Contrats Locaux & Residents monthly costs
	app.get('/category-costs', {
		schema: { params: versionIdParams },
		preHandler: [app.authenticate],
		handler: async (request, reply) => {
			const { versionId } = request.params as z.infer<typeof versionIdParams>;

			const version = await prisma.budgetVersion.findUnique({
				where: { id: versionId },
			});
			if (!version) {
				return reply.status(404).send({
					code: 'VERSION_NOT_FOUND',
					message: `Version ${versionId} not found`,
				});
			}

			if (version.staleModules.includes('STAFFING')) {
				return reply.status(409).send({
					code: 'STALE_DATA',
					message: 'Staffing has not been (re)calculated since last input change',
				});
			}

			const rows = await prisma.categoryMonthlyCost.findMany({
				where: { versionId },
				orderBy: [{ month: 'asc' }, { category: 'asc' }],
			});

			// Group by month
			const monthlyData = new Map<number, Record<string, string>>();

			let grandTotal = new Decimal(0);

			for (const row of rows) {
				const existing = monthlyData.get(row.month) ?? {};
				existing[row.category] = row.amount.toString();
				monthlyData.set(row.month, existing);
				grandTotal = grandTotal.plus(row.amount);
			}

			const data = [...monthlyData.entries()].map(([month, categories]) => ({
				month,
				...categories,
			}));

			return {
				data,
				grand_total: grandTotal.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4),
			};
		},
	});
}

type CostWithEmployee = {
	month: number;
	adjustedGross: Decimal | { toString(): string };
	gosiAmount: Decimal | { toString(): string };
	ajeerAmount: Decimal | { toString(): string };
	eosMonthlyAccrual: Decimal | { toString(): string };
	employee: { status: string };
};

function buildCategoryMonthResponse(costs: CostWithEmployee[], redactSalary: boolean) {
	type CategoryKey = (typeof CATEGORY_DEFINITIONS)[number]['category'];

	// Initialize 12-month accumulators for each category
	const initMonths = (): Decimal[] => Array.from({ length: 12 }, () => new Decimal(0));
	const monthlyData = new Map<CategoryKey, Decimal[]>();
	for (const def of CATEGORY_DEFINITIONS) {
		monthlyData.set(def.category, initMonths());
	}

	for (const c of costs) {
		const idx = c.month - 1; // month is 1-based, array is 0-based
		const isExisting = c.employee.status === 'Existing';

		// Gross salaries split by employee status
		const grossKey: CategoryKey = isExisting ? 'gross_salaries_existing' : 'gross_salaries_new';
		const grossArr = monthlyData.get(grossKey)!;
		// month validated 1-12 by DB constraint; idx is always 0-11
		grossArr[idx] = grossArr[idx]!.plus(c.adjustedGross.toString());

		// Social charges — not salary-sensitive
		const gosiArr = monthlyData.get('gosi')!;
		gosiArr[idx] = gosiArr[idx]!.plus(c.gosiAmount.toString());

		const ajeerArr = monthlyData.get('ajeer')!;
		ajeerArr[idx] = ajeerArr[idx]!.plus(c.ajeerAmount.toString());

		const eosArr = monthlyData.get('eos_accrual')!;
		eosArr[idx] = eosArr[idx]!.plus(c.eosMonthlyAccrual.toString());
	}

	const categories = CATEGORY_DEFINITIONS.map((def) => {
		const isSalaryCategory =
			def.category === 'gross_salaries_existing' || def.category === 'gross_salaries_new';
		const shouldRedact = redactSalary && isSalaryCategory;
		const arr = monthlyData.get(def.category)!;

		const values = arr.map((v) =>
			shouldRedact ? null : v.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4)
		);

		return {
			category: def.category,
			label: def.label,
			parent: def.parent,
			values,
		};
	});

	const annualTotals: Record<string, string | null> = {};
	for (const def of CATEGORY_DEFINITIONS) {
		const isSalaryCategory =
			def.category === 'gross_salaries_existing' || def.category === 'gross_salaries_new';
		const shouldRedact = redactSalary && isSalaryCategory;

		if (shouldRedact) {
			annualTotals[def.category] = null;
		} else {
			const arr = monthlyData.get(def.category)!;
			const annual = arr
				.reduce((sum, v) => sum.plus(v), new Decimal(0))
				.toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
			annualTotals[def.category] = annual.toFixed(4);
		}
	}

	return {
		months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
		categories,
		annual_totals: annualTotals,
	};
}

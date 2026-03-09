import { useState, useMemo } from 'react';
import Decimal from 'decimal.js';
import { cn } from '../../lib/cn';
import { Skeleton } from '../ui/skeleton';
import type {
	CategoryMonthData,
	CategoryCostData,
	CategoryMonthEntry,
} from '../../hooks/use-staffing';

export type MonthlyCostBudgetGridProps = {
	staffCostData: CategoryMonthData | null;
	categoryCostData: CategoryCostData | null;
	isLoading: boolean;
};

const MONTH_LABELS = [
	'Jan',
	'Feb',
	'Mar',
	'Apr',
	'May',
	'Jun',
	'Jul',
	'Aug',
	'Sep',
	'Oct',
	'Nov',
	'Dec',
];

type RowType = 'parent' | 'child' | 'subtotal' | 'grand-total';

interface GridRow {
	id: string;
	label: string;
	type: RowType;
	parentId?: string;
	monthlyAmounts: string[];
	annualTotal: string;
}

function formatCurrency(value: string): string {
	const d = new Decimal(value);
	const rounded = d.toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
	return rounded.toNumber().toLocaleString('en-US', {
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	});
}

function sumMonthlyArrays(arrays: string[][]): string[] {
	if (arrays.length === 0) {
		return Array.from({ length: 12 }, () => '0.0000');
	}
	return Array.from({ length: 12 }, (_, i) => {
		let sum = new Decimal(0);
		for (const arr of arrays) {
			if (arr[i]) {
				sum = sum.plus(arr[i]);
			}
		}
		return sum.toFixed(4);
	});
}

function sumAnnuals(totals: string[]): string {
	let sum = new Decimal(0);
	for (const t of totals) {
		sum = sum.plus(t);
	}
	return sum.toFixed(4);
}

function findCategory(categories: CategoryMonthEntry[], key: string): CategoryMonthEntry | null {
	return categories.find((c) => c.key === key) ?? null;
}

function buildGridRows(
	staffCostData: CategoryMonthData,
	categoryCostData: CategoryCostData | null
): GridRow[] {
	const rows: GridRow[] = [];
	const zeroMonths = Array.from({ length: 12 }, () => '0.0000');

	// -- Local Staff Salaries (parent) --
	const existingStaff = findCategory(staffCostData.categories, 'gross_salaries_existing');
	const newStaff = findCategory(staffCostData.categories, 'gross_salaries_new');

	const localStaffMonthly = sumMonthlyArrays([
		existingStaff?.monthly_amounts ?? zeroMonths,
		newStaff?.monthly_amounts ?? zeroMonths,
	]);
	const localStaffAnnual = sumAnnuals([
		existingStaff?.annual_total ?? '0.0000',
		newStaff?.annual_total ?? '0.0000',
	]);

	rows.push({
		id: 'local_staff_salaries',
		label: 'Local Staff Salaries',
		type: 'parent',
		monthlyAmounts: localStaffMonthly,
		annualTotal: localStaffAnnual,
	});
	rows.push({
		id: 'existing_staff',
		label: 'Existing Staff',
		type: 'child',
		parentId: 'local_staff_salaries',
		monthlyAmounts: existingStaff?.monthly_amounts ?? zeroMonths,
		annualTotal: existingStaff?.annual_total ?? '0.0000',
	});
	rows.push({
		id: 'new_staff',
		label: 'New Staff',
		type: 'child',
		parentId: 'local_staff_salaries',
		monthlyAmounts: newStaff?.monthly_amounts ?? zeroMonths,
		annualTotal: newStaff?.annual_total ?? '0.0000',
	});

	// -- GOSI, Ajeer, EoS Accrual (level 1 rows) --
	const gosi = findCategory(staffCostData.categories, 'gosi');
	const ajeer = findCategory(staffCostData.categories, 'ajeer');
	const eos = findCategory(staffCostData.categories, 'eos_accrual');

	rows.push({
		id: 'gosi',
		label: 'GOSI',
		type: 'child',
		monthlyAmounts: gosi?.monthly_amounts ?? zeroMonths,
		annualTotal: gosi?.annual_total ?? '0.0000',
	});
	rows.push({
		id: 'ajeer',
		label: 'Ajeer',
		type: 'child',
		monthlyAmounts: ajeer?.monthly_amounts ?? zeroMonths,
		annualTotal: ajeer?.annual_total ?? '0.0000',
	});
	rows.push({
		id: 'eos_accrual',
		label: 'EoS Accrual',
		type: 'child',
		monthlyAmounts: eos?.monthly_amounts ?? zeroMonths,
		annualTotal: eos?.annual_total ?? '0.0000',
	});

	// -- Subtotal Local Staff --
	const subtotalMonthly = sumMonthlyArrays([
		localStaffMonthly,
		gosi?.monthly_amounts ?? zeroMonths,
		ajeer?.monthly_amounts ?? zeroMonths,
		eos?.monthly_amounts ?? zeroMonths,
	]);
	const subtotalAnnual = sumAnnuals([
		localStaffAnnual,
		gosi?.annual_total ?? '0.0000',
		ajeer?.annual_total ?? '0.0000',
		eos?.annual_total ?? '0.0000',
	]);

	rows.push({
		id: 'subtotal_local_staff',
		label: 'Subtotal Local Staff',
		type: 'subtotal',
		monthlyAmounts: subtotalMonthly,
		annualTotal: subtotalAnnual,
	});

	// -- Contrats Locaux (parent) --
	const catCosts = categoryCostData?.categories ?? [];
	const remplacements = findCategory(catCosts, 'remplacements');
	const formation = findCategory(catCosts, 'formation');

	const contratsMonthly = sumMonthlyArrays([
		remplacements?.monthly_amounts ?? zeroMonths,
		formation?.monthly_amounts ?? zeroMonths,
	]);
	const contratsAnnual = sumAnnuals([
		remplacements?.annual_total ?? '0.0000',
		formation?.annual_total ?? '0.0000',
	]);

	rows.push({
		id: 'contrats_locaux',
		label: 'Contrats Locaux',
		type: 'parent',
		monthlyAmounts: contratsMonthly,
		annualTotal: contratsAnnual,
	});
	rows.push({
		id: 'remplacements',
		label: 'Remplacements',
		type: 'child',
		parentId: 'contrats_locaux',
		monthlyAmounts: remplacements?.monthly_amounts ?? zeroMonths,
		annualTotal: remplacements?.annual_total ?? '0.0000',
	});
	rows.push({
		id: 'formation',
		label: 'Formation',
		type: 'child',
		parentId: 'contrats_locaux',
		monthlyAmounts: formation?.monthly_amounts ?? zeroMonths,
		annualTotal: formation?.annual_total ?? '0.0000',
	});

	// -- Residents (parent) --
	const residentSalaires = findCategory(catCosts, 'resident_salaires');
	const residentLogement = findCategory(catCosts, 'resident_logement');

	const residentsMonthly = sumMonthlyArrays([
		residentSalaires?.monthly_amounts ?? zeroMonths,
		residentLogement?.monthly_amounts ?? zeroMonths,
	]);
	const residentsAnnual = sumAnnuals([
		residentSalaires?.annual_total ?? '0.0000',
		residentLogement?.annual_total ?? '0.0000',
	]);

	rows.push({
		id: 'residents',
		label: 'Residents',
		type: 'parent',
		monthlyAmounts: residentsMonthly,
		annualTotal: residentsAnnual,
	});
	rows.push({
		id: 'resident_salaires',
		label: 'Resident Salaires',
		type: 'child',
		parentId: 'residents',
		monthlyAmounts: residentSalaires?.monthly_amounts ?? zeroMonths,
		annualTotal: residentSalaires?.annual_total ?? '0.0000',
	});
	rows.push({
		id: 'resident_logement',
		label: 'Resident Logement',
		type: 'child',
		parentId: 'residents',
		monthlyAmounts: residentLogement?.monthly_amounts ?? zeroMonths,
		annualTotal: residentLogement?.annual_total ?? '0.0000',
	});

	// -- Grand Total --
	const grandTotalMonthly = sumMonthlyArrays([subtotalMonthly, contratsMonthly, residentsMonthly]);
	const grandTotalAnnual = sumAnnuals([subtotalAnnual, contratsAnnual, residentsAnnual]);

	rows.push({
		id: 'grand_total',
		label: 'GRAND TOTAL',
		type: 'grand-total',
		monthlyAmounts: grandTotalMonthly,
		annualTotal: grandTotalAnnual,
	});

	return rows;
}

function LoadingSkeleton() {
	return (
		<table className="w-full border-collapse text-sm" role="grid" aria-readonly="true">
			<thead>
				<tr>
					<th className="px-3 py-2 text-left">
						<Skeleton className="h-4 w-24" />
					</th>
					{MONTH_LABELS.map((m) => (
						<th key={m} className="px-3 py-2">
							<Skeleton className="h-4 w-16" />
						</th>
					))}
					<th className="px-3 py-2">
						<Skeleton className="h-4 w-20" />
					</th>
				</tr>
			</thead>
			<tbody>
				{Array.from({ length: 8 }).map((_, i) => (
					<tr key={i}>
						<td className="px-3 py-2">
							<Skeleton className="h-4 w-32" />
						</td>
						{Array.from({ length: 13 }).map((_, j) => (
							<td key={j} className="px-3 py-2">
								<Skeleton className="h-4 w-16" />
							</td>
						))}
					</tr>
				))}
			</tbody>
		</table>
	);
}

export function MonthlyCostBudgetGrid({
	staffCostData,
	categoryCostData,
	isLoading,
}: MonthlyCostBudgetGridProps) {
	const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

	const gridRows = useMemo(() => {
		if (!staffCostData) return [];
		return buildGridRows(staffCostData, categoryCostData);
	}, [staffCostData, categoryCostData]);

	if (isLoading) {
		return <LoadingSkeleton />;
	}

	if (!staffCostData) {
		return (
			<div className="py-6 text-center text-sm text-(--text-muted)">
				No staff cost data available. Run Calculate to generate monthly costs.
			</div>
		);
	}

	function toggleGroup(groupId: string) {
		setCollapsedGroups((prev) => {
			const next = new Set(prev);
			if (next.has(groupId)) {
				next.delete(groupId);
			} else {
				next.add(groupId);
			}
			return next;
		});
	}

	const visibleRows = gridRows.filter((row) => {
		if (!row.parentId) return true;
		return !collapsedGroups.has(row.parentId);
	});

	return (
		<div className="overflow-x-auto rounded-(--radius-md) border border-(--workspace-border)">
			<table
				className="w-full border-collapse text-sm"
				role="grid"
				aria-readonly="true"
				aria-label="Monthly Cost Budget"
			>
				<thead>
					<tr className="bg-(--workspace-bg-subtle)">
						<th className="sticky left-0 z-10 min-w-[200px] bg-(--workspace-bg-subtle) px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-(--text-muted)">
							Category
						</th>
						{MONTH_LABELS.map((label, idx) => (
							<th
								key={label}
								className={cn(
									'min-w-[110px] px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-(--text-muted)',
									idx === 8 && 'bg-(--color-warning-bg)/30'
								)}
							>
								{label}
							</th>
						))}
						<th className="min-w-[130px] px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-(--text-muted)">
							Annual
						</th>
					</tr>
				</thead>
				<tbody>
					{visibleRows.map((row) => (
						<tr
							key={row.id}
							className={cn(
								'border-t border-(--workspace-border)',
								row.type === 'parent' && 'bg-(--workspace-bg-muted)',
								row.type === 'subtotal' &&
									'border-t-2 border-(--workspace-border) bg-(--workspace-bg-muted)',
								row.type === 'grand-total' &&
									'border-t-2 border-(--workspace-border) bg-(--workspace-bg-muted)'
							)}
						>
							<td
								className={cn(
									'sticky left-0 z-10 px-3 py-1.5 text-(--text-primary)',
									row.type === 'parent' && 'bg-(--workspace-bg-muted) font-semibold',
									row.type === 'child' && 'bg-(--workspace-bg) pl-9',
									row.type === 'subtotal' && 'bg-(--workspace-bg-muted) font-bold',
									row.type === 'grand-total' && 'bg-(--workspace-bg-muted) text-lg font-bold'
								)}
							>
								{row.type === 'parent' ? (
									<button
										type="button"
										className="flex w-full items-center gap-1.5 text-left"
										onClick={() => toggleGroup(row.id)}
										aria-expanded={!collapsedGroups.has(row.id)}
										aria-label={row.label}
									>
										<span
											className={cn(
												'inline-block text-xs transition-transform',
												collapsedGroups.has(row.id) && '-rotate-90'
											)}
											aria-hidden="true"
										>
											&#9660;
										</span>
										{row.label}
									</button>
								) : (
									row.label
								)}
							</td>
							{row.monthlyAmounts.map((amount, idx) => (
								<td
									key={idx}
									className={cn(
										'px-3 py-1.5 text-right font-mono text-(--text-primary)',
										idx === 8 && 'bg-(--color-warning-bg)/30',
										row.type === 'subtotal' && 'font-bold',
										row.type === 'grand-total' && 'font-bold'
									)}
								>
									{formatCurrency(amount)}
								</td>
							))}
							<td
								className={cn(
									'px-3 py-1.5 text-right font-mono font-semibold text-(--accent-700)',
									row.type === 'subtotal' && 'font-bold',
									row.type === 'grand-total' && 'text-lg font-bold'
								)}
							>
								{formatCurrency(row.annualTotal)}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

import { useState, useMemo } from 'react';
import { Decimal } from 'decimal.js';
import { cn } from '../../lib/cn';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { formatMoney } from '../../lib/format-money';
import type { CategoryMonthData, CategoryCostData } from '../../hooks/use-staffing';

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

// September is index 8 (0-based)
const SEP_INDEX = 8;

type AcademicPeriod = 'full' | 'ay1' | 'ay2' | 'summer';

const PERIOD_MONTHS: Record<AcademicPeriod, number[]> = {
	full: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
	ay1: [0, 1, 2, 3, 4, 5], // Jan-Jun
	ay2: [8, 9, 10, 11], // Sep-Dec
	summer: [6, 7], // Jul-Aug
};

type GridRow = {
	id: string;
	label: string;
	type: 'parent' | 'child' | 'subtotal' | 'grandtotal';
	parentId?: string;
	monthlyAmounts: (string | null)[];
	annualTotal: string | null;
};

function sumMonthArrays(...arrays: ((string | null)[] | null | undefined)[]): string[] {
	const result: string[] = [];
	for (let i = 0; i < 12; i++) {
		let sum = new Decimal(0);
		for (const arr of arrays) {
			const val = arr?.[i];
			if (val !== null && val !== undefined) {
				sum = sum.plus(val);
			}
		}
		result.push(sum.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4));
	}
	return result;
}

function sumVisibleMonths(monthlyAmounts: (string | null)[], visibleIndices: number[]): string {
	let sum = new Decimal(0);
	for (const idx of visibleIndices) {
		const val = monthlyAmounts[idx];
		if (val !== null && val !== undefined) {
			sum = sum.plus(val);
		}
	}
	return sum.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4);
}

export type MonthlyCostBudgetGridProps = {
	staffCostData: CategoryMonthData | null;
	categoryCostData: CategoryCostData | null;
	isLoading: boolean;
};

export function MonthlyCostBudgetGrid({
	staffCostData,
	categoryCostData,
	isLoading,
}: MonthlyCostBudgetGridProps) {
	const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
	const [period, setPeriod] = useState<AcademicPeriod>('full');

	const visibleMonthIndices = PERIOD_MONTHS[period];

	const rows = useMemo(() => {
		if (!staffCostData && !categoryCostData) return [];

		const result: GridRow[] = [];

		// --- Section 1: Local Staff Salaries ---
		const existingCat = staffCostData?.categories.find(
			(c) => c.category === 'gross_salaries_existing'
		);
		const newCat = staffCostData?.categories.find((c) => c.category === 'gross_salaries_new');

		const localSalaryMonthly = sumMonthArrays(existingCat?.values, newCat?.values);

		result.push({
			id: 'local_staff_salaries',
			label: 'Local Staff Salaries',
			type: 'parent',
			monthlyAmounts: localSalaryMonthly,
			annualTotal: null, // computed dynamically based on period
		});

		result.push({
			id: 'gross_salaries_existing',
			label: 'Existing Staff',
			type: 'child',
			parentId: 'local_staff_salaries',
			monthlyAmounts: existingCat?.values ?? Array(12).fill('0.0000'),
			annualTotal: null,
		});

		result.push({
			id: 'gross_salaries_new',
			label: 'New Staff',
			type: 'child',
			parentId: 'local_staff_salaries',
			monthlyAmounts: newCat?.values ?? Array(12).fill('0.0000'),
			annualTotal: null,
		});

		// --- Section 2: Social Charges ---
		const gosiCat = staffCostData?.categories.find((c) => c.category === 'gosi');
		const ajeerCat = staffCostData?.categories.find((c) => c.category === 'ajeer');
		const eosCat = staffCostData?.categories.find((c) => c.category === 'eos_accrual');

		result.push({
			id: 'gosi',
			label: 'GOSI',
			type: 'child',
			monthlyAmounts: gosiCat?.values ?? Array(12).fill('0.0000'),
			annualTotal: null,
		});

		result.push({
			id: 'ajeer',
			label: 'Ajeer',
			type: 'child',
			monthlyAmounts: ajeerCat?.values ?? Array(12).fill('0.0000'),
			annualTotal: null,
		});

		result.push({
			id: 'eos_accrual',
			label: 'EoS Accrual',
			type: 'child',
			monthlyAmounts: eosCat?.values ?? Array(12).fill('0.0000'),
			annualTotal: null,
		});

		// --- Subtotal Local Staff ---
		const subtotalLocalMonthly = sumMonthArrays(
			localSalaryMonthly,
			gosiCat?.values,
			ajeerCat?.values,
			eosCat?.values
		);

		result.push({
			id: 'subtotal_local',
			label: 'Subtotal Local Staff',
			type: 'subtotal',
			monthlyAmounts: subtotalLocalMonthly,
			annualTotal: null,
		});

		// --- Section 3: Contrats Locaux ---
		const remplacementsCat = categoryCostData?.data
			? buildCategoryMonthlyFromEntries(categoryCostData.data, 'remplacements')
			: null;
		const formationCat = categoryCostData?.data
			? buildCategoryMonthlyFromEntries(categoryCostData.data, 'formation')
			: null;

		const contratsMonthly = sumMonthArrays(remplacementsCat, formationCat);

		result.push({
			id: 'contrats_locaux',
			label: 'Contrats Locaux',
			type: 'parent',
			monthlyAmounts: contratsMonthly,
			annualTotal: null,
		});

		result.push({
			id: 'remplacements',
			label: 'Remplacements',
			type: 'child',
			parentId: 'contrats_locaux',
			monthlyAmounts: remplacementsCat ?? Array(12).fill('0.0000'),
			annualTotal: null,
		});

		result.push({
			id: 'formation',
			label: 'Formation',
			type: 'child',
			parentId: 'contrats_locaux',
			monthlyAmounts: formationCat ?? Array(12).fill('0.0000'),
			annualTotal: null,
		});

		// --- Section 4: Residents ---
		const residentSalairesCat = categoryCostData?.data
			? buildCategoryMonthlyFromEntries(categoryCostData.data, 'resident_salaires')
			: null;
		const residentLogementCat = categoryCostData?.data
			? buildCategoryMonthlyFromEntries(categoryCostData.data, 'resident_logement')
			: null;

		const residentsMonthly = sumMonthArrays(residentSalairesCat, residentLogementCat);

		result.push({
			id: 'residents',
			label: 'Residents',
			type: 'parent',
			monthlyAmounts: residentsMonthly,
			annualTotal: null,
		});

		result.push({
			id: 'resident_salaires',
			label: 'Resident Salaires',
			type: 'child',
			parentId: 'residents',
			monthlyAmounts: residentSalairesCat ?? Array(12).fill('0.0000'),
			annualTotal: null,
		});

		result.push({
			id: 'resident_logement',
			label: 'Resident Logement',
			type: 'child',
			parentId: 'residents',
			monthlyAmounts: residentLogementCat ?? Array(12).fill('0.0000'),
			annualTotal: null,
		});

		// --- Grand Total ---
		const grandTotalMonthly = sumMonthArrays(
			subtotalLocalMonthly,
			contratsMonthly,
			residentsMonthly
		);

		result.push({
			id: 'grand_total',
			label: 'GRAND TOTAL',
			type: 'grandtotal',
			monthlyAmounts: grandTotalMonthly,
			annualTotal: null,
		});

		return result;
	}, [staffCostData, categoryCostData]);

	if (isLoading) {
		return (
			<div className="overflow-x-auto rounded-md border border-(--workspace-border)">
				<table className="w-full border-collapse text-sm">
					<tbody>
						{Array.from({ length: 6 }).map((_, i) => (
							<tr key={i} role="row">
								<td colSpan={14} className="px-3 py-3">
									<div className="h-4 animate-pulse rounded bg-(--workspace-bg-subtle)" />
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		);
	}

	if (rows.length === 0) {
		return (
			<div className="py-6 text-center text-sm text-(--text-muted)">
				No staff cost data available. Run Calculate to generate monthly costs.
			</div>
		);
	}

	const toggleCollapse = (id: string) => {
		setCollapsed((prev) => {
			const next = new Set(prev);
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});
	};

	const visibleRows = rows.filter((row) => {
		if (!row.parentId) return true;
		return !collapsed.has(row.parentId);
	});

	return (
		<div className="space-y-3">
			<div className="flex items-center justify-between">
				<span className="text-(length:--text-xs) font-medium text-(--text-muted)">
					Academic Period:
				</span>
				<ToggleGroup
					type="single"
					value={period}
					onValueChange={(val) => {
						if (val) setPeriod(val as AcademicPeriod);
					}}
					aria-label="Academic period filter"
				>
					<ToggleGroupItem value="full">Full Year</ToggleGroupItem>
					<ToggleGroupItem value="ay1">AY1</ToggleGroupItem>
					<ToggleGroupItem value="ay2">AY2</ToggleGroupItem>
					<ToggleGroupItem value="summer">Summer</ToggleGroupItem>
				</ToggleGroup>
			</div>

			<div className="overflow-x-auto rounded-md border border-(--workspace-border)">
				<TooltipProvider>
					<table
						className="w-full border-collapse text-sm"
						role="grid"
						aria-label="Monthly cost budget"
						aria-readonly="true"
					>
						<thead>
							<tr className="bg-(--workspace-bg-subtle)">
								<th className="sticky left-0 z-10 bg-(--workspace-bg-subtle) px-3 py-2 text-left text-[11px] font-semibold text-(--text-muted) uppercase tracking-[0.12em] min-w-[180px]">
									Category
								</th>
								{MONTH_LABELS.map((m, idx) => {
									if (!visibleMonthIndices.includes(idx)) return null;
									const isSep = idx === SEP_INDEX;
									return (
										<th
											key={m}
											className={cn(
												'px-3 py-2 text-right text-[11px] font-semibold text-(--text-muted) uppercase tracking-[0.12em] min-w-[100px]',
												isSep && 'bg-(--color-warning-bg)/30'
											)}
											aria-description={isSep ? 'New positions start in September' : undefined}
										>
											<span className="inline-flex items-center gap-1">
												{m}
												{isSep && (
													<Tooltip>
														<TooltipTrigger asChild>
															<span
																className="text-(--color-warning) cursor-help"
																aria-label="September indicator"
															>
																&#9650;
															</span>
														</TooltipTrigger>
														<TooltipContent>New positions start September</TooltipContent>
													</Tooltip>
												)}
											</span>
										</th>
									);
								})}
								<th className="px-3 py-2 text-right text-[11px] font-semibold text-(--text-muted) uppercase tracking-[0.12em] min-w-[110px]">
									Annual
								</th>
							</tr>
						</thead>
						<tbody>
							{visibleRows.map((row) => {
								const isParent = row.type === 'parent';
								const isSubtotal = row.type === 'subtotal';
								const isGrandTotal = row.type === 'grandtotal';
								const isChild = row.type === 'child';
								const isCollapsed = collapsed.has(row.id);

								const periodAnnual = sumVisibleMonths(row.monthlyAmounts, visibleMonthIndices);

								return (
									<tr
										key={row.id}
										className={cn(
											'border-t border-(--workspace-border)',
											isGrandTotal && 'bg-(--workspace-bg-muted) border-t-2 font-bold',
											isSubtotal && 'bg-(--workspace-bg-subtle) font-semibold',
											isParent && 'bg-(--workspace-bg-subtle) font-medium',
											isChild && 'hover:bg-(--workspace-bg-subtle)'
										)}
									>
										<td
											className={cn(
												'sticky left-0 z-10 px-3 py-1.5 text-(--text-primary)',
												isGrandTotal && 'bg-(--workspace-bg-muted)',
												isSubtotal && 'bg-(--workspace-bg-subtle)',
												isParent && 'bg-(--workspace-bg-subtle)',
												!isGrandTotal && !isSubtotal && !isParent && 'bg-(--workspace-bg-card)',
												isChild && 'pl-6'
											)}
										>
											{isParent ? (
												<button
													type="button"
													className="flex items-center gap-1 text-left"
													onClick={() => toggleCollapse(row.id)}
													aria-expanded={!isCollapsed}
												>
													<span
														className={cn(
															'inline-flex h-4 w-4 items-center justify-center text-(--text-muted) transition-transform text-xs',
															!isCollapsed && 'rotate-90'
														)}
														aria-hidden="true"
													>
														&#9654;
													</span>
													{row.label}
												</button>
											) : (
												row.label
											)}
										</td>
										{row.monthlyAmounts.map((val, idx) => {
											if (!visibleMonthIndices.includes(idx)) return null;
											const isSep = idx === SEP_INDEX;
											return (
												<td
													key={idx}
													className={cn(
														'px-3 py-1.5 text-right font-mono text-(--text-primary)',
														isGrandTotal && 'text-(--accent-700)',
														isSep && 'bg-(--color-warning-bg)/30'
													)}
												>
													{val === null ? '\u2014' : formatMoney(val, { showCurrency: true })}
												</td>
											);
										})}
										<td
											className={cn(
												'px-3 py-1.5 text-right font-mono text-(--text-primary)',
												isGrandTotal && 'text-(--accent-700)',
												(isSubtotal || isGrandTotal) && 'font-bold'
											)}
										>
											{formatMoney(periodAnnual, { showCurrency: true })}
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</TooltipProvider>
			</div>
		</div>
	);
}

function buildCategoryMonthlyFromEntries(
	entries: { month: number; [key: string]: string | number }[],
	category: string
): string[] {
	const result = Array(12).fill('0.0000') as string[];
	for (const entry of entries) {
		const monthIdx = (entry.month as number) - 1;
		if (monthIdx >= 0 && monthIdx < 12 && entry[category] !== undefined) {
			result[monthIdx] = String(entry[category]);
		}
	}
	return result;
}

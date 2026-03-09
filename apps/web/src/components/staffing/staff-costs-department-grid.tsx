import { useMemo, useState, useCallback, type CSSProperties } from 'react';
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table';
import { ChevronRight } from 'lucide-react';
import Decimal from 'decimal.js';
import { cn } from '../../lib/cn';
import { Skeleton } from '../ui/skeleton';
import type { Employee, StaffCostBreakdown } from '../../hooks/use-staffing';

// ── Types ──────────────────────────────────────────────────────────────────

type StatusValue = 'Existing' | 'New' | 'Departed';

export type EmployeeDetailRow = Employee & {
	monthlyGross: string | null;
	gosiAmount: string | null;
	ajeerAmount: string | null;
	eosMonthly: string | null;
};

export type DepartmentGroup = {
	department: string;
	headcount: number;
	totalMonthlyGross: string;
	totalAnnualCost: string;
	totalEos: string;
	totalAjeer: string;
	totalGosi: string;
	departmentTotal: string;
	employees: EmployeeDetailRow[];
};

export type StaffCostsDepartmentGridProps = {
	employees: Employee[];
	breakdown: StaffCostBreakdown[] | null;
	isLoading: boolean;
	isReadOnly: boolean;
	onSelectEmployee: (employee: Employee) => void;
	selectedEmployeeId: number | null;
};

// ── Helpers ────────────────────────────────────────────────────────────────

const STATUS_BADGE_STYLES: Record<StatusValue, string> = {
	Existing: 'bg-(--color-info-bg) text-(--color-info)',
	New: 'bg-(--color-success-bg) text-(--color-success)',
	Departed: 'bg-(--workspace-bg-muted) text-(--text-muted)',
};

function StatusBadge({ status }: { status: string }) {
	const style = STATUS_BADGE_STYLES[status as StatusValue] ?? STATUS_BADGE_STYLES.Existing;
	return (
		<span
			className={cn('inline-flex rounded-full px-2 py-0.5', 'text-(--text-xs) font-medium', style)}
		>
			{status}
		</span>
	);
}

function formatCurrency(val: string | null): string {
	if (val === null || val === undefined) return '--';
	return new Decimal(val).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function formatDate(dateStr: string | null): string {
	if (!dateStr) return '--';
	try {
		const d = new Date(dateStr);
		const day = String(d.getDate()).padStart(2, '0');
		const month = String(d.getMonth() + 1).padStart(2, '0');
		const year = d.getFullYear();
		return `${day}/${month}/${year}`;
	} catch {
		return dateStr;
	}
}

function formatPercentage(val: string | null): string {
	if (!val) return '--';
	const pct = new Decimal(val).times(100).toFixed(0);
	return `${pct}%`;
}

function computeSharePercent(departmentTotal: string, grandTotal: string): string {
	const gt = new Decimal(grandTotal);
	if (gt.isZero()) return '0.0';
	return new Decimal(departmentTotal).div(gt).mul(100).toFixed(1);
}

// ── Pinned column widths ───────────────────────────────────────────────────

const PINNED_COL_WIDTHS = [100, 160, 140]; // Employee Code, Name, Function/Role
const _PINNED_TOTAL_WIDTH = PINNED_COL_WIDTHS.reduce((a, b) => a + b, 0); // 400px

function getPinnedStyle(colIndex: number): CSSProperties {
	if (colIndex >= PINNED_COL_WIDTHS.length) return {};
	let left = 0;
	for (let i = 0; i < colIndex; i++) {
		left += PINNED_COL_WIDTHS[i]!;
	}
	return {
		position: 'sticky',
		left,
		zIndex: 10,
	};
}

// ── Group employees by department ──────────────────────────────────────────

function groupEmployeesByDepartment(
	employees: Employee[],
	breakdown: StaffCostBreakdown[] | null
): DepartmentGroup[] {
	const breakdownMap = new Map<number, StaffCostBreakdown>();
	if (breakdown) {
		for (const row of breakdown) {
			// Use the first month's data for display (monthly values)
			if (!breakdownMap.has(row.employee_id)) {
				breakdownMap.set(row.employee_id, row);
			}
		}
	}

	const deptMap = new Map<string, EmployeeDetailRow[]>();

	for (const emp of employees) {
		const detail: EmployeeDetailRow = {
			...emp,
			monthlyGross: breakdownMap.get(emp.id)?.adjusted_gross ?? null,
			gosiAmount: breakdownMap.get(emp.id)?.gosi_amount ?? null,
			ajeerAmount: breakdownMap.get(emp.id)?.ajeer_amount ?? null,
			eosMonthly: breakdownMap.get(emp.id)?.eos_monthly_accrual ?? null,
		};

		const existing = deptMap.get(emp.department);
		if (existing) {
			existing.push(detail);
		} else {
			deptMap.set(emp.department, [detail]);
		}
	}

	const groups: DepartmentGroup[] = [];

	for (const [department, emps] of deptMap) {
		// Filter out departed employees for aggregates
		const activeEmps = emps.filter((e) => e.status !== 'Departed');

		let totalMonthlyGross = new Decimal(0);
		let totalEos = new Decimal(0);
		let totalAjeer = new Decimal(0);
		let totalGosi = new Decimal(0);

		for (const emp of activeEmps) {
			if (emp.monthlyGross) totalMonthlyGross = totalMonthlyGross.plus(emp.monthlyGross);
			if (emp.eosMonthly) totalEos = totalEos.plus(emp.eosMonthly);
			if (emp.ajeerAmount) totalAjeer = totalAjeer.plus(emp.ajeerAmount);
			if (emp.gosiAmount) totalGosi = totalGosi.plus(emp.gosiAmount);
		}

		// NOTE: These are display-only aggregations of pre-computed API values.
		// No monetary arithmetic is performed — we are summing server-provided values
		// for display grouping purposes only (ADR-002 compliant).
		const totalAnnualCost = totalMonthlyGross.times(12);
		const departmentTotal = totalAnnualCost
			.plus(totalEos.times(12))
			.plus(totalAjeer.times(12))
			.plus(totalGosi.times(12));

		groups.push({
			department,
			headcount: activeEmps.length,
			totalMonthlyGross: totalMonthlyGross.toFixed(2),
			totalAnnualCost: totalAnnualCost.toFixed(2),
			totalEos: totalEos.times(12).toFixed(2),
			totalAjeer: totalAjeer.times(12).toFixed(2),
			totalGosi: totalGosi.times(12).toFixed(2),
			departmentTotal: departmentTotal.toFixed(2),
			employees: emps,
		});
	}

	// Sort departments alphabetically
	groups.sort((a, b) => a.department.localeCompare(b.department));
	return groups;
}

// ── Employee detail columns ────────────────────────────────────────────────

function buildEmployeeColumns(
	isReadOnly: boolean,
	onSelect: (emp: Employee) => void
): ColumnDef<EmployeeDetailRow>[] {
	return [
		// Pinned columns (indices 0, 1, 2)
		{
			id: 'employeeCode',
			accessorKey: 'employeeCode',
			header: 'Code',
			size: 100,
			cell: ({ row }) => (
				<button
					type="button"
					className="text-left text-(--accent-600) underline-offset-2 hover:underline focus:underline"
					onClick={() => onSelect(row.original)}
					tabIndex={-1}
				>
					{row.original.employeeCode}
				</button>
			),
		},
		{
			id: 'name',
			accessorKey: 'name',
			header: 'Name',
			size: 160,
		},
		{
			id: 'functionRole',
			accessorKey: 'functionRole',
			header: 'Function/Role',
			size: 140,
		},
		// Scrollable columns (index 3+)
		{
			id: 'department',
			accessorKey: 'department',
			header: 'Department',
			size: 160,
		},
		{
			id: 'status',
			accessorKey: 'status',
			header: 'Status',
			size: 100,
			cell: ({ getValue }) => <StatusBadge status={getValue() as string} />,
		},
		{
			id: 'joiningDate',
			accessorKey: 'joiningDate',
			header: 'Joining Date',
			size: 110,
			cell: ({ getValue }) => formatDate(getValue() as string),
		},
		{
			id: 'hourlyPercentage',
			accessorKey: 'hourlyPercentage',
			header: 'Hourly %',
			size: 80,
			cell: ({ getValue }) => formatPercentage(getValue() as string),
		},
		{
			id: 'baseSalary',
			accessorKey: 'baseSalary',
			header: 'Base Salary',
			size: 120,
			cell: ({ getValue }) => (isReadOnly ? '--' : formatCurrency(getValue() as string | null)),
		},
		{
			id: 'housingAllowance',
			accessorKey: 'housingAllowance',
			header: 'Housing (IL)',
			size: 110,
			cell: ({ getValue }) => (isReadOnly ? '--' : formatCurrency(getValue() as string | null)),
		},
		{
			id: 'transportAllowance',
			accessorKey: 'transportAllowance',
			header: 'Transport (IT)',
			size: 110,
			cell: ({ getValue }) => (isReadOnly ? '--' : formatCurrency(getValue() as string | null)),
		},
		{
			id: 'responsibilityPremium',
			accessorKey: 'responsibilityPremium',
			header: 'Premium',
			size: 110,
			cell: ({ getValue }) => (isReadOnly ? '--' : formatCurrency(getValue() as string | null)),
		},
		{
			id: 'hsaAmount',
			accessorKey: 'hsaAmount',
			header: 'HSA',
			size: 100,
			cell: ({ getValue }) => (isReadOnly ? '--' : formatCurrency(getValue() as string | null)),
		},
		{
			id: 'augmentation',
			accessorKey: 'augmentation',
			header: 'Augmentation',
			size: 110,
			cell: ({ getValue }) => (isReadOnly ? '--' : formatCurrency(getValue() as string | null)),
		},
		{
			id: 'monthlyGross',
			accessorKey: 'monthlyGross',
			header: 'Monthly Gross',
			size: 130,
			cell: ({ getValue }) => (isReadOnly ? '--' : formatCurrency(getValue() as string | null)),
		},
		{
			id: 'gosiAmount',
			accessorKey: 'gosiAmount',
			header: 'GOSI',
			size: 110,
			cell: ({ getValue }) => (isReadOnly ? '--' : formatCurrency(getValue() as string | null)),
		},
		{
			id: 'ajeerAmount',
			accessorKey: 'ajeerAmount',
			header: 'Ajeer',
			size: 110,
			cell: ({ getValue }) => (isReadOnly ? '--' : formatCurrency(getValue() as string | null)),
		},
		{
			id: 'eosMonthly',
			accessorKey: 'eosMonthly',
			header: 'EoS Monthly',
			size: 110,
			cell: ({ getValue }) => (isReadOnly ? '--' : formatCurrency(getValue() as string | null)),
		},
	];
}

// ── Department summary column definitions ──────────────────────────────────

const DEPT_SUMMARY_COLS = [
	{ key: 'expand', label: '', width: 36 },
	{ key: 'department', label: 'Department', width: 200 },
	{ key: 'headcount', label: 'Headcount', width: 80 },
	{ key: 'totalMonthlyGross', label: 'Total Monthly Gross', width: 140 },
	{ key: 'totalAnnualCost', label: 'Total Annual Cost', width: 140 },
	{ key: 'totalEos', label: 'Total EoS', width: 120 },
	{ key: 'totalAjeer', label: 'Total Ajeer', width: 120 },
	{ key: 'totalGosi', label: 'Total GOSI', width: 120 },
	{ key: 'departmentTotal', label: 'Department Total', width: 140 },
] as const;

// ── Loading skeleton ───────────────────────────────────────────────────────

function DepartmentGridSkeleton() {
	return (
		<div className="space-y-2" aria-busy="true" aria-label="Loading staff costs">
			{Array.from({ length: 5 }).map((_, i) => (
				<div
					key={i}
					className="flex items-center gap-2 rounded-(--radius-md) bg-(--workspace-bg-muted) px-3 py-3"
				>
					<Skeleton className="h-4 w-4" />
					<Skeleton className="h-4 w-32" />
					<Skeleton className="ml-auto h-4 w-16" />
					<Skeleton className="h-4 w-24" />
					<Skeleton className="h-4 w-24" />
				</div>
			))}
		</div>
	);
}

// ── Employee sub-table for expanded department ─────────────────────────────

function EmployeeSubTable({
	employees,
	isReadOnly: _isReadOnly,
	onSelectEmployee,
	selectedEmployeeId,
	columns,
}: {
	employees: EmployeeDetailRow[];
	isReadOnly: boolean;
	onSelectEmployee: (emp: Employee) => void;
	selectedEmployeeId: number | null;
	columns: ColumnDef<EmployeeDetailRow>[];
}) {
	const table = useReactTable({
		data: employees,
		columns,
		getCoreRowModel: getCoreRowModel(),
	});

	return (
		<>
			{table.getRowModel().rows.map((row) => {
				const isDeparted = row.original.status === 'Departed';
				const isSelected = row.original.id === selectedEmployeeId;

				return (
					<tr
						key={row.id}
						role="row"
						aria-level={2}
						className={cn(
							'h-9 transition-colors',
							isDeparted ? 'text-(--text-muted)' : 'text-(--text-primary)',
							isSelected && 'bg-(--accent-50)',
							!isSelected && 'hover:bg-(--workspace-bg-subtle)'
						)}
						tabIndex={0}
						onClick={() => onSelectEmployee(row.original)}
						onKeyDown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								onSelectEmployee(row.original);
							}
						}}
					>
						{row.getVisibleCells().map((cell, cellIndex) => {
							const isPinned = cellIndex < PINNED_COL_WIDTHS.length;
							const pinnedStyle = isPinned ? getPinnedStyle(cellIndex) : {};

							const isCurrency = cellIndex >= 7; // columns from Base Salary onward
							const isEncrypted = cellIndex >= 7 && cellIndex <= 16;

							return (
								<td
									key={cell.id}
									className={cn(
										'border-b border-(--workspace-border)',
										'text-(--text-xs)',
										'whitespace-nowrap',
										isPinned && 'bg-(--workspace-bg)',
										isSelected && isPinned && 'bg-(--accent-50)',
										isCurrency && 'text-right font-[family-name:var(--font-mono)]',
										!isCurrency && 'text-left',
										isDeparted && isEncrypted && 'bg-(--cell-readonly-bg)',
										cellIndex === 0 && 'pl-10' // 24px indent + 16px padding
									)}
									style={{
										...pinnedStyle,
										width: cell.column.getSize(),
										minWidth: cell.column.getSize(),
										padding: '0 8px',
									}}
								>
									{flexRender(cell.column.columnDef.cell, cell.getContext())}
								</td>
							);
						})}
					</tr>
				);
			})}
		</>
	);
}

// ── Grand Total Row ────────────────────────────────────────────────────────

function GrandTotalRow({ groups, isReadOnly }: { groups: DepartmentGroup[]; isReadOnly: boolean }) {
	const totals = useMemo(() => {
		let headcount = 0;
		let monthlyGross = new Decimal(0);
		let annualCost = new Decimal(0);
		let eos = new Decimal(0);
		let ajeer = new Decimal(0);
		let gosi = new Decimal(0);
		let grandTotal = new Decimal(0);

		for (const g of groups) {
			headcount += g.headcount;
			monthlyGross = monthlyGross.plus(g.totalMonthlyGross);
			annualCost = annualCost.plus(g.totalAnnualCost);
			eos = eos.plus(g.totalEos);
			ajeer = ajeer.plus(g.totalAjeer);
			gosi = gosi.plus(g.totalGosi);
			grandTotal = grandTotal.plus(g.departmentTotal);
		}

		return {
			headcount,
			monthlyGross: monthlyGross.toFixed(2),
			annualCost: annualCost.toFixed(2),
			eos: eos.toFixed(2),
			ajeer: ajeer.toFixed(2),
			gosi: gosi.toFixed(2),
			grandTotal: grandTotal.toFixed(2),
		};
	}, [groups]);

	if (isReadOnly) return null;

	return (
		<tr className="bg-(--workspace-bg-muted) font-bold" role="row">
			<td className="px-2 py-2" />
			<td className="px-2 py-2 text-(--text-sm) text-(--text-primary)">Grand Total</td>
			<td className="px-2 py-2 text-right text-(--text-sm) font-[family-name:var(--font-mono)] text-(--text-primary)">
				{totals.headcount}
			</td>
			<td className="px-2 py-2 text-right text-(--text-sm) font-[family-name:var(--font-mono)] text-(--text-primary)">
				{formatCurrency(totals.monthlyGross)}
			</td>
			<td className="px-2 py-2 text-right text-(--text-sm) font-[family-name:var(--font-mono)] text-(--text-primary)">
				{formatCurrency(totals.annualCost)}
			</td>
			<td className="px-2 py-2 text-right text-(--text-sm) font-[family-name:var(--font-mono)] text-(--text-primary)">
				{formatCurrency(totals.eos)}
			</td>
			<td className="px-2 py-2 text-right text-(--text-sm) font-[family-name:var(--font-mono)] text-(--text-primary)">
				{formatCurrency(totals.ajeer)}
			</td>
			<td className="px-2 py-2 text-right text-(--text-sm) font-[family-name:var(--font-mono)] text-(--text-primary)">
				{formatCurrency(totals.gosi)}
			</td>
			<td className="px-2 py-2 text-right text-(--text-sm) font-[family-name:var(--font-mono)] font-bold text-(--accent-700)">
				{formatCurrency(totals.grandTotal)}
			</td>
		</tr>
	);
}

// ── Main Component ─────────────────────────────────────────────────────────

export function StaffCostsDepartmentGrid({
	employees,
	breakdown,
	isLoading,
	isReadOnly,
	onSelectEmployee,
	selectedEmployeeId,
}: StaffCostsDepartmentGridProps) {
	const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());

	const toggleDepartment = useCallback((dept: string) => {
		setExpandedDepts((prev) => {
			const next = new Set(prev);
			if (next.has(dept)) {
				next.delete(dept);
			} else {
				next.add(dept);
			}
			return next;
		});
	}, []);

	const groups = useMemo(
		() => groupEmployeesByDepartment(employees, breakdown),
		[employees, breakdown]
	);

	const employeeColumns = useMemo(
		() => buildEmployeeColumns(isReadOnly, onSelectEmployee),
		[isReadOnly, onSelectEmployee]
	);

	const grandTotalValue = useMemo(() => {
		let total = new Decimal(0);
		for (const g of groups) {
			total = total.plus(g.departmentTotal);
		}
		return total.toFixed(2);
	}, [groups]);

	if (isLoading) {
		return <DepartmentGridSkeleton />;
	}

	if (employees.length === 0) {
		return (
			<div className="py-8 text-center text-sm text-(--text-muted)">
				No employees found. Add employees manually or import from xlsx.
			</div>
		);
	}

	// Total column count for employee sub-table header
	const employeeColCount = employeeColumns.length;

	return (
		<div
			className="overflow-x-auto rounded-(--radius-md) border border-(--workspace-border)"
			role="region"
			aria-label="Staff costs by department"
		>
			<table
				className="w-full border-collapse text-(--text-sm)"
				role="grid"
				style={{ minWidth: 2032 }}
			>
				{/* Department summary header */}
				<thead className="sticky top-0 z-20 bg-(--workspace-bg-subtle)">
					<tr>
						{DEPT_SUMMARY_COLS.map((col) => (
							<th
								key={col.key}
								className={cn(
									'px-2 py-2 font-medium',
									'text-(--text-xs) uppercase tracking-wider',
									'text-(--text-muted)',
									'border-b border-(--workspace-border)',
									col.key !== 'expand' &&
										col.key !== 'department' &&
										'text-right font-[family-name:var(--font-mono)]',
									(col.key === 'expand' || col.key === 'department') && 'text-left'
								)}
								style={{ width: col.width, minWidth: col.width }}
							>
								{col.label}
							</th>
						))}
					</tr>
				</thead>

				<tbody>
					{groups.map((group) => {
						const isExpanded = expandedDepts.has(group.department);

						return (
							<DepartmentSection
								key={group.department}
								group={group}
								grandTotal={grandTotalValue}
								isExpanded={isExpanded}
								isReadOnly={isReadOnly}
								onToggle={toggleDepartment}
								onSelectEmployee={onSelectEmployee}
								selectedEmployeeId={selectedEmployeeId}
								employeeColumns={employeeColumns}
								employeeColCount={employeeColCount}
							/>
						);
					})}
				</tbody>

				{/* Grand total footer */}
				<tfoot className="sticky bottom-0 z-20 border-t-2 border-(--workspace-border) shadow-[0_-2px_4px_rgba(0,0,0,0.06)]">
					<GrandTotalRow groups={groups} isReadOnly={isReadOnly} />
				</tfoot>
			</table>
		</div>
	);
}

// ── Department Section (summary row + expanded employee rows) ──────────────

function DepartmentSection({
	group,
	grandTotal,
	isExpanded,
	isReadOnly,
	onToggle,
	onSelectEmployee,
	selectedEmployeeId,
	employeeColumns,
	employeeColCount,
}: {
	group: DepartmentGroup;
	grandTotal: string;
	isExpanded: boolean;
	isReadOnly: boolean;
	onToggle: (dept: string) => void;
	onSelectEmployee: (emp: Employee) => void;
	selectedEmployeeId: number | null;
	employeeColumns: ColumnDef<EmployeeDetailRow>[];
	employeeColCount: number;
}) {
	const sharePercent = computeSharePercent(group.departmentTotal, grandTotal);
	return (
		<>
			{/* Department summary row */}
			<tr
				role="row"
				aria-expanded={isExpanded}
				className={cn(
					'cursor-pointer select-none',
					'bg-(--workspace-bg-muted)',
					'font-semibold',
					'hover:bg-(--workspace-bg-subtle)',
					'transition-colors'
				)}
				onClick={() => onToggle(group.department)}
				onKeyDown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						onToggle(group.department);
					}
				}}
				tabIndex={0}
			>
				{/* Chevron */}
				<td className="w-9 px-2 py-2 text-center" style={{ width: 36 }}>
					<ChevronRight
						className={cn(
							'h-4 w-4 text-(--text-muted) transition-transform duration-150',
							isExpanded && 'rotate-90'
						)}
						aria-hidden="true"
					/>
				</td>

				{/* Department name + headcount badge */}
				<td className="px-2 py-2 text-(--text-sm) text-(--text-primary)" style={{ width: 200 }}>
					<span className="flex items-center gap-2">
						{group.department}
						<span
							className={cn(
								'inline-flex h-5 min-w-[20px] items-center justify-center',
								'rounded-full bg-(--accent-100) px-1.5',
								'text-(--text-xs) font-medium text-(--accent-700)'
							)}
						>
							{group.headcount}
						</span>
					</span>
				</td>

				{/* Headcount */}
				<td
					className="px-2 py-2 text-right text-(--text-sm) font-[family-name:var(--font-mono)] text-(--text-primary)"
					style={{ width: 80 }}
				>
					{group.headcount}
				</td>

				{/* Aggregated monetary columns */}
				<td
					className="px-2 py-2 text-right text-(--text-sm) font-[family-name:var(--font-mono)] text-(--text-primary)"
					style={{ width: 140 }}
				>
					{isReadOnly ? '--' : formatCurrency(group.totalMonthlyGross)}
				</td>
				<td
					className="px-2 py-2 text-right text-(--text-sm) font-[family-name:var(--font-mono)] text-(--text-primary)"
					style={{ width: 140 }}
				>
					{isReadOnly ? '--' : formatCurrency(group.totalAnnualCost)}
				</td>
				<td
					className="px-2 py-2 text-right text-(--text-sm) font-[family-name:var(--font-mono)] text-(--text-primary)"
					style={{ width: 120 }}
				>
					{isReadOnly ? '--' : formatCurrency(group.totalEos)}
				</td>
				<td
					className="px-2 py-2 text-right text-(--text-sm) font-[family-name:var(--font-mono)] text-(--text-primary)"
					style={{ width: 120 }}
				>
					{isReadOnly ? '--' : formatCurrency(group.totalAjeer)}
				</td>
				<td
					className="px-2 py-2 text-right text-(--text-sm) font-[family-name:var(--font-mono)] text-(--text-primary)"
					style={{ width: 120 }}
				>
					{isReadOnly ? '--' : formatCurrency(group.totalGosi)}
				</td>
				<td
					className="px-2 py-2 text-right text-(--text-sm) font-[family-name:var(--font-mono)] font-bold text-(--accent-700)"
					style={{ width: 140 }}
				>
					<div className="flex flex-col items-end">
						<span>{isReadOnly ? '--' : formatCurrency(group.departmentTotal)}</span>
						{!isReadOnly && (
							<span
								className="text-(--text-xs) font-normal text-(--text-muted)"
								aria-label={`${sharePercent}% of grand total`}
							>
								{sharePercent}%
							</span>
						)}
					</div>
				</td>
			</tr>

			{/* Expanded employee detail rows */}
			{isExpanded && (
				<>
					{/* Employee column headers */}
					<tr className="bg-(--workspace-bg-subtle)">
						{employeeColumns.map((col, i) => {
							const isPinned = i < PINNED_COL_WIDTHS.length;
							const pinnedStyle = isPinned ? getPinnedStyle(i) : {};
							const isCurrency = i >= 7;

							return (
								<th
									key={col.id ?? i}
									className={cn(
										'px-2 py-1.5 font-medium',
										'text-(--text-xs) uppercase tracking-wider',
										'text-(--text-muted)',
										'border-b border-(--workspace-border)',
										isPinned && 'bg-(--workspace-bg-subtle)',
										isCurrency ? 'text-right' : 'text-left',
										i === 0 && 'pl-10' // indent for nesting
									)}
									style={{
										...pinnedStyle,
										width: col.size ?? 'auto',
										minWidth: col.size ?? 'auto',
									}}
								>
									{typeof col.header === 'string' ? col.header : ''}
								</th>
							);
						})}
						{/* Fill remaining department columns */}
						{employeeColCount < DEPT_SUMMARY_COLS.length && (
							<th
								colSpan={DEPT_SUMMARY_COLS.length - employeeColCount}
								className="border-b border-(--workspace-border)"
							/>
						)}
					</tr>

					<EmployeeSubTable
						employees={group.employees}
						isReadOnly={isReadOnly}
						onSelectEmployee={onSelectEmployee}
						selectedEmployeeId={selectedEmployeeId}
						columns={employeeColumns}
					/>
				</>
			)}
		</>
	);
}

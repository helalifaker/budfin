import { useMemo, useState, useCallback, useRef } from 'react';
import Decimal from 'decimal.js';
import { cn } from '../../lib/cn';
import { formatMoney } from '../../lib/format-money';
import { buildSupportGridRows } from '../../lib/staffing-workspace';
import type { Employee } from '../../hooks/use-staffing';
import type { StaffingEditability, SupportDepartmentGroup } from '../../lib/staffing-workspace';
import { format, parseISO } from 'date-fns';

// ── Props ───────────────────────────────────────────────────────────────────

export type SupportAdminGridProps = {
	employees: Employee[];
	editability: StaffingEditability;
	onEmployeeSelect: (employee: Employee) => void;
	onEmployeeDoubleClick: (employee: Employee) => void;
};

// ── Status Badge ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
	const color =
		status === 'Existing'
			? 'bg-(--color-info-bg) text-(--color-info)'
			: status === 'New'
				? 'bg-(--color-success-bg) text-(--color-success)'
				: 'bg-(--workspace-bg-muted) text-(--text-muted)';
	return (
		<span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', color)}>
			{status}
		</span>
	);
}

// ── Date formatter ──────────────────────────────────────────────────────────

function formatDate(dateStr: string | null): string {
	if (!dateStr) return '\u2014';
	try {
		return format(parseISO(dateStr), 'dd MMM yyyy');
	} catch {
		return '\u2014';
	}
}

// ── Name cell renderer ──────────────────────────────────────────────────────

function NameCell({ employee }: { employee: Employee }) {
	if (employee.recordType === 'VACANCY') {
		return <span className="italic text-(--text-muted)">Vacancy: {employee.functionRole}</span>;
	}
	return <span>{employee.name}</span>;
}

// ── Main Grid ───────────────────────────────────────────────────────────────

export function SupportAdminGrid({
	employees,
	editability,
	onEmployeeSelect,
	onEmployeeDoubleClick,
}: SupportAdminGridProps) {
	const [expandedDepartments, setExpandedDepartments] = useState<Set<string>>(new Set());
	const liveRegionRef = useRef<HTMLDivElement>(null);

	const groups = useMemo(() => buildSupportGridRows(employees), [employees]);

	const grandTotalAnnual = useMemo(() => {
		let total = new Decimal(0);
		for (const g of groups) {
			total = total.plus(new Decimal(g.subtotalAnnualCost));
		}
		return total.toNumber();
	}, [groups]);

	const announce = useCallback((message: string) => {
		if (liveRegionRef.current) {
			liveRegionRef.current.textContent = message;
		}
	}, []);

	const toggleDepartment = useCallback(
		(department: string, group: SupportDepartmentGroup) => {
			setExpandedDepartments((prev) => {
				const next = new Set(prev);
				if (next.has(department)) {
					next.delete(department);
					announce(`${department} collapsed`);
				} else {
					next.add(department);
					announce(`${department} expanded, ${group.employeeCount} employees`);
				}
				return next;
			});
		},
		[announce]
	);

	const handleDepartmentKeyDown = useCallback(
		(e: React.KeyboardEvent, group: SupportDepartmentGroup) => {
			const isExpanded = expandedDepartments.has(group.department);

			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				toggleDepartment(group.department, group);
			} else if (e.key === 'ArrowRight' && !isExpanded) {
				e.preventDefault();
				setExpandedDepartments((prev) => {
					const next = new Set(prev);
					next.add(group.department);
					announce(`${group.department} expanded, ${group.employeeCount} employees`);
					return next;
				});
			} else if (e.key === 'ArrowLeft' && isExpanded) {
				e.preventDefault();
				setExpandedDepartments((prev) => {
					const next = new Set(prev);
					next.delete(group.department);
					announce(`${group.department} collapsed`);
					return next;
				});
			}
		},
		[expandedDepartments, toggleDepartment, announce]
	);

	const handleRowClick = useCallback(
		(employee: Employee) => {
			onEmployeeSelect(employee);
		},
		[onEmployeeSelect]
	);

	const handleRowDoubleClick = useCallback(
		(employee: Employee) => {
			if (editability === 'editable') {
				onEmployeeDoubleClick(employee);
			}
		},
		[editability, onEmployeeDoubleClick]
	);

	const totalEmployees = groups.reduce((sum, g) => sum + g.employeeCount, 0);

	return (
		<div className="space-y-0">
			{/* Screen reader live region */}
			<div ref={liveRegionRef} aria-live="polite" aria-atomic="true" className="sr-only" />

			<div className={cn('overflow-x-auto rounded-md', 'border border-(--workspace-border)')}>
				<table
					className="w-full border-collapse text-sm"
					role="table"
					aria-label="Support and admin employees"
					aria-rowcount={totalEmployees + groups.length + 2}
					aria-colcount={8}
				>
					<thead>
						<tr className="bg-(--workspace-bg-subtle)">
							<th
								className={cn(
									'w-9 px-2 py-2 text-left font-medium',
									'text-(--text-muted)',
									'text-xs uppercase tracking-wider',
									'border-b border-(--workspace-border)'
								)}
								aria-label="Expand or collapse"
							/>
							<th
								className={cn(
									'px-3 py-2 text-left font-medium text-(--text-muted)',
									'text-xs uppercase tracking-wider',
									'border-b border-(--workspace-border)'
								)}
								style={{ width: 200 }}
							>
								Name / Position
							</th>
							<th
								className={cn(
									'px-3 py-2 text-left font-medium text-(--text-muted)',
									'text-xs uppercase tracking-wider',
									'border-b border-(--workspace-border)'
								)}
								style={{ width: 150 }}
							>
								Role
							</th>
							<th
								className={cn(
									'px-3 py-2 text-center font-medium text-(--text-muted)',
									'text-xs uppercase tracking-wider',
									'border-b border-(--workspace-border)'
								)}
								style={{ width: 90 }}
							>
								Status
							</th>
							<th
								className={cn(
									'px-3 py-2 text-right font-medium text-(--text-muted)',
									'text-xs uppercase tracking-wider',
									'border-b border-(--workspace-border)'
								)}
								style={{ width: 60 }}
							>
								FTE
							</th>
							<th
								className={cn(
									'px-3 py-2 text-center font-medium text-(--text-muted)',
									'text-xs uppercase tracking-wider',
									'border-b border-(--workspace-border)'
								)}
								style={{ width: 90 }}
							>
								Start
							</th>
							<th
								className={cn(
									'px-3 py-2 text-center font-medium text-(--text-muted)',
									'text-xs uppercase tracking-wider',
									'border-b border-(--workspace-border)'
								)}
								style={{ width: 90 }}
							>
								End
							</th>
							<th
								className={cn(
									'px-3 py-2 text-right font-medium text-(--text-muted)',
									'text-xs uppercase tracking-wider',
									'border-b border-(--workspace-border)'
								)}
								style={{ width: 100 }}
							>
								Monthly
							</th>
							<th
								className={cn(
									'px-3 py-2 text-right font-medium text-(--text-muted)',
									'text-xs uppercase tracking-wider',
									'border-b border-(--workspace-border)'
								)}
								style={{ width: 110 }}
							>
								Annual
							</th>
						</tr>
					</thead>
					<tbody>
						{groups.length === 0 ? (
							<tr>
								<td colSpan={9} className="px-3 py-8 text-center text-(--text-muted)">
									No support or admin employees found.
								</td>
							</tr>
						) : (
							<>
								{groups.map((group) => {
									const isExpanded = expandedDepartments.has(group.department);
									return (
										<DepartmentSection
											key={group.department}
											group={group}
											isExpanded={isExpanded}
											editability={editability}
											onToggle={() => toggleDepartment(group.department, group)}
											onKeyDown={(e) => handleDepartmentKeyDown(e, group)}
											onRowClick={handleRowClick}
											onRowDoubleClick={handleRowDoubleClick}
										/>
									);
								})}
								{/* Grand Total Row */}
								<tr
									className={cn(
										'bg-(--workspace-bg-subtle)',
										'font-semibold border-t-2 border-(--workspace-border)'
									)}
								>
									<td className="w-9 px-2 py-2 border-b border-(--workspace-border)" />
									<td
										colSpan={7}
										className="px-3 py-2 text-(--text-primary) border-b border-(--workspace-border)"
									>
										TOTAL
									</td>
									<td
										className={cn(
											'px-3 py-2 text-right font-bold',
											'font-mono tabular-nums',
											'text-(--text-primary)',
											'border-b border-(--workspace-border)'
										)}
									>
										{formatMoney(grandTotalAnnual, {
											showCurrency: true,
											compact: true,
										})}
									</td>
								</tr>
							</>
						)}
					</tbody>
				</table>
			</div>
		</div>
	);
}

// ── Department Section (avoid re-renders across groups) ─────────────────────

type DepartmentSectionProps = {
	group: SupportDepartmentGroup;
	isExpanded: boolean;
	editability: StaffingEditability;
	onToggle: () => void;
	onKeyDown: (e: React.KeyboardEvent) => void;
	onRowClick: (employee: Employee) => void;
	onRowDoubleClick: (employee: Employee) => void;
};

function DepartmentSection({
	group,
	isExpanded,
	editability,
	onToggle,
	onKeyDown,
	onRowClick,
	onRowDoubleClick,
}: DepartmentSectionProps) {
	return (
		<>
			{/* Department group header */}
			<tr
				className={cn(
					'cursor-pointer select-none bg-(--workspace-bg-muted)',
					'hover:bg-(--workspace-bg-subtle)',
					'transition-colors'
				)}
				role="row"
				aria-expanded={isExpanded}
				tabIndex={0}
				onClick={onToggle}
				onKeyDown={onKeyDown}
				data-department={group.department}
			>
				<td className="w-9 px-2 py-2 border-b border-(--workspace-border)">
					<span
						className={cn(
							'inline-flex h-5 w-5 items-center justify-center',
							'text-(--text-muted) transition-transform',
							isExpanded && 'rotate-90'
						)}
						aria-hidden="true"
					>
						&#9654;
					</span>
				</td>
				<td
					colSpan={6}
					className={cn(
						'px-3 py-2 font-semibold text-(--text-primary)',
						'border-b border-(--workspace-border)'
					)}
				>
					{group.department}
					<span
						className={cn(
							'ml-2 inline-flex items-center rounded-full',
							'bg-(--accent-50) px-2 py-0.5',
							'text-xs font-medium text-(--accent-700)'
						)}
					>
						{group.employeeCount}
					</span>
				</td>
				<td
					colSpan={2}
					className={cn(
						'px-3 py-2 text-right font-mono tabular-nums',
						'text-(--text-primary) font-semibold',
						'border-b border-(--workspace-border)'
					)}
				>
					{formatMoney(group.subtotalAnnualCost, {
						showCurrency: true,
						compact: true,
					})}
				</td>
			</tr>

			{/* Employee detail rows */}
			{isExpanded &&
				group.employees.map((emp) => (
					<EmployeeRow
						key={emp.id}
						employee={emp}
						editability={editability}
						onClick={() => onRowClick(emp)}
						onDoubleClick={() => onRowDoubleClick(emp)}
					/>
				))}
		</>
	);
}

// ── Employee Row ────────────────────────────────────────────────────────────

type EmployeeRowProps = {
	employee: Employee;
	editability: StaffingEditability;
	onClick: () => void;
	onDoubleClick: () => void;
};

function EmployeeRow({ employee, onClick, onDoubleClick }: EmployeeRowProps) {
	return (
		<tr
			className={cn('cursor-pointer transition-colors', 'hover:bg-(--workspace-bg-subtle)')}
			role="row"
			aria-level={2}
			tabIndex={0}
			onClick={onClick}
			onDoubleClick={onDoubleClick}
			onKeyDown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					onClick();
				}
			}}
		>
			<td className="w-9 border-b border-(--workspace-border)" />
			<td
				className={cn(
					'px-3 py-2 pl-6 text-(--text-primary)',
					'border-b border-(--workspace-border)'
				)}
				style={{ width: 200 }}
			>
				<NameCell employee={employee} />
			</td>
			<td
				className={cn('px-3 py-2 text-(--text-primary)', 'border-b border-(--workspace-border)')}
				style={{ width: 150 }}
			>
				{employee.functionRole}
			</td>
			<td
				className={cn('px-3 py-2 text-center', 'border-b border-(--workspace-border)')}
				style={{ width: 90 }}
			>
				<StatusBadge status={employee.status} />
			</td>
			<td
				className={cn(
					'px-3 py-2 text-right font-mono tabular-nums',
					'text-(--text-primary)',
					'border-b border-(--workspace-border)'
				)}
				style={{ width: 60 }}
			>
				{parseFloat(employee.hourlyPercentage).toFixed(2)}
			</td>
			<td
				className={cn(
					'px-3 py-2 text-center',
					'text-(--text-primary)',
					'border-b border-(--workspace-border)'
				)}
				style={{ width: 90 }}
			>
				{formatDate(employee.joiningDate)}
			</td>
			<td
				className={cn(
					'px-3 py-2 text-center',
					'text-(--text-primary)',
					'border-b border-(--workspace-border)'
				)}
				style={{ width: 90 }}
			>
				{formatDate(employee.contractEndDate)}
			</td>
			<td
				className={cn(
					'px-3 py-2 text-right font-mono tabular-nums',
					'text-(--text-primary)',
					'border-b border-(--workspace-border)'
				)}
				style={{ width: 100 }}
			>
				{employee.monthlyCost
					? formatMoney(employee.monthlyCost, { showCurrency: true, compact: true })
					: '\u2014'}
			</td>
			<td
				className={cn(
					'px-3 py-2 text-right font-mono tabular-nums font-semibold',
					'text-(--text-primary)',
					'border-b border-(--workspace-border)'
				)}
				style={{ width: 110 }}
			>
				{employee.annualCost
					? formatMoney(employee.annualCost, { showCurrency: true, compact: true })
					: '\u2014'}
			</td>
		</tr>
	);
}

import { useCallback, useMemo, useState } from 'react';
import {
	createColumnHelper,
	flexRender,
	getCoreRowModel,
	useReactTable,
} from '@tanstack/react-table';
import { cn } from '../../lib/cn';
import { formatDate, getCurrentFiscalYear } from '../../lib/format-date';
import { useAuthStore } from '../../stores/auth-store';
import { useFiscalPeriods, useLockFiscalPeriod } from '../../hooks/use-fiscal-periods';
import type { FiscalPeriod } from '../../hooks/use-fiscal-periods';
import { useVersions } from '../../hooks/use-versions';
import type { BudgetVersion } from '../../hooks/use-versions';

const columnHelper = createColumnHelper<FiscalPeriod>();

const MONTH_NAMES = [
	'January',
	'February',
	'March',
	'April',
	'May',
	'June',
	'July',
	'August',
	'September',
	'October',
	'November',
	'December',
] as const;

const STATUS_BADGE_COLORS: Record<string, string> = {
	Draft: 'bg-slate-100 text-slate-700',
	Locked: 'bg-violet-100 text-violet-800',
};

const CURRENT_FISCAL_YEAR = getCurrentFiscalYear();

export function FiscalPeriodsPage() {
	const currentUser = useAuthStore((s) => s.user);
	const canLock = currentUser?.role === 'Admin' || currentUser?.role === 'BudgetOwner';

	const [fiscalYear, setFiscalYear] = useState<number>(CURRENT_FISCAL_YEAR);

	const { data: periods, isLoading } = useFiscalPeriods(fiscalYear);

	// Fetch Actual versions in Locked status for the version selector dropdown
	const { data: versionsData } = useVersions(fiscalYear, 'Locked');
	const lockedActualVersions = useMemo(() => {
		const allVersions = versionsData?.data ?? [];
		return allVersions.filter((v: BudgetVersion) => v.type === 'Actual');
	}, [versionsData]);

	// Status messages for user feedback
	const [statusMessage, setStatusMessage] = useState<{
		text: string;
		type: 'success' | 'error';
	} | null>(null);

	const showStatus = useCallback((text: string, type: 'success' | 'error') => {
		setStatusMessage({ text, type });
		setTimeout(() => setStatusMessage(null), 4000);
	}, []);

	const fiscalYearOptions = useMemo(() => {
		const base = CURRENT_FISCAL_YEAR;
		return [base - 2, base - 1, base, base + 1, base + 2];
	}, []);

	const rows = useMemo(() => {
		if (!periods) return [];
		// Sort by month ascending to ensure Jan-Dec order
		return [...periods].sort((a, b) => a.month - b.month);
	}, [periods]);

	const columns = useMemo(
		() => [
			columnHelper.accessor('month', {
				header: 'Month',
				cell: (info) => {
					const monthIndex = info.getValue() - 1;
					return (
						<span className="font-medium">
							{MONTH_NAMES[monthIndex] ?? `Month ${info.getValue()}`}
						</span>
					);
				},
			}),
			columnHelper.accessor('status', {
				header: 'Status',
				cell: (info) => {
					const value = info.getValue();
					return (
						<span
							className={cn(
								'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
								STATUS_BADGE_COLORS[value] ?? 'bg-slate-100 text-slate-700'
							)}
							aria-label={`Status: ${value}`}
						>
							{value}
						</span>
					);
				},
			}),
			columnHelper.accessor('actualVersionId', {
				header: 'Actual Version',
				cell: (info) => {
					const value = info.getValue();
					if (value == null) return <span className="text-slate-400">—</span>;
					// Find the version name if available
					const version = lockedActualVersions.find((v: BudgetVersion) => v.id === value);
					return <span>{version ? `${version.name} (#${value})` : `#${value}`}</span>;
				},
			}),
			columnHelper.accessor('lockedAt', {
				header: 'Locked At',
				cell: (info) => {
					const iso = info.getValue();
					if (!iso) return <span className="text-slate-400">—</span>;
					return formatDate(iso);
				},
			}),
			columnHelper.accessor('lockedById', {
				header: 'Locked By',
				cell: (info) => {
					const value = info.getValue();
					if (value == null) return <span className="text-slate-400">—</span>;
					return <span>User #{value}</span>;
				},
			}),
			...(canLock
				? [
						columnHelper.display({
							id: 'actions',
							header: 'Actions',
							cell: ({ row }) => {
								const period = row.original;
								if (period.status === 'Locked') return null;
								return (
									<LockAction
										period={period}
										lockedActualVersions={lockedActualVersions}
										onStatusMessage={showStatus}
									/>
								);
							},
						}),
					]
				: []),
		],
		[canLock, lockedActualVersions, showStatus]
	);

	const table = useReactTable({
		data: rows,
		columns,
		getCoreRowModel: getCoreRowModel(),
	});

	return (
		<div className="p-6">
			{/* Status message */}
			{statusMessage && (
				<div
					aria-live="polite"
					className={cn(
						'mb-4 rounded-md px-4 py-3 text-sm font-medium',
						statusMessage.type === 'success'
							? 'bg-green-50 text-green-800'
							: 'bg-red-50 text-red-800'
					)}
				>
					{statusMessage.text}
				</div>
			)}

			{/* Toolbar */}
			<div className="flex flex-wrap items-center gap-3 pb-4">
				<h1 className="mr-auto text-xl font-semibold">Fiscal Period Management</h1>

				<select
					value={String(fiscalYear)}
					onChange={(e) => setFiscalYear(Number(e.target.value))}
					className={cn('rounded-md border border-slate-300', 'px-3 py-2 text-sm')}
					aria-label="Filter by fiscal year"
				>
					{fiscalYearOptions.map((fy) => (
						<option key={fy} value={String(fy)}>
							FY {fy}
						</option>
					))}
				</select>
			</div>

			{/* Data table */}
			{isLoading ? (
				<p className="text-sm text-slate-500">Loading...</p>
			) : (
				<div className="overflow-x-auto rounded-lg border">
					<table role="grid" className="w-full text-left text-sm">
						<thead className="border-b bg-slate-50">
							{table.getHeaderGroups().map((hg) => (
								<tr key={hg.id} role="row">
									{hg.headers.map((header) => (
										<th
											key={header.id}
											role="columnheader"
											className="px-4 py-3 font-medium text-slate-600"
										>
											{flexRender(header.column.columnDef.header, header.getContext())}
										</th>
									))}
								</tr>
							))}
						</thead>
						<tbody>
							{table.getRowModel().rows.length === 0 ? (
								<tr>
									<td
										colSpan={columns.length}
										className="px-4 py-12 text-center text-sm text-slate-500"
									>
										No fiscal periods for FY{fiscalYear}
									</td>
								</tr>
							) : (
								table.getRowModel().rows.map((row) => (
									<tr key={row.id} role="row" className="border-b last:border-0 hover:bg-slate-50">
										{row.getVisibleCells().map((cell) => (
											<td key={cell.id} role="gridcell" aria-readonly="true" className="px-4 py-3">
												{flexRender(cell.column.columnDef.cell, cell.getContext())}
											</td>
										))}
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

type LockActionProps = {
	period: FiscalPeriod;
	lockedActualVersions: BudgetVersion[];
	onStatusMessage: (text: string, type: 'success' | 'error') => void;
};

function LockAction({ period, lockedActualVersions, onStatusMessage }: LockActionProps) {
	const [selectedVersionId, setSelectedVersionId] = useState<string>('');
	const [confirming, setConfirming] = useState(false);
	const lockMutation = useLockFiscalPeriod();

	const monthName = MONTH_NAMES[period.month - 1] ?? `Month ${period.month}`;

	const handleLock = useCallback(() => {
		if (!selectedVersionId) {
			onStatusMessage('Please select an Actual version before locking.', 'error');
			return;
		}

		if (!confirming) {
			setConfirming(true);
			return;
		}

		setConfirming(false);
		lockMutation.mutate(
			{
				fiscalYear: period.fiscalYear,
				month: period.month,
				actual_version_id: Number(selectedVersionId),
			},
			{
				onSuccess: () => {
					onStatusMessage(`${monthName} locked successfully.`, 'success');
					setSelectedVersionId('');
				},
				onError: () => {
					onStatusMessage(`Failed to lock ${monthName}. Please try again.`, 'error');
				},
			}
		);
	}, [
		selectedVersionId,
		confirming,
		lockMutation,
		period.fiscalYear,
		period.month,
		monthName,
		onStatusMessage,
	]);

	return (
		<div className="flex items-center gap-2">
			<label className="sr-only" htmlFor={`version-select-${period.month}`}>
				Select Actual version for {monthName}
			</label>
			<select
				id={`version-select-${period.month}`}
				value={selectedVersionId}
				onChange={(e) => setSelectedVersionId(e.target.value)}
				className={cn('rounded-md border border-slate-300', 'px-2 py-1 text-xs')}
				disabled={lockMutation.isPending}
				aria-label={`Select Actual version for ${monthName}`}
			>
				<option value="">Select version...</option>
				{lockedActualVersions.map((v: BudgetVersion) => (
					<option key={v.id} value={String(v.id)}>
						{v.name} (#{v.id})
					</option>
				))}
			</select>
			<button
				type="button"
				onClick={handleLock}
				disabled={!selectedVersionId || lockMutation.isPending}
				className={cn(
					'rounded-md px-3 py-1 text-xs font-medium',
					confirming
						? 'bg-red-600 text-white hover:bg-red-700'
						: 'bg-violet-600 text-white hover:bg-violet-700',
					'disabled:cursor-not-allowed disabled:opacity-50'
				)}
				aria-label={`Lock period ${monthName}`}
			>
				{lockMutation.isPending ? 'Locking...' : confirming ? 'Confirm Lock' : 'Lock Period'}
			</button>
			{confirming && (
				<button
					type="button"
					onClick={() => setConfirming(false)}
					className="rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
				>
					Cancel
				</button>
			)}
		</div>
	);
}

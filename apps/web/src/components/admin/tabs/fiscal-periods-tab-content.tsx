import { useCallback, useMemo, useState } from 'react';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { cn } from '../../../lib/cn';
import { formatDate, getCurrentFiscalYear } from '../../../lib/format-date';
import { toast } from '../../ui/toast-state';
import { useAuthStore } from '../../../stores/auth-store';
import { useFiscalPeriods, useLockFiscalPeriod } from '../../../hooks/use-fiscal-periods';
import type { FiscalPeriod } from '../../../hooks/use-fiscal-periods';
import { useVersions } from '../../../hooks/use-versions';
import type { BudgetVersion } from '../../../hooks/use-versions';
import { ListGrid } from '../../data-grid/list-grid';
import { Button } from '../../ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../ui/select';

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
	Draft: 'bg-(--status-draft-bg) text-(--status-draft)',
	Locked: 'bg-(--status-locked-bg) text-(--status-locked)',
};

const CURRENT_FISCAL_YEAR = getCurrentFiscalYear();

export function FiscalPeriodsTabContent() {
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
								STATUS_BADGE_COLORS[value] ?? 'bg-(--status-draft-bg) text-(--status-draft)'
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
					if (value == null) {
						return <span className="text-(--text-muted)">&mdash;</span>;
					}
					// Find the version name if available
					const version = lockedActualVersions.find((v: BudgetVersion) => v.id === value);
					return <span>{version ? `${version.name} (#${value})` : `#${value}`}</span>;
				},
			}),
			columnHelper.accessor('lockedAt', {
				header: 'Locked At',
				cell: (info) => {
					const iso = info.getValue();
					if (!iso) {
						return <span className="text-(--text-muted)">&mdash;</span>;
					}
					return formatDate(iso);
				},
			}),
			columnHelper.accessor('lockedById', {
				header: 'Locked By',
				cell: (info) => {
					const value = info.getValue();
					if (value == null) {
						return <span className="text-(--text-muted)">&mdash;</span>;
					}
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
								return <LockAction period={period} lockedActualVersions={lockedActualVersions} />;
							},
						}),
					]
				: []),
		],
		[canLock, lockedActualVersions]
	);

	const table = useReactTable({
		data: rows,
		columns,
		getCoreRowModel: getCoreRowModel(),
	});

	return (
		<>
			{/* FY selector */}
			<div className="flex flex-wrap items-center gap-3 pb-4">
				<Select value={String(fiscalYear)} onValueChange={(v) => setFiscalYear(Number(v))}>
					<SelectTrigger className="w-[130px]" aria-label="Filter by fiscal year">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{fiscalYearOptions.map((fy) => (
							<SelectItem key={fy} value={String(fy)}>
								FY {fy}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			{/* Data table */}
			<ListGrid
				table={table}
				isLoading={isLoading}
				emptyState={
					<p className="text-(--text-sm) text-(--text-muted)">
						No fiscal periods for FY{fiscalYear}
					</p>
				}
				ariaLabel="Fiscal periods"
			/>
		</>
	);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

type LockActionProps = {
	period: FiscalPeriod;
	lockedActualVersions: BudgetVersion[];
};

function LockAction({ period, lockedActualVersions }: LockActionProps) {
	const [selectedVersionId, setSelectedVersionId] = useState<string>('');
	const [confirming, setConfirming] = useState(false);
	const lockMutation = useLockFiscalPeriod();

	const monthName = MONTH_NAMES[period.month - 1] ?? `Month ${period.month}`;

	const handleLock = useCallback(() => {
		if (!selectedVersionId) {
			toast.error('Please select an Actual version before locking.');
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
					toast.success(`${monthName} locked successfully.`);
					setSelectedVersionId('');
				},
				onError: () => {
					toast.error(`Failed to lock ${monthName}. Please try again.`);
				},
			}
		);
	}, [selectedVersionId, confirming, lockMutation, period.fiscalYear, period.month, monthName]);

	return (
		<div className="flex items-center gap-2">
			<Select
				{...(selectedVersionId ? { value: selectedVersionId } : {})}
				onValueChange={setSelectedVersionId}
				disabled={lockMutation.isPending}
			>
				<SelectTrigger
					className="w-[180px] h-8 text-xs"
					aria-label={`Select Actual version for ${monthName}`}
				>
					<SelectValue placeholder="Select version..." />
				</SelectTrigger>
				<SelectContent>
					{lockedActualVersions.map((v: BudgetVersion) => (
						<SelectItem key={v.id} value={String(v.id)}>
							{v.name} (#{v.id})
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			<Button
				type="button"
				onClick={handleLock}
				disabled={!selectedVersionId}
				loading={lockMutation.isPending}
				variant={confirming ? 'destructive' : 'primary'}
				size="sm"
				aria-label={`Lock period ${monthName}`}
			>
				{confirming ? 'Confirm Lock' : 'Lock Period'}
			</Button>
			{confirming && (
				<Button type="button" onClick={() => setConfirming(false)} variant="ghost" size="sm">
					Cancel
				</Button>
			)}
		</div>
	);
}

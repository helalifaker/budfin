import { useEffect, useMemo, useState } from 'react';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import type { DiscountEntry } from '@budfin/types';
import { useDiscounts, usePutDiscounts } from '../../hooks/use-revenue';
import { EditableCell } from '../data-grid/editable-cell';
import { DataGrid } from '../data-grid/data-grid';
import { Button } from '../ui/button';

interface DiscountsTabProps {
	versionId: number;
	isReadOnly: boolean;
}

const columnHelper = createColumnHelper<DiscountEntry>();

export function DiscountsTab({ versionId, isReadOnly }: DiscountsTabProps) {
	const { data, isLoading } = useDiscounts(versionId);
	const saveMutation = usePutDiscounts(versionId);
	const sourceEntries = useMemo(() => data?.entries ?? [], [data?.entries]);
	const [draftEntries, setDraftEntries] = useState<DiscountEntry[]>([]);

	useEffect(() => {
		setDraftEntries(sourceEntries);
	}, [sourceEntries]);

	const isDirty = JSON.stringify(draftEntries) !== JSON.stringify(sourceEntries);

	const handleValueChange = (rowIndex: number, value: string) => {
		setDraftEntries((current) =>
			current.map((entry, index) =>
				index === rowIndex ? { ...entry, discountRate: String(Number(value) || 0) } : entry
			)
		);
	};

	const columns = useMemo(
		() => [
			columnHelper.accessor('tariff', {
				header: 'Tariff',
				cell: (info) => <span className="font-medium">{info.getValue()}</span>,
			}),
			columnHelper.accessor('nationality', {
				header: 'Nationality',
				cell: (info) =>
					info.getValue() ?? <span className="italic text-[var(--text-muted)]">All</span>,
			}),
			columnHelper.accessor('discountRate', {
				header: 'Rate',
				cell: (info) => (
					<div className="flex items-center gap-2">
						<EditableCell
							value={info.getValue()}
							onChange={(value) => handleValueChange(info.row.index, value)}
							isReadOnly={isReadOnly}
							type="number"
							className="max-w-[88px]"
						/>
						<span className="text-xs text-[var(--text-muted)]">
							({(Number(info.getValue()) * 100).toFixed(2)}%)
						</span>
					</div>
				),
			}),
			columnHelper.display({
				id: 'effect',
				header: 'Workbook Effect',
				cell: (info) => {
					const rate = Number(info.row.original.discountRate);
					const kept = ((1 - rate) * 100).toFixed(2);
					return (
						<span className="text-xs text-[var(--text-secondary)]">
							Students are billed at {kept}% of Plein tuition.
						</span>
					);
				},
			}),
		],
		[isReadOnly]
	);

	const table = useReactTable({
		data: draftEntries,
		columns,
		getCoreRowModel: getCoreRowModel(),
	});

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between rounded-lg border border-[var(--workspace-border)] bg-[var(--workspace-bg-subtle)] px-4 py-3 text-sm">
				<div>
					<div className="font-medium text-[var(--text-primary)]">Discount Matrix</div>
					<div className="text-[var(--text-muted)]">
						The revenue engine converts these rates into effective tariff tuition, exactly like the
						workbook.
					</div>
				</div>
				{!isReadOnly && (
					<Button
						size="sm"
						disabled={!isDirty || saveMutation.isPending}
						onClick={() => saveMutation.mutate(draftEntries)}
					>
						{saveMutation.isPending ? 'Saving...' : 'Save Discounts'}
					</Button>
				)}
			</div>

			<DataGrid
				table={table}
				isLoading={isLoading}
				showSkeleton
				emptyState={
					<p className="text-sm text-[var(--text-muted)]">
						No discount policies are configured for this version.
					</p>
				}
			/>
		</div>
	);
}

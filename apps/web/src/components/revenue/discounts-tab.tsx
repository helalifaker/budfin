import { useEffect, useMemo, useState } from 'react';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import Decimal from 'decimal.js';
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
				index === rowIndex
					? { ...entry, discountRate: new Decimal(value || '0').toFixed(6) }
					: entry
			)
		);
	};

	const columns = useMemo(
		() => [
			columnHelper.accessor('tariff', {
				header: 'Tariff',
				cell: (info) => <span className="font-medium">{info.getValue()}</span>,
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
						<span className="text-xs text-(--text-muted)">
							({new Decimal(info.getValue()).mul(100).toFixed(2)}%)
						</span>
					</div>
				),
			}),
			columnHelper.display({
				id: 'effect',
				header: 'Workbook Effect',
				cell: (info) => {
					const rate = new Decimal(info.row.original.discountRate);
					const kept = new Decimal(1).minus(rate).mul(100).toFixed(2);
					return (
						<span className="text-xs text-(--text-secondary)">
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
			<div className="flex items-center justify-between rounded-lg border border-(--workspace-border) bg-(--workspace-bg-subtle) px-4 py-3 text-sm">
				<div>
					<div className="font-medium text-(--text-primary)">Discount Matrix</div>
					<div className="text-(--text-muted)">
						The revenue engine applies one rate per reduced tariff, exactly like the workbook.
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
					<p className="text-sm text-(--text-muted)">
						No discount policies are configured for this version.
					</p>
				}
			/>
		</div>
	);
}

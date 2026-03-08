import { useEffect, useMemo, useState } from 'react';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import type { FeeGridEntry } from '@budfin/types';
import { useFeeGrid, usePutFeeGrid } from '../../hooks/use-revenue';
import { EditableCell } from '../data-grid/editable-cell';
import { DataGrid } from '../data-grid/data-grid';
import { Button } from '../ui/button';

interface FeeGridTabProps {
	versionId: number;
	academicPeriod: 'AY1' | 'AY2' | 'both';
	isReadOnly: boolean;
}

const columnHelper = createColumnHelper<FeeGridEntry>();

export function FeeGridTab({ versionId, academicPeriod, isReadOnly }: FeeGridTabProps) {
	const { data, isLoading } = useFeeGrid(versionId, academicPeriod);
	const saveMutation = usePutFeeGrid(versionId);
	const sourceEntries = useMemo(() => data?.entries ?? [], [data?.entries]);
	const [draftEntries, setDraftEntries] = useState<FeeGridEntry[]>([]);

	useEffect(() => {
		setDraftEntries(sourceEntries);
	}, [sourceEntries]);

	const isDirty = JSON.stringify(draftEntries) !== JSON.stringify(sourceEntries);

	const handleValueChange = (rowIndex: number, field: keyof FeeGridEntry, value: string) => {
		setDraftEntries((current) =>
			current.map((entry, index) => (index === rowIndex ? { ...entry, [field]: value } : entry))
		);
	};

	const columns = useMemo(
		() => [
			columnHelper.accessor('academicPeriod', {
				header: 'Period',
				cell: (info) => (
					<span className="inline-flex rounded-full bg-[var(--workspace-bg-subtle)] px-2 py-0.5 text-xs font-medium text-[var(--text-secondary)]">
						{info.getValue()}
					</span>
				),
			}),
			columnHelper.accessor('gradeLevel', {
				header: 'Grade',
				cell: (info) => <span className="font-medium">{info.getValue()}</span>,
			}),
			columnHelper.accessor('nationality', {
				header: 'Nationality',
			}),
			columnHelper.accessor('tariff', {
				header: 'Tariff',
			}),
			columnHelper.accessor('dai', {
				header: 'DAI',
				cell: (info) => (
					<EditableCell
						value={info.getValue()}
						onChange={(value) =>
							handleValueChange(
								info.row.index,
								'dai',
								String(Number(value.replace(/,/g, '.')) || 0)
							)
						}
						isReadOnly={isReadOnly}
						type="number"
					/>
				),
			}),
			columnHelper.accessor('tuitionTtc', {
				header: 'Tuition TTC',
				cell: (info) => (
					<EditableCell
						value={info.getValue()}
						onChange={(value) =>
							handleValueChange(
								info.row.index,
								'tuitionTtc',
								String(Number(value.replace(/,/g, '.')) || 0)
							)
						}
						isReadOnly={isReadOnly}
						type="number"
					/>
				),
			}),
			columnHelper.accessor('tuitionHt', {
				header: 'Tuition HT',
				cell: (info) => (
					<EditableCell
						value={info.getValue()}
						onChange={(value) =>
							handleValueChange(
								info.row.index,
								'tuitionHt',
								String(Number(value.replace(/,/g, '.')) || 0)
							)
						}
						isReadOnly={isReadOnly}
						type="number"
					/>
				),
			}),
			columnHelper.accessor('term1Amount', {
				header: 'Term 1',
				cell: (info) => (
					<EditableCell
						value={info.getValue()}
						onChange={(value) =>
							handleValueChange(
								info.row.index,
								'term1Amount',
								String(Number(value.replace(/,/g, '.')) || 0)
							)
						}
						isReadOnly={isReadOnly}
						type="number"
					/>
				),
			}),
			columnHelper.accessor('term2Amount', {
				header: 'Term 2',
				cell: (info) => (
					<EditableCell
						value={info.getValue()}
						onChange={(value) =>
							handleValueChange(
								info.row.index,
								'term2Amount',
								String(Number(value.replace(/,/g, '.')) || 0)
							)
						}
						isReadOnly={isReadOnly}
						type="number"
					/>
				),
			}),
			columnHelper.accessor('term3Amount', {
				header: 'Term 3',
				cell: (info) => (
					<EditableCell
						value={info.getValue()}
						onChange={(value) =>
							handleValueChange(
								info.row.index,
								'term3Amount',
								String(Number(value.replace(/,/g, '.')) || 0)
							)
						}
						isReadOnly={isReadOnly}
						type="number"
					/>
				),
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
					<div className="font-medium text-[var(--text-primary)]">Fee Grid</div>
					<div className="text-[var(--text-muted)]">
						Edit tariff-level fees directly in the grid. The workbook logic still derives discounts
						separately.
					</div>
				</div>
				{!isReadOnly && (
					<Button
						size="sm"
						disabled={!isDirty || saveMutation.isPending}
						onClick={() => saveMutation.mutate(draftEntries)}
					>
						{saveMutation.isPending ? 'Saving...' : 'Save Fee Grid'}
					</Button>
				)}
			</div>

			<DataGrid
				table={table}
				isLoading={isLoading}
				showSkeleton
				emptyState={
					<p className="text-sm text-[var(--text-muted)]">
						No fee grid data is available for this period.
					</p>
				}
			/>
		</div>
	);
}

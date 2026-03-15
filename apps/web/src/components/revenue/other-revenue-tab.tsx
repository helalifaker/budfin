import { Decimal } from 'decimal.js';
import { useEffect, useMemo, useState } from 'react';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import type { DistributionMethod, IfrsCategory, OtherRevenueItem } from '@budfin/types';
import { useOtherRevenue, usePutOtherRevenue } from '../../hooks/use-revenue';
import { EditableCell } from '../data-grid/editable-cell';
import { DataGrid } from '../data-grid/data-grid';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

interface OtherRevenueTabProps {
	versionId: number;
	isReadOnly: boolean;
}

interface OtherRevenueDraftRow extends OtherRevenueItem {
	weightArrayText: string;
	specificMonthsText: string;
}

const DISTRIBUTION_OPTIONS: DistributionMethod[] = [
	'ACADEMIC_10',
	'YEAR_ROUND_12',
	'CUSTOM_WEIGHTS',
	'SPECIFIC_PERIOD',
];

const CATEGORY_OPTIONS: IfrsCategory[] = [
	'Registration Fees',
	'Activities & Services',
	'Examination Fees',
	'Other Revenue',
];

const columnHelper = createColumnHelper<OtherRevenueDraftRow>();

function toDraftRow(item: OtherRevenueItem): OtherRevenueDraftRow {
	return {
		...item,
		weightArrayText: item.weightArray?.join(', ') ?? '',
		specificMonthsText: item.specificMonths?.join(', ') ?? '',
	};
}

function fromDraftRow(item: OtherRevenueDraftRow): OtherRevenueItem {
	return {
		lineItemName: item.lineItemName,
		annualAmount: item.annualAmount,
		distributionMethod: item.distributionMethod,
		weightArray:
			item.distributionMethod === 'CUSTOM_WEIGHTS'
				? item.weightArrayText
						.split(',')
						.map((value) => value.trim())
						.filter(Boolean)
						.map((value) => Number(value))
				: null,
		specificMonths:
			item.distributionMethod === 'SPECIFIC_PERIOD'
				? item.specificMonthsText
						.split(',')
						.map((value) => value.trim())
						.filter(Boolean)
						.map((value) => Number(value))
				: null,
		ifrsCategory: item.ifrsCategory,
		computeMethod: item.computeMethod ?? null,
	};
}

function buildDistributionPreview(item: OtherRevenueDraftRow) {
	switch (item.distributionMethod) {
		case 'ACADEMIC_10':
			return 'Jan-Jun and Sep-Dec';
		case 'YEAR_ROUND_12':
			return 'Jan-Dec evenly';
		case 'CUSTOM_WEIGHTS':
			return item.weightArrayText || 'Enter 12 month weights';
		case 'SPECIFIC_PERIOD':
			return item.specificMonthsText || 'Enter month numbers';
	}
}

export function OtherRevenueTab({ versionId, isReadOnly }: OtherRevenueTabProps) {
	const { data, isLoading } = useOtherRevenue(versionId);
	const saveMutation = usePutOtherRevenue(versionId);
	const sourceItems = useMemo(() => data?.items ?? [], [data?.items]);
	const customSourceItems = useMemo(
		() => sourceItems.filter((item) => item.computeMethod === null),
		[sourceItems]
	);
	const [draftItems, setDraftItems] = useState<OtherRevenueDraftRow[]>([]);

	useEffect(() => {
		setDraftItems(customSourceItems.map(toDraftRow));
	}, [customSourceItems]);

	const isDirty = JSON.stringify(draftItems) !== JSON.stringify(customSourceItems.map(toDraftRow));

	const updateRow = (
		rowIndex: number,
		updater: (row: OtherRevenueDraftRow) => OtherRevenueDraftRow
	) => {
		setDraftItems((current) =>
			current.map((row, index) => (index === rowIndex ? updater(row) : row))
		);
	};

	const handleSave = () => {
		const systemItems = sourceItems
			.filter((item) => item.computeMethod !== null)
			.map((item) => ({ ...item }));
		const customItems = draftItems.map(fromDraftRow);
		saveMutation.mutate([...systemItems, ...customItems]);
	};

	const columns = useMemo(
		() => [
			columnHelper.accessor('lineItemName', {
				header: 'Line Item',
				cell: (info) => (
					<EditableCell
						value={info.getValue()}
						onChange={(value) =>
							updateRow(info.row.index, (row) => ({ ...row, lineItemName: value }))
						}
						isReadOnly={isReadOnly}
					/>
				),
			}),
			columnHelper.accessor('annualAmount', {
				header: 'Annual Amount',
				cell: (info) => (
					<EditableCell
						value={info.getValue()}
						onChange={(value) =>
							updateRow(info.row.index, (row) => ({
								...row,
								annualAmount: new Decimal(value || '0').toFixed(4),
							}))
						}
						isReadOnly={isReadOnly}
						type="number"
					/>
				),
			}),
			columnHelper.accessor('distributionMethod', {
				header: 'Distribution',
				cell: (info) =>
					isReadOnly ? (
						<span className="text-xs text-(--text-secondary)">{info.getValue()}</span>
					) : (
						<Select
							value={info.getValue()}
							onValueChange={(value) =>
								updateRow(info.row.index, (row) => ({
									...row,
									distributionMethod: value as DistributionMethod,
								}))
							}
						>
							<SelectTrigger className="w-[170px]">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{DISTRIBUTION_OPTIONS.map((option) => (
									<SelectItem key={option} value={option}>
										{option}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					),
			}),
			columnHelper.display({
				id: 'distributionDetail',
				header: 'Pattern',
				cell: (info) => {
					const row = info.row.original;
					if (row.distributionMethod === 'CUSTOM_WEIGHTS') {
						return (
							<EditableCell
								value={row.weightArrayText}
								onChange={(value) =>
									updateRow(info.row.index, (current) => ({
										...current,
										weightArrayText: value,
									}))
								}
								isReadOnly={isReadOnly}
							/>
						);
					}

					if (row.distributionMethod === 'SPECIFIC_PERIOD') {
						return (
							<EditableCell
								value={row.specificMonthsText}
								onChange={(value) =>
									updateRow(info.row.index, (current) => ({
										...current,
										specificMonthsText: value,
									}))
								}
								isReadOnly={isReadOnly}
							/>
						);
					}

					return (
						<span className="text-xs text-(--text-secondary)">{buildDistributionPreview(row)}</span>
					);
				},
			}),
			columnHelper.accessor('ifrsCategory', {
				header: 'Category',
				cell: (info) =>
					isReadOnly ? (
						<span className="text-xs text-(--text-secondary)">{info.getValue()}</span>
					) : (
						<Select
							value={info.getValue()}
							onValueChange={(value) =>
								updateRow(info.row.index, (row) => ({
									...row,
									ifrsCategory: value as IfrsCategory,
								}))
							}
						>
							<SelectTrigger className="w-[180px]">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{CATEGORY_OPTIONS.map((option) => (
									<SelectItem key={option} value={option}>
										{option}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					),
			}),
			columnHelper.display({
				id: 'preview',
				header: 'Monthly Preview',
				cell: (info) => (
					<span className="text-xs text-(--text-muted)">
						{buildDistributionPreview(info.row.original)}
					</span>
				),
			}),
		],
		[isReadOnly]
	);

	const table = useReactTable({
		data: draftItems,
		columns,
		getCoreRowModel: getCoreRowModel(),
	});

	return (
		<div className="space-y-4">
			<div className="rounded-md border border-(--workspace-border) bg-(--workspace-bg-subtle) px-4 py-3">
				<p className="text-xs text-(--text-secondary)">
					System-calculated lines (DAI, DPI, exams, evaluations) are managed automatically and not
					shown here. Only custom revenue lines appear below.
				</p>
			</div>

			<div className="flex items-center justify-between rounded-lg border border-(--workspace-border) bg-(--workspace-bg-subtle) px-4 py-3 text-sm">
				<div>
					<div className="font-medium text-(--text-primary)">Custom Revenue Lines</div>
					<div className="text-(--text-muted)">
						Custom weights accept relative values like the workbook. Example: `1, 1` means a 50/50
						split.
					</div>
				</div>
				{!isReadOnly && (
					<Button size="sm" disabled={!isDirty || saveMutation.isPending} onClick={handleSave}>
						{saveMutation.isPending ? 'Saving...' : 'Save Other Revenue'}
					</Button>
				)}
			</div>

			<DataGrid
				table={table}
				isLoading={isLoading}
				showSkeleton
				emptyState={
					<p className="text-sm text-(--text-muted)">
						No custom revenue lines are configured for this version.
					</p>
				}
			/>
		</div>
	);
}

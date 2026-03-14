import { useEffect, useMemo, useState } from 'react';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import type {
	DistributionMethod,
	IfrsCategory,
	OtherRevenueItem,
	RevenueSettings,
} from '@budfin/types';
import {
	useOtherRevenue,
	usePutOtherRevenue,
	usePutRevenueSettings,
	useRevenueSettings,
} from '../../hooks/use-revenue';
import { EditableCell } from '../data-grid/editable-cell';
import { DataGrid } from '../data-grid/data-grid';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
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

const REVENUE_SETTING_FIELDS: Array<{
	key: keyof RevenueSettings;
	label: string;
	description: string;
}> = [
	{
		key: 'dpiPerStudentHt',
		label: 'DPI per Student (HT)',
		description: 'Applied to all new students by nationality.',
	},
	{
		key: 'dossierPerStudentHt',
		label: 'Dossier per Student (HT)',
		description: 'Applied to all new students by nationality.',
	},
	{
		key: 'examBacPerStudent',
		label: 'BAC Exam Fee',
		description: 'AY1 TERM headcount x BAC fee.',
	},
	{
		key: 'examDnbPerStudent',
		label: 'DNB Exam Fee',
		description: 'AY1 3EME headcount x DNB fee.',
	},
	{
		key: 'examEafPerStudent',
		label: 'EAF Exam Fee',
		description: 'AY1 1ERE headcount x EAF fee.',
	},
	{
		key: 'evalPrimairePerStudent',
		label: 'Eval Primaire',
		description: 'Applied to new CP-CM2 students.',
	},
	{
		key: 'evalSecondairePerStudent',
		label: 'Eval Secondaire',
		description: 'Applied to new 6EME-TERM students.',
	},
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
	const { data: settingsData, isLoading: settingsLoading } = useRevenueSettings(versionId);
	const saveMutation = usePutOtherRevenue(versionId);
	const saveSettingsMutation = usePutRevenueSettings(versionId);
	const sourceItems = useMemo(() => data?.items ?? [], [data?.items]);
	const sourceSettings = settingsData?.settings ?? null;
	const [draftItems, setDraftItems] = useState<OtherRevenueDraftRow[]>([]);
	const [draftSettings, setDraftSettings] = useState<RevenueSettings | null>(null);

	useEffect(() => {
		setDraftItems(sourceItems.map(toDraftRow));
	}, [sourceItems]);

	useEffect(() => {
		setDraftSettings(sourceSettings);
	}, [sourceSettings]);

	const isDirty = JSON.stringify(draftItems) !== JSON.stringify(sourceItems.map(toDraftRow));
	const settingsDirty =
		draftSettings !== null && JSON.stringify(draftSettings) !== JSON.stringify(sourceSettings);

	const updateRow = (
		rowIndex: number,
		updater: (row: OtherRevenueDraftRow) => OtherRevenueDraftRow
	) => {
		setDraftItems((current) =>
			current.map((row, index) => (index === rowIndex ? updater(row) : row))
		);
	};

	const columns = useMemo(
		() => [
			columnHelper.accessor('lineItemName', {
				header: 'Line Item',
				cell: (info) => {
					const dynamicRow = info.row.original.computeMethod !== null;
					return (
						<EditableCell
							value={info.getValue()}
							onChange={(value) =>
								updateRow(info.row.index, (row) => ({ ...row, lineItemName: value }))
							}
							isReadOnly={isReadOnly || dynamicRow}
						/>
					);
				},
			}),
			columnHelper.accessor('annualAmount', {
				header: 'Annual Amount',
				cell: (info) => {
					const dynamicRow = info.row.original.computeMethod !== null;
					return (
						<EditableCell
							value={info.getValue()}
							onChange={(value) =>
								updateRow(info.row.index, (row) => ({
									...row,
									annualAmount: String(Number(value) || 0),
								}))
							}
							isReadOnly={isReadOnly || dynamicRow}
							type="number"
						/>
					);
				},
			}),
			columnHelper.accessor('distributionMethod', {
				header: 'Distribution',
				cell: (info) =>
					isReadOnly || info.row.original.computeMethod !== null ? (
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
									updateRow(info.row.index, (current) => ({ ...current, weightArrayText: value }))
								}
								isReadOnly={isReadOnly || row.computeMethod !== null}
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
								isReadOnly={isReadOnly || row.computeMethod !== null}
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
					isReadOnly || info.row.original.computeMethod !== null ? (
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
			<div className="rounded-lg border border-(--workspace-border) bg-(--workspace-bg-subtle) px-4 py-4">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div>
						<div className="font-medium text-(--text-primary)">Derived Revenue Rates</div>
						<div className="text-sm text-(--text-muted)">
							These version-scoped rates drive the system-calculated DAI, DPI, dossier, exam, and
							evaluation lines.
						</div>
					</div>
					{!isReadOnly && (
						<Button
							size="sm"
							disabled={!settingsDirty || saveSettingsMutation.isPending || draftSettings === null}
							onClick={() => draftSettings && saveSettingsMutation.mutate(draftSettings)}
						>
							{saveSettingsMutation.isPending ? 'Saving...' : 'Save Rates'}
						</Button>
					)}
				</div>

				<div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
					{REVENUE_SETTING_FIELDS.map((field) => (
						<label key={field.key} className="space-y-1">
							<div className="text-sm font-medium text-(--text-primary)">{field.label}</div>
							<Input
								value={draftSettings?.[field.key] ?? ''}
								onChange={(event) =>
									setDraftSettings((current) =>
										current === null
											? current
											: {
													...current,
													[field.key]: event.target.value,
												}
									)
								}
								disabled={isReadOnly || settingsLoading || draftSettings === null}
								inputMode="decimal"
							/>
							<div className="text-xs text-(--text-muted)">{field.description}</div>
						</label>
					))}
				</div>
			</div>

			<div className="flex items-center justify-between rounded-lg border border-(--workspace-border) bg-(--workspace-bg-subtle) px-4 py-3 text-sm">
				<div>
					<div className="font-medium text-(--text-primary)">Other Revenue Drivers</div>
					<div className="text-(--text-muted)">
						System-calculated rows stay locked here and refresh on revenue calculation. Custom
						weights accept relative values like the workbook. Example: `1, 1` means a 50/50 split.
					</div>
				</div>
				{!isReadOnly && (
					<Button
						size="sm"
						disabled={!isDirty || saveMutation.isPending}
						onClick={() => saveMutation.mutate(draftItems.map(fromDraftRow))}
					>
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
						No non-tuition revenue lines are configured for this version.
					</p>
				}
			/>
		</div>
	);
}

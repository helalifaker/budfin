import { useCallback, useMemo, useState } from 'react';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { useAcademicYears } from '../../../hooks/use-academic-years';
import type { AcademicYear } from '../../../hooks/use-academic-years';
import { useAuthStore } from '../../../stores/auth-store';
import { AcademicYearSidePanel } from '../../master-data/academic-year-side-panel';
import { ListGrid } from '../../data-grid/list-grid';
import { Button } from '../../ui/button';

function formatDate(iso: string): string {
	if (!iso) return '-';
	const datePart = iso.split('T')[0] ?? iso;
	const [year, month, day] = datePart.split('-');
	return `${day}/${month}/${year}`;
}

const ayColumnHelper = createColumnHelper<AcademicYear>();

export function AcademicYearsTabContent() {
	const currentUser = useAuthStore((s) => s.user);
	const isAdmin = currentUser?.role === 'Admin';

	const { data: ayData, isLoading: ayLoading } = useAcademicYears();

	const [ayPanelOpen, setAyPanelOpen] = useState(false);
	const [editingAy, setEditingAy] = useState<AcademicYear | null>(null);

	const ayColumns = useMemo(
		() => [
			ayColumnHelper.accessor('fiscalYear', {
				header: 'Fiscal Year',
				cell: (info) => <span className="font-medium">{info.getValue()}</span>,
			}),
			ayColumnHelper.accessor('ay1Start', {
				header: 'AY1 Start',
				cell: (info) => formatDate(info.getValue()),
			}),
			ayColumnHelper.accessor('ay1End', {
				header: 'AY1 End',
				cell: (info) => formatDate(info.getValue()),
			}),
			ayColumnHelper.accessor('summerStart', {
				header: 'Summer Start',
				cell: (info) => formatDate(info.getValue()),
			}),
			ayColumnHelper.accessor('summerEnd', {
				header: 'Summer End',
				cell: (info) => formatDate(info.getValue()),
			}),
			ayColumnHelper.accessor('ay2Start', {
				header: 'AY2 Start',
				cell: (info) => formatDate(info.getValue()),
			}),
			ayColumnHelper.accessor('ay2End', {
				header: 'AY2 End',
				cell: (info) => formatDate(info.getValue()),
			}),
			ayColumnHelper.accessor('academicWeeks', {
				header: 'Weeks',
				cell: (info) => info.getValue(),
			}),
		],
		[]
	);

	const handleAyRowClick = useCallback((ay: AcademicYear) => {
		setEditingAy(ay);
		setAyPanelOpen(true);
	}, []);

	const ayTable = useReactTable({
		data: ayData?.academicYears ?? [],
		columns: ayColumns,
		getCoreRowModel: getCoreRowModel(),
	});

	return (
		<div className="space-y-4">
			{/* Toolbar */}
			<div className="flex items-center justify-end">
				{isAdmin && (
					<Button
						type="button"
						variant="primary"
						onClick={() => {
							setEditingAy(null);
							setAyPanelOpen(true);
						}}
					>
						+ Add Year
					</Button>
				)}
			</div>

			{/* Data table */}
			<ListGrid
				table={ayTable}
				isLoading={ayLoading}
				onRowClick={handleAyRowClick}
				emptyState={<p className="text-(--text-sm) text-(--text-muted)">No academic years found</p>}
				ariaLabel="Academic years"
			/>

			{/* Side panel */}
			<AcademicYearSidePanel
				open={ayPanelOpen}
				onClose={() => setAyPanelOpen(false)}
				academicYear={editingAy}
			/>
		</div>
	);
}

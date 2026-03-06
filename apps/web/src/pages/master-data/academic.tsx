import { useMemo, useState } from 'react';
import {
	createColumnHelper,
	flexRender,
	getCoreRowModel,
	useReactTable,
} from '@tanstack/react-table';
import { useAcademicYears, type AcademicYear } from '../../hooks/use-academic-years';
import { useGradeLevels, type GradeLevel, type GradeBand } from '../../hooks/use-grade-levels';
import { useAuthStore } from '../../stores/auth-store';
import { AcademicYearSidePanel } from '../../components/master-data/academic-year-side-panel';
import { GradeLevelSidePanel } from '../../components/master-data/grade-level-side-panel';
import { cn } from '../../lib/cn';

function formatDate(iso: string): string {
	if (!iso) return '-';
	const datePart = iso.split('T')[0] ?? iso;
	const [year, month, day] = datePart.split('-');
	return `${day}/${month}/${year}`;
}

const BAND_STYLES: Record<GradeBand, string> = {
	MATERNELLE: 'bg-pink-100 text-pink-800',
	ELEMENTAIRE: 'bg-blue-100 text-blue-800',
	COLLEGE: 'bg-green-100 text-green-800',
	LYCEE: 'bg-purple-100 text-purple-800',
};

const ayColumnHelper = createColumnHelper<AcademicYear>();
const glColumnHelper = createColumnHelper<GradeLevel>();

export function AcademicPage() {
	const currentUser = useAuthStore((s) => s.user);
	const isAdmin = currentUser?.role === 'Admin';

	const { data: ayData, isLoading: ayLoading } = useAcademicYears();
	const { data: glData, isLoading: glLoading } = useGradeLevels();

	const [ayPanelOpen, setAyPanelOpen] = useState(false);
	const [editingAy, setEditingAy] = useState<AcademicYear | null>(null);
	const [glPanelOpen, setGlPanelOpen] = useState(false);
	const [editingGl, setEditingGl] = useState<GradeLevel | null>(null);

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
			ayColumnHelper.display({
				id: 'actions',
				header: 'Actions',
				cell: ({ row }) => (
					<button
						type="button"
						className="text-xs text-blue-600 hover:underline"
						onClick={(e) => {
							e.stopPropagation();
							setEditingAy(row.original);
							setAyPanelOpen(true);
						}}
					>
						Edit
					</button>
				),
			}),
		],
		[]
	);

	const glColumns = useMemo(
		() => [
			glColumnHelper.accessor('gradeCode', {
				header: 'Code',
				cell: (info) => <span className="font-medium">{info.getValue()}</span>,
			}),
			glColumnHelper.accessor('gradeName', {
				header: 'Name',
				cell: (info) => info.getValue(),
			}),
			glColumnHelper.accessor('band', {
				header: 'Band',
				cell: (info) => {
					const band = info.getValue();
					return (
						<span
							className={cn(
								'inline-block rounded-full px-2 py-0.5 text-xs font-medium',
								BAND_STYLES[band]
							)}
							aria-label={`Band: ${band}`}
						>
							{band}
						</span>
					);
				},
			}),
			glColumnHelper.accessor('maxClassSize', {
				header: 'Max Class Size',
				cell: (info) => info.getValue(),
			}),
			glColumnHelper.accessor('plancherPct', {
				header: 'Plancher %',
				cell: (info) => info.getValue(),
			}),
			glColumnHelper.accessor('ciblePct', {
				header: 'Cible %',
				cell: (info) => info.getValue(),
			}),
			glColumnHelper.accessor('plafondPct', {
				header: 'Plafond %',
				cell: (info) => info.getValue(),
			}),
			glColumnHelper.accessor('displayOrder', {
				header: 'Order',
				cell: (info) => info.getValue(),
			}),
			glColumnHelper.display({
				id: 'actions',
				header: 'Actions',
				cell: ({ row }) => (
					<button
						type="button"
						className="text-xs text-blue-600 hover:underline"
						onClick={(e) => {
							e.stopPropagation();
							setEditingGl(row.original);
							setGlPanelOpen(true);
						}}
					>
						Edit
					</button>
				),
			}),
		],
		[]
	);

	const ayTable = useReactTable({
		data: ayData?.academicYears ?? [],
		columns: ayColumns,
		getCoreRowModel: getCoreRowModel(),
	});

	const glTable = useReactTable({
		data: glData?.gradeLevels ?? [],
		columns: glColumns,
		getCoreRowModel: getCoreRowModel(),
	});

	return (
		<div className="space-y-8 p-6">
			{/* Academic Years Section */}
			<section>
				<div className="flex items-center justify-between pb-4">
					<h2 className="text-xl font-semibold">Academic Years</h2>
					{isAdmin && (
						<button
							type="button"
							className={cn(
								'rounded-md bg-blue-600 px-4 py-2 text-sm',
								'font-medium text-white hover:bg-blue-700'
							)}
							onClick={() => {
								setEditingAy(null);
								setAyPanelOpen(true);
							}}
						>
							+ Add New
						</button>
					)}
				</div>

				{ayLoading ? (
					<p className="text-sm text-slate-500">Loading academic years...</p>
				) : (
					<div className="overflow-x-auto rounded-lg border">
						<table role="grid" className="w-full text-left text-sm">
							<thead className="border-b bg-slate-50">
								{ayTable.getHeaderGroups().map((hg) => (
									<tr key={hg.id}>
										{hg.headers.map((header) => (
											<th key={header.id} className="px-4 py-3 font-medium text-slate-600">
												{flexRender(header.column.columnDef.header, header.getContext())}
											</th>
										))}
									</tr>
								))}
							</thead>
							<tbody>
								{ayTable.getRowModel().rows.map((row) => (
									<tr
										key={row.id}
										className="cursor-pointer border-b last:border-0 hover:bg-slate-50"
										onClick={() => {
											setEditingAy(row.original);
											setAyPanelOpen(true);
										}}
									>
										{row.getVisibleCells().map((cell) => (
											<td key={cell.id} className="px-4 py-3">
												{flexRender(cell.column.columnDef.cell, cell.getContext())}
											</td>
										))}
									</tr>
								))}
								{ayTable.getRowModel().rows.length === 0 && (
									<tr>
										<td colSpan={ayColumns.length} className="px-4 py-6 text-center text-slate-500">
											No academic years found
										</td>
									</tr>
								)}
							</tbody>
						</table>
					</div>
				)}
			</section>

			{/* Grade Levels Section */}
			<section>
				<div className="pb-4">
					<h2 className="text-xl font-semibold">Grade Levels</h2>
				</div>

				{glLoading ? (
					<p className="text-sm text-slate-500">Loading grade levels...</p>
				) : (
					<div className="overflow-x-auto rounded-lg border">
						<table role="grid" className="w-full text-left text-sm">
							<thead className="border-b bg-slate-50">
								{glTable.getHeaderGroups().map((hg) => (
									<tr key={hg.id}>
										{hg.headers.map((header) => (
											<th key={header.id} className="px-4 py-3 font-medium text-slate-600">
												{flexRender(header.column.columnDef.header, header.getContext())}
											</th>
										))}
									</tr>
								))}
							</thead>
							<tbody>
								{glTable.getRowModel().rows.map((row) => (
									<tr
										key={row.id}
										className="cursor-pointer border-b last:border-0 hover:bg-slate-50"
										onClick={() => {
											setEditingGl(row.original);
											setGlPanelOpen(true);
										}}
									>
										{row.getVisibleCells().map((cell) => (
											<td key={cell.id} className="px-4 py-3">
												{flexRender(cell.column.columnDef.cell, cell.getContext())}
											</td>
										))}
									</tr>
								))}
								{glTable.getRowModel().rows.length === 0 && (
									<tr>
										<td colSpan={glColumns.length} className="px-4 py-6 text-center text-slate-500">
											No grade levels found
										</td>
									</tr>
								)}
							</tbody>
						</table>
					</div>
				)}
			</section>

			<AcademicYearSidePanel
				open={ayPanelOpen}
				onClose={() => setAyPanelOpen(false)}
				academicYear={editingAy}
			/>

			<GradeLevelSidePanel
				open={glPanelOpen}
				onClose={() => setGlPanelOpen(false)}
				gradeLevel={editingGl}
			/>
		</div>
	);
}

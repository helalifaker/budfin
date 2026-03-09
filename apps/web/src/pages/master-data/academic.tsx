import { useEffect, useMemo, useState } from 'react';
import {
	createColumnHelper,
	flexRender,
	getCoreRowModel,
	useReactTable,
} from '@tanstack/react-table';
import { Pencil } from 'lucide-react';
import { useAcademicYears, type AcademicYear } from '../../hooks/use-academic-years';
import { useGradeLevels, type GradeLevel, type GradeBand } from '../../hooks/use-grade-levels';
import { useAuthStore } from '../../stores/auth-store';
import { AcademicYearSidePanel } from '../../components/master-data/academic-year-side-panel';
import { GradeLevelSidePanel } from '../../components/master-data/grade-level-side-panel';
import { cn } from '../../lib/cn';
import { Button } from '../../components/ui/button';
import { TableSkeleton } from '../../components/ui/skeleton';

function formatDate(iso: string): string {
	if (!iso) return '-';
	const datePart = iso.split('T')[0] ?? iso;
	const [year, month, day] = datePart.split('-');
	return `${day}/${month}/${year}`;
}

const BAND_STYLES: Record<GradeBand, string> = {
	MATERNELLE: 'bg-(--badge-maternelle-bg) text-(--badge-maternelle)',
	ELEMENTAIRE: 'bg-(--badge-elementaire-bg) text-(--badge-elementaire)',
	COLLEGE: 'bg-(--badge-college-bg) text-(--badge-college)',
	LYCEE: 'bg-(--badge-lycee-bg) text-(--badge-lycee)',
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

	// 200ms-delayed skeletons
	const [showAySkeleton, setShowAySkeleton] = useState(false);
	const [showGlSkeleton, setShowGlSkeleton] = useState(false);

	useEffect(() => {
		if (!ayLoading) {
			setShowAySkeleton(false);
			return;
		}
		const t = setTimeout(() => setShowAySkeleton(true), 200);
		return () => clearTimeout(t);
	}, [ayLoading]);

	useEffect(() => {
		if (!glLoading) {
			setShowGlSkeleton(false);
			return;
		}
		const t = setTimeout(() => setShowGlSkeleton(true), 200);
		return () => clearTimeout(t);
	}, [glLoading]);

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
					<Button
						variant="ghost"
						size="icon"
						aria-label={`Edit ${row.original.fiscalYear}`}
						onClick={(e) => {
							e.stopPropagation();
							setEditingAy(row.original);
							setAyPanelOpen(true);
						}}
					>
						<Pencil className="h-4 w-4 text-(--text-muted)" />
					</Button>
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
								'inline-block rounded-sm px-2 py-0.5 text-(--text-xs) font-medium',
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
					<Button
						variant="ghost"
						size="icon"
						aria-label={`Edit ${row.original.gradeName}`}
						onClick={(e) => {
							e.stopPropagation();
							setEditingGl(row.original);
							setGlPanelOpen(true);
						}}
					>
						<Pencil className="h-4 w-4 text-(--text-muted)" />
					</Button>
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
					<h2 className="text-(--text-xl) font-semibold">Academic Years</h2>
					{isAdmin && (
						<Button
							type="button"
							onClick={() => {
								setEditingAy(null);
								setAyPanelOpen(true);
							}}
						>
							+ Add New
						</Button>
					)}
				</div>

				<div className="overflow-x-auto rounded-lg border">
					<table role="table" className="w-full text-left text-(--text-sm)">
						<thead className="border-b bg-(--workspace-bg-muted)">
							{ayTable.getHeaderGroups().map((hg) => (
								<tr key={hg.id}>
									{hg.headers.map((header) => (
										<th key={header.id} className="px-4 py-3 font-medium text-(--text-secondary)">
											{flexRender(header.column.columnDef.header, header.getContext())}
										</th>
									))}
								</tr>
							))}
						</thead>
						<tbody>
							{ayLoading && showAySkeleton ? (
								<TableSkeleton rows={5} cols={ayColumns.length} />
							) : ayTable.getRowModel().rows.length === 0 ? (
								<tr>
									<td
										colSpan={ayColumns.length}
										className="px-4 py-6 text-center text-(--text-muted)"
									>
										No academic years found
									</td>
								</tr>
							) : (
								ayTable.getRowModel().rows.map((row) => (
									<tr
										key={row.id}
										className="cursor-pointer border-b last:border-0 hover:bg-(--accent-50) transition-colors duration-(--duration-fast)"
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
								))
							)}
						</tbody>
					</table>
				</div>
			</section>

			{/* Grade Levels Section */}
			<section>
				<div className="pb-4">
					<h2 className="text-(--text-xl) font-semibold">Grade Levels</h2>
				</div>

				<div className="overflow-x-auto rounded-lg border">
					<table role="table" className="w-full text-left text-(--text-sm)">
						<thead className="border-b bg-(--workspace-bg-muted)">
							{glTable.getHeaderGroups().map((hg) => (
								<tr key={hg.id}>
									{hg.headers.map((header) => (
										<th key={header.id} className="px-4 py-3 font-medium text-(--text-secondary)">
											{flexRender(header.column.columnDef.header, header.getContext())}
										</th>
									))}
								</tr>
							))}
						</thead>
						<tbody>
							{glLoading && showGlSkeleton ? (
								<TableSkeleton rows={10} cols={glColumns.length} />
							) : glTable.getRowModel().rows.length === 0 ? (
								<tr>
									<td
										colSpan={glColumns.length}
										className="px-4 py-6 text-center text-(--text-muted)"
									>
										No grade levels found
									</td>
								</tr>
							) : (
								glTable.getRowModel().rows.map((row) => (
									<tr
										key={row.id}
										className="cursor-pointer border-b last:border-0 hover:bg-(--accent-50) transition-colors duration-(--duration-fast)"
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
								))
							)}
						</tbody>
					</table>
				</div>
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

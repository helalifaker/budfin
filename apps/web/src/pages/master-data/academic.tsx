import { useCallback, useMemo, useState } from 'react';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { useAcademicYears, type AcademicYear } from '../../hooks/use-academic-years';
import { useGradeLevels, type GradeLevel, type GradeBand } from '../../hooks/use-grade-levels';
import { useAuthStore } from '../../stores/auth-store';
import { AcademicYearSidePanel } from '../../components/master-data/academic-year-side-panel';
import { GradeLevelSidePanel } from '../../components/master-data/grade-level-side-panel';
import { cn } from '../../lib/cn';
import { ListGrid } from '../../components/data-grid/list-grid';
import { Button } from '../../components/ui/button';

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
				header: 'Template Max Class Size',
				cell: (info) => info.getValue(),
			}),
			glColumnHelper.accessor('plancherPct', {
				header: 'Template Plancher %',
				cell: (info) => info.getValue(),
			}),
			glColumnHelper.accessor('ciblePct', {
				header: 'Template Cible %',
				cell: (info) => info.getValue(),
			}),
			glColumnHelper.accessor('plafondPct', {
				header: 'Template Plafond %',
				cell: (info) => info.getValue(),
			}),
			glColumnHelper.accessor('displayOrder', {
				header: 'Order',
				cell: (info) => info.getValue(),
			}),
		],
		[]
	);

	const handleAyRowClick = useCallback((ay: AcademicYear) => {
		setEditingAy(ay);
		setAyPanelOpen(true);
	}, []);

	const handleGlRowClick = useCallback((gl: GradeLevel) => {
		setEditingGl(gl);
		setGlPanelOpen(true);
	}, []);

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
		<div className="space-y-6 p-6">
			{/* Academic Years Section */}
			<section>
				<div className="flex items-center justify-between pb-4">
					<h1 className="text-(--text-xl) font-semibold">Academic Years</h1>
					{isAdmin && (
						<Button
							type="button"
							onClick={() => {
								setEditingAy(null);
								setAyPanelOpen(true);
							}}
						>
							+ Add Year
						</Button>
					)}
				</div>

				<ListGrid
					table={ayTable}
					isLoading={ayLoading}
					onRowClick={handleAyRowClick}
					emptyState={
						<p className="text-(--text-sm) text-(--text-muted)">No academic years found</p>
					}
					ariaLabel="Academic years"
				/>
			</section>

			{/* Grade Levels Section */}
			<section>
				<div className="pb-4">
					<h1 className="text-(--text-xl) font-semibold">Grade Levels</h1>
				</div>

				<ListGrid
					table={glTable}
					isLoading={glLoading}
					onRowClick={handleGlRowClick}
					emptyState={<p className="text-(--text-sm) text-(--text-muted)">No grade levels found</p>}
					ariaLabel="Grade levels"
				/>
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

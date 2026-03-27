import { useCallback, useMemo, useState } from 'react';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { useGradeLevels } from '../../../hooks/use-grade-levels';
import type { GradeLevel, GradeBand } from '../../../hooks/use-grade-levels';
import { GradeLevelSidePanel } from '../../master-data/grade-level-side-panel';
import { ListGrid } from '../../data-grid/list-grid';
import { cn } from '../../../lib/cn';

const BAND_STYLES: Record<GradeBand, string> = {
	MATERNELLE: 'bg-(--badge-maternelle-bg) text-(--badge-maternelle)',
	ELEMENTAIRE: 'bg-(--badge-elementaire-bg) text-(--badge-elementaire)',
	COLLEGE: 'bg-(--badge-college-bg) text-(--badge-college)',
	LYCEE: 'bg-(--badge-lycee-bg) text-(--badge-lycee)',
};

const glColumnHelper = createColumnHelper<GradeLevel>();

export function GradesTabContent() {
	const { data: glData, isLoading: glLoading } = useGradeLevels();

	const [glPanelOpen, setGlPanelOpen] = useState(false);
	const [editingGl, setEditingGl] = useState<GradeLevel | null>(null);

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

	const handleGlRowClick = useCallback((gl: GradeLevel) => {
		setEditingGl(gl);
		setGlPanelOpen(true);
	}, []);

	const glTable = useReactTable({
		data: glData?.gradeLevels ?? [],
		columns: glColumns,
		getCoreRowModel: getCoreRowModel(),
	});

	return (
		<div className="space-y-4">
			{/* Data table */}
			<ListGrid
				table={glTable}
				isLoading={glLoading}
				onRowClick={handleGlRowClick}
				emptyState={<p className="text-(--text-sm) text-(--text-muted)">No grade levels found</p>}
				ariaLabel="Grade levels"
			/>

			{/* Side panel */}
			<GradeLevelSidePanel
				open={glPanelOpen}
				onClose={() => setGlPanelOpen(false)}
				gradeLevel={editingGl}
			/>
		</div>
	);
}

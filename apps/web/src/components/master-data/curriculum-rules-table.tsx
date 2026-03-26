import { useMemo, useState } from 'react';
import {
	createColumnHelper,
	getCoreRowModel,
	getFilteredRowModel,
	useReactTable,
} from '@tanstack/react-table';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { cn } from '../../lib/cn';
import type { DhgRuleDetail } from '../../hooks/use-master-data';
import type { GradeLevel } from '../../hooks/use-grade-levels';
import { Input } from '../ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select';
import {
	DropdownMenu,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
} from '../ui/dropdown-menu';
import { useDelayedSkeleton } from '../../hooks/use-delayed-skeleton';
import { PlanningGrid } from '../data-grid/planning-grid';

// ── Constants ────────────────────────────────────────────────────────────────

const BAND_LABELS: Record<string, string> = {
	MATERNELLE: 'Maternelle',
	ELEMENTAIRE: 'Elementaire',
	COLLEGE: 'College',
	LYCEE: 'Lycee',
};

const BAND_STYLES: Record<string, { color: string; bg: string }> = {
	MATERNELLE: { color: 'var(--badge-maternelle)', bg: 'var(--badge-maternelle-bg)' },
	ELEMENTAIRE: { color: 'var(--badge-elementaire)', bg: 'var(--badge-elementaire-bg)' },
	COLLEGE: { color: 'var(--badge-college)', bg: 'var(--badge-college-bg)' },
	LYCEE: { color: 'var(--badge-lycee)', bg: 'var(--badge-lycee-bg)' },
};

const LINE_TYPE_STYLES: Record<string, string> = {
	STRUCTURAL: 'bg-(--accent-50) text-(--accent-700)',
	HOST_COUNTRY: 'bg-(--color-warning-bg) text-(--color-warning)',
	AUTONOMY: 'bg-(--badge-profit-center-bg) text-(--badge-profit-center)',
	SPECIALTY: 'bg-(--color-success-bg) text-(--color-success)',
};

const BAND_ORDER = ['MATERNELLE', 'ELEMENTAIRE', 'COLLEGE', 'LYCEE'];

// ── Types ────────────────────────────────────────────────────────────────────

type RuleWithBand = DhgRuleDetail & { band: string };

export type CurriculumRulesTableProps = {
	rules: DhgRuleDetail[];
	gradeLevels: GradeLevel[];
	isAdmin: boolean;
	isLoading: boolean;
	onEdit: (rule: DhgRuleDetail) => void;
	onDelete: (rule: DhgRuleDetail) => void;
};

// ── Column helper ────────────────────────────────────────────────────────────

const columnHelper = createColumnHelper<RuleWithBand>();

// ── Component ────────────────────────────────────────────────────────────────

export function CurriculumRulesTable({
	rules,
	gradeLevels,
	isAdmin,
	isLoading,
	onEdit,
	onDelete,
}: CurriculumRulesTableProps) {
	const [search, setSearch] = useState('');
	const [bandFilter, setBandFilter] = useState('ALL');
	const [lineTypeFilter, setLineTypeFilter] = useState('ALL');

	// Build grade-to-band lookup
	const gradeToBand = useMemo(() => {
		const map = new Map<string, string>();
		for (const gl of gradeLevels) {
			map.set(gl.gradeCode, gl.band);
		}
		return map;
	}, [gradeLevels]);

	// Grade display order lookup
	const gradeOrder = useMemo(() => {
		const map = new Map<string, number>();
		for (const gl of gradeLevels) {
			map.set(gl.gradeCode, gl.displayOrder);
		}
		return map;
	}, [gradeLevels]);

	// Enrich rules with band and apply filters
	const enrichedRules = useMemo(() => {
		return rules
			.map(
				(r): RuleWithBand => ({
					...r,
					band: gradeToBand.get(r.gradeLevel) ?? 'UNKNOWN',
				})
			)
			.filter((r) => {
				if (bandFilter !== 'ALL' && r.band !== bandFilter) return false;
				if (lineTypeFilter !== 'ALL' && r.lineType !== lineTypeFilter) return false;
				return true;
			})
			.sort((a, b) => {
				const bandA = BAND_ORDER.indexOf(a.band);
				const bandB = BAND_ORDER.indexOf(b.band);
				if (bandA !== bandB) return bandA - bandB;
				const gradeA = gradeOrder.get(a.gradeLevel) ?? 0;
				const gradeB = gradeOrder.get(b.gradeLevel) ?? 0;
				if (gradeA !== gradeB) return gradeA - gradeB;
				return a.disciplineName.localeCompare(b.disciplineName);
			});
	}, [rules, gradeToBand, gradeOrder, bandFilter, lineTypeFilter]);

	const columns = useMemo(
		() => [
			columnHelper.accessor('gradeLevel', {
				header: 'Grade',
				cell: (info) => <span className="font-mono font-medium">{info.getValue()}</span>,
			}),
			columnHelper.accessor('disciplineName', {
				header: 'Discipline',
			}),
			columnHelper.accessor('lineType', {
				header: 'Line Type',
				cell: (info) => {
					const val = info.getValue();
					return (
						<span
							className={cn(
								'inline-block rounded-sm px-2 py-0.5 text-(--text-xs) font-medium',
								LINE_TYPE_STYLES[val] ?? 'bg-(--workspace-bg-muted) text-(--text-secondary)'
							)}
						>
							{val.replace('_', ' ')}
						</span>
					);
				},
			}),
			columnHelper.accessor('driverType', {
				header: 'Driver',
				cell: (info) => (
					<span className="inline-block rounded-sm bg-(--workspace-bg-muted) px-2 py-0.5 text-(--text-xs) font-medium">
						{info.getValue()}
					</span>
				),
			}),
			columnHelper.accessor('hoursPerUnit', {
				header: 'Hours/Unit',
				cell: (info) => <span className="font-mono tabular-nums">{info.getValue()}</span>,
			}),
			columnHelper.accessor('serviceProfileName', {
				header: 'Service Profile',
			}),
			columnHelper.accessor('effectiveFromYear', {
				header: 'From',
				cell: (info) => <span className="font-mono tabular-nums">{info.getValue()}</span>,
			}),
			columnHelper.accessor('effectiveToYear', {
				header: 'To',
				cell: (info) => (
					<span className="font-mono tabular-nums">{info.getValue() ?? '\u2014'}</span>
				),
			}),
			columnHelper.display({
				id: 'actions',
				header: '',
				cell: ({ row }) => {
					if (!isAdmin) return null;
					const item = row.original;
					return (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<button
									type="button"
									className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-(--workspace-bg-muted)"
									aria-label={`Actions for ${item.gradeLevel}-${item.disciplineCode}`}
								>
									<MoreHorizontal className="h-4 w-4 text-(--text-muted)" />
								</button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem onSelect={() => onEdit(item)}>
									<Pencil className="h-4 w-4" /> Edit
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem destructive onSelect={() => onDelete(item)}>
									<Trash2 className="h-4 w-4" /> Delete
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					);
				},
			}),
		],
		[isAdmin, onEdit, onDelete]
	);

	const table = useReactTable({
		data: enrichedRules,
		columns,
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		state: { globalFilter: search },
		onGlobalFilterChange: setSearch,
	});

	const _showSkeleton = useDelayedSkeleton(isLoading);

	const numericColumns = useMemo(
		() => ['hoursPerUnit', 'effectiveFromYear', 'effectiveToYear'],
		[]
	);

	return (
		<div className="space-y-3">
			{/* Filter bar */}
			<div className="flex flex-wrap items-center gap-3">
				<div>
					<label htmlFor="rules-search" className="sr-only">
						Search rules
					</label>
					<Input
						id="rules-search"
						type="text"
						placeholder="Search..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="w-48"
					/>
				</div>
				<Select value={bandFilter} onValueChange={setBandFilter}>
					<SelectTrigger className="w-40" aria-label="Filter by band">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="ALL">All Bands</SelectItem>
						{BAND_ORDER.map((b) => (
							<SelectItem key={b} value={b}>
								{BAND_LABELS[b]}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Select value={lineTypeFilter} onValueChange={setLineTypeFilter}>
					<SelectTrigger className="w-40" aria-label="Filter by line type">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="ALL">All Types</SelectItem>
						<SelectItem value="STRUCTURAL">Structural</SelectItem>
						<SelectItem value="HOST_COUNTRY">Host Country</SelectItem>
						<SelectItem value="AUTONOMY">Autonomy</SelectItem>
						<SelectItem value="SPECIALTY">Specialty</SelectItem>
					</SelectContent>
				</Select>
			</div>

			{/* Grouped grid */}
			<PlanningGrid
				table={table}
				variant="compact"
				isLoading={isLoading}
				bandGrouping={{
					getBand: (row: RuleWithBand) => row.band,
					bandLabels: BAND_LABELS,
					bandStyles: BAND_STYLES,
					collapsible: true,
				}}
				numericColumns={numericColumns}
				keyboardNavigation={false}
				rowAnimation={false}
				rangeSelection
				clipboardEnabled
				ariaLabel="Curriculum rules"
			/>
		</div>
	);
}

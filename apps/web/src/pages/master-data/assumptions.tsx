import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuthStore } from '../../stores/auth-store';
import { useAssumptions, useUpdateAssumptions, type Assumption } from '../../hooks/use-assumptions';
import { ChevronRight, Calculator } from 'lucide-react';
import { cn } from '../../lib/cn';
import { Input } from '../../components/ui/input';
import { TableSkeleton } from '../../components/ui/skeleton';
import { toast } from '../../components/ui/toast-state';

const SECTION_ORDER = ['tax', 'financial', 'social_charges', 'academic', 'fees'] as const;

const SECTION_LABELS: Record<string, string> = {
	tax: 'Tax',
	financial: 'Financial',
	social_charges: 'Social Charges',
	academic: 'Academic',
	fees: 'Fees',
};

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface CellSaveStatus {
	status: SaveStatus;
	timerId?: ReturnType<typeof setTimeout>;
}

export function AssumptionsPage() {
	const { data, isLoading } = useAssumptions();
	const updateMutation = useUpdateAssumptions();
	const user = useAuthStore((s) => s.user);
	const canEdit = user?.role !== 'Viewer';

	const [editingKey, setEditingKey] = useState<string | null>(null);
	const [editValue, setEditValue] = useState('');
	const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
	const [saveStatuses, setSaveStatuses] = useState<Record<string, CellSaveStatus>>({});
	const inputRef = useRef<HTMLInputElement>(null);

	const assumptions = data?.assumptions;
	const grouped = useMemo(() => {
		if (!assumptions) return new Map<string, Assumption[]>();
		const map = new Map<string, Assumption[]>();
		for (const section of SECTION_ORDER) {
			const items = assumptions.filter((a) => a.section === section);
			if (items.length > 0) {
				map.set(section, items);
			}
		}
		return map;
	}, [assumptions]);

	const editableKeys = useMemo(() => {
		if (!assumptions) return new Set<string>();
		return new Set(assumptions.map((a) => a.key));
	}, [assumptions]);

	useEffect(() => {
		if (editingKey && inputRef.current) {
			inputRef.current.focus();
			inputRef.current.select();
		}
	}, [editingKey]);

	const startEdit = useCallback(
		(assumption: Assumption) => {
			if (!canEdit) return;
			setEditingKey(assumption.key);
			setEditValue(assumption.value);
		},
		[canEdit]
	);

	const cancelEdit = useCallback(() => {
		setEditingKey(null);
		setEditValue('');
	}, []);

	const saveEdit = useCallback(
		(key: string, value: string, version: number) => {
			const original = data?.assumptions.find((a) => a.key === key);
			if (original && original.value === value) {
				setEditingKey(null);
				return;
			}

			setSaveStatuses((prev) => {
				if (prev[key]?.timerId) clearTimeout(prev[key].timerId);
				return { ...prev, [key]: { status: 'saving' } };
			});

			updateMutation.mutate([{ key, value, version }], {
				onSuccess: () => {
					setSaveStatuses((prev) => {
						const timerId = setTimeout(() => {
							setSaveStatuses((p) => ({
								...p,
								[key]: { status: 'idle' },
							}));
						}, 2000);
						return {
							...prev,
							[key]: { status: 'saved', timerId },
						};
					});
					toast.success('Assumption updated');
				},
				onError: () => {
					setSaveStatuses((prev) => ({
						...prev,
						[key]: { status: 'error' },
					}));
					toast.error('Failed to update assumption');
				},
			});
			setEditingKey(null);
		},
		[data?.assumptions, updateMutation]
	);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent, assumption: Assumption) => {
			if (e.key === 'Enter' || e.key === 'Tab') {
				e.preventDefault();
				saveEdit(assumption.key, editValue, assumption.version);

				if (e.key === 'Tab') {
					const allKeys = Array.from(editableKeys);
					const idx = allKeys.indexOf(assumption.key);
					const nextKey = allKeys[idx + 1];
					if (nextKey) {
						const next = data?.assumptions.find((a) => a.key === nextKey);
						if (next) {
							const nextSection = next.section;
							setCollapsedSections((prev) => {
								const updated = new Set(prev);
								updated.delete(nextSection);
								return updated;
							});
							setTimeout(() => startEdit(next), 0);
						}
					}
				}
			} else if (e.key === 'Escape') {
				cancelEdit();
			}
		},
		[editValue, editableKeys, data?.assumptions, saveEdit, cancelEdit, startEdit]
	);

	const toggleSection = useCallback((section: string) => {
		setCollapsedSections((prev) => {
			const updated = new Set(prev);
			if (updated.has(section)) {
				updated.delete(section);
			} else {
				updated.add(section);
			}
			return updated;
		});
	}, []);

	const renderSaveStatus = useCallback(
		(key: string) => {
			const cellStatus = saveStatuses[key];
			if (!cellStatus || cellStatus.status === 'idle') return null;

			return (
				<span
					aria-live="polite"
					className={cn(
						'text-(--text-xs)',
						cellStatus.status === 'saving' && 'text-(--text-muted)',
						cellStatus.status === 'saved' && 'text-(--color-success)',
						cellStatus.status === 'error' && 'text-(--color-error)'
					)}
				>
					{cellStatus.status === 'saving' && 'Saving...'}
					{cellStatus.status === 'saved' && 'Saved'}
					{cellStatus.status === 'error' && 'Error'}
				</span>
			);
		},
		[saveStatuses]
	);

	// 200ms-delayed skeleton
	const [showSkeleton, setShowSkeleton] = useState(false);
	useEffect(() => {
		if (!isLoading) {
			// eslint-disable-next-line react-hooks/set-state-in-effect -- reset skeleton visibility to sync with loading prop; intentional
			setShowSkeleton(false);
			return;
		}
		const t = setTimeout(() => setShowSkeleton(true), 200);
		return () => clearTimeout(t);
	}, [isLoading]);

	if (isLoading && !showSkeleton) {
		return (
			<div className="p-6">
				<h1 className="text-(--text-xl) font-semibold">Assumptions &amp; Parameters</h1>
			</div>
		);
	}

	if (isLoading && showSkeleton) {
		return (
			<div className="p-6">
				<h1 className="text-(--text-xl) font-semibold pb-4">Assumptions &amp; Parameters</h1>
				<div className="overflow-x-auto rounded-lg border">
					<table role="table" className="w-full text-left text-(--text-sm)">
						<thead className="border-b bg-(--workspace-bg-muted)">
							<tr>
								<th className="w-[40%] px-4 py-3 font-medium text-(--text-secondary)">Label</th>
								<th className="w-[30%] px-4 py-3 font-medium text-(--text-secondary)">Value</th>
								<th className="w-[15%] px-4 py-3 font-medium text-(--text-secondary)">Unit</th>
								<th className="w-[15%] px-4 py-3 font-medium text-(--text-secondary)">Status</th>
							</tr>
						</thead>
						<tbody>
							<TableSkeleton rows={15} cols={4} />
						</tbody>
					</table>
				</div>
			</div>
		);
	}

	return (
		<div className="p-6">
			<h1 className="text-(--text-xl) font-semibold pb-4">Assumptions &amp; Parameters</h1>

			<div className="overflow-x-auto rounded-lg border">
				<table role="table" className="w-full text-left text-(--text-sm)">
					<thead className="border-b bg-(--workspace-bg-muted)">
						<tr>
							<th className="w-[40%] px-4 py-3 font-medium text-(--text-secondary)">Label</th>
							<th className="w-[30%] px-4 py-3 font-medium text-(--text-secondary)">Value</th>
							<th className="w-[15%] px-4 py-3 font-medium text-(--text-secondary)">Unit</th>
							<th className="w-[15%] px-4 py-3 font-medium text-(--text-secondary)">Status</th>
						</tr>
					</thead>
					<tbody>
						{Array.from(grouped.entries()).map(([section, sectionAssumptions]) => {
							const isCollapsed = collapsedSections.has(section);
							return (
								<SectionGroup
									key={section}
									section={section}
									assumptions={sectionAssumptions}
									isCollapsed={isCollapsed}
									onToggle={() => toggleSection(section)}
									editingKey={editingKey}
									editValue={editValue}
									canEdit={canEdit}
									onStartEdit={startEdit}
									onEditValueChange={setEditValue}
									onKeyDown={handleKeyDown}
									onBlur={(a) => saveEdit(a.key, editValue, a.version)}
									renderSaveStatus={renderSaveStatus}
									{...(section === 'social_charges' && data?.computed.gosiRateTotal
										? {
												gosiRateTotal: data.computed.gosiRateTotal,
											}
										: {})}
									inputRef={inputRef}
								/>
							);
						})}
					</tbody>
				</table>
			</div>
		</div>
	);
}

interface SectionGroupProps {
	section: string;
	assumptions: Assumption[];
	isCollapsed: boolean;
	onToggle: () => void;
	editingKey: string | null;
	editValue: string;
	canEdit: boolean;
	onStartEdit: (a: Assumption) => void;
	onEditValueChange: (v: string) => void;
	onKeyDown: (e: React.KeyboardEvent, a: Assumption) => void;
	onBlur: (a: Assumption) => void;
	renderSaveStatus: (key: string) => React.ReactNode;
	gosiRateTotal?: string;
	inputRef: React.RefObject<HTMLInputElement | null>;
}

function SectionGroup({
	section,
	assumptions,
	isCollapsed,
	onToggle,
	editingKey,
	editValue,
	canEdit,
	onStartEdit,
	onEditValueChange,
	onKeyDown,
	onBlur,
	renderSaveStatus,
	gosiRateTotal,
	inputRef,
}: SectionGroupProps) {
	return (
		<>
			<tr
				className="cursor-pointer bg-(--workspace-bg-muted) hover:bg-(--accent-100) transition-colors duration-(--duration-fast)"
				onClick={onToggle}
				onKeyDown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						onToggle();
					}
				}}
				tabIndex={0}
				aria-expanded={!isCollapsed}
			>
				<td colSpan={4} className="px-4 py-2 font-semibold text-(--text-primary)">
					<ChevronRight
						className={cn(
							'mr-2 inline-block h-4 w-4 transition-transform duration-(--duration-fast)',
							!isCollapsed && 'rotate-90'
						)}
						aria-hidden="true"
					/>
					{SECTION_LABELS[section] ?? section}
				</td>
			</tr>

			{!isCollapsed &&
				assumptions.map((assumption) => (
					<tr
						key={assumption.key}
						className="border-b last:border-0 hover:bg-(--accent-50) transition-colors duration-(--duration-fast)"
					>
						<td className="px-4 py-3 text-(--text-primary)">{assumption.label}</td>
						<td
							className={cn('px-4 py-3', canEdit && 'cursor-pointer bg-(--cell-editable-bg)')}
							onClick={() => onStartEdit(assumption)}
						>
							{editingKey === assumption.key ? (
								<Input
									ref={inputRef}
									type="text"
									value={editValue}
									onChange={(e) => onEditValueChange(e.target.value)}
									onKeyDown={(e) => onKeyDown(e, assumption)}
									onBlur={() => onBlur(assumption)}
									className="h-8 border-(--accent-400) focus:ring-(--accent-300)"
									aria-label={`Edit ${assumption.label}`}
								/>
							) : (
								<span>{assumption.value}</span>
							)}
						</td>
						<td className="px-4 py-3 text-(--text-muted)">{assumption.unit}</td>
						<td className="px-4 py-3">{renderSaveStatus(assumption.key)}</td>
					</tr>
				))}

			{!isCollapsed && gosiRateTotal !== undefined && (
				<tr className="border-b last:border-0">
					<td className="px-4 py-3 bg-(--workspace-bg-muted) font-medium text-(--text-primary)">
						<span className="inline-flex items-center gap-2">
							<CalculatorIcon />
							GOSI Total Rate
						</span>
					</td>
					<td className="px-4 py-3 bg-(--workspace-bg-muted) font-medium">{gosiRateTotal}</td>
					<td className="px-4 py-3 bg-(--workspace-bg-muted) text-(--text-muted)">%</td>
					<td className="px-4 py-3 bg-(--workspace-bg-muted)" />
				</tr>
			)}
		</>
	);
}

function CalculatorIcon() {
	return <Calculator className="h-4 w-4 text-(--text-muted)" aria-hidden="true" />;
}

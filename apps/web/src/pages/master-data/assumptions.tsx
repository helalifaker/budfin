import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuthStore } from '../../stores/auth-store';
import { useAssumptions, useUpdateAssumptions, type Assumption } from '../../hooks/use-assumptions';
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
						'text-xs',
						cellStatus.status === 'saving' && 'text-slate-500',
						cellStatus.status === 'saved' && 'text-green-600',
						cellStatus.status === 'error' && 'text-red-600'
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
				<h1 className="text-xl font-semibold">Assumptions &amp; Parameters</h1>
			</div>
		);
	}

	if (isLoading && showSkeleton) {
		return (
			<div className="p-6">
				<h1 className="text-xl font-semibold pb-4">Assumptions &amp; Parameters</h1>
				<div className="overflow-x-auto rounded-lg border">
					<table role="table" className="w-full text-left text-sm">
						<thead className="border-b bg-slate-50">
							<tr>
								<th className="w-[40%] px-4 py-3 font-medium text-slate-600">Label</th>
								<th className="w-[30%] px-4 py-3 font-medium text-slate-600">Value</th>
								<th className="w-[15%] px-4 py-3 font-medium text-slate-600">Unit</th>
								<th className="w-[15%] px-4 py-3 font-medium text-slate-600">Status</th>
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
			<h1 className="text-xl font-semibold pb-4">Assumptions &amp; Parameters</h1>

			<div className="overflow-x-auto rounded-lg border">
				<table role="table" className="w-full text-left text-sm">
					<thead className="border-b bg-slate-50">
						<tr>
							<th className="w-[40%] px-4 py-3 font-medium text-slate-600">Label</th>
							<th className="w-[30%] px-4 py-3 font-medium text-slate-600">Value</th>
							<th className="w-[15%] px-4 py-3 font-medium text-slate-600">Unit</th>
							<th className="w-[15%] px-4 py-3 font-medium text-slate-600">Status</th>
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
				className="cursor-pointer bg-slate-100 hover:bg-slate-200"
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
				<td colSpan={4} className="px-4 py-2 font-semibold text-slate-700">
					<span className="mr-2 inline-block w-4 text-center">
						{isCollapsed ? '\u25B6' : '\u25BC'}
					</span>
					{SECTION_LABELS[section] ?? section}
				</td>
			</tr>

			{!isCollapsed &&
				assumptions.map((assumption) => (
					<tr key={assumption.key} className="border-b last:border-0 hover:bg-slate-50">
						<td className="px-4 py-3 text-slate-700">{assumption.label}</td>
						<td
							className={cn('px-4 py-3', canEdit && 'cursor-pointer bg-yellow-50')}
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
									className="h-8 border-blue-400 focus:ring-blue-300"
									aria-label={`Edit ${assumption.label}`}
								/>
							) : (
								<span>{assumption.value}</span>
							)}
						</td>
						<td className="px-4 py-3 text-slate-500">{assumption.unit}</td>
						<td className="px-4 py-3">{renderSaveStatus(assumption.key)}</td>
					</tr>
				))}

			{!isCollapsed && gosiRateTotal !== undefined && (
				<tr className="border-b last:border-0">
					<td className="px-4 py-3 bg-gray-100 font-medium text-slate-700">
						<span className="inline-flex items-center gap-2">
							<CalculatorIcon />
							GOSI Total Rate
						</span>
					</td>
					<td className="px-4 py-3 bg-gray-100 font-medium">{gosiRateTotal}</td>
					<td className="px-4 py-3 bg-gray-100 text-slate-500">%</td>
					<td className="px-4 py-3 bg-gray-100" />
				</tr>
			)}
		</>
	);
}

function CalculatorIcon() {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 20 20"
			fill="currentColor"
			className="h-4 w-4 text-slate-400"
			aria-hidden="true"
		>
			<path
				fillRule="evenodd"
				d="M10 1a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 1zM5.05 3.05a.75.75 0 011.06 0l1.062 1.06a.75.75 0 11-1.06 1.061L5.05 4.111a.75.75 0 010-1.06zm9.9 0a.75.75 0 010 1.06l-1.06 1.061a.75.75 0 01-1.061-1.06l1.06-1.06a.75.75 0 011.06 0zM3 8a7 7 0 1114 0A7 7 0 013 8zm8 1a1 1 0 11-2 0 1 1 0 012 0zM7.084 8.71a.75.75 0 10-1.168-.94 5.526 5.526 0 00-.502.847.75.75 0 001.326.702 4.026 4.026 0 01.344-.609zm6.832-.94a.75.75 0 10-1.168.94c.142.177.26.38.344.61a.75.75 0 101.326-.702 5.527 5.527 0 00-.502-.848z"
				clipRule="evenodd"
			/>
		</svg>
	);
}

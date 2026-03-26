import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import {
	LayoutDashboard,
	UserRound,
	DollarSign,
	Briefcase,
	BarChart2,
	GitBranch,
	Receipt,
	Calculator,
	Printer,
	Search,
	TrendingUp,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Dialog, DialogContent } from '../ui/dialog';
import { useHotkey } from '../../lib/hotkeys';
import { cn } from '../../lib/cn';

// ── Command Definitions ─────────────────────────────────────────────────────

interface Command {
	id: string;
	label: string;
	icon: LucideIcon;
	group: 'navigate' | 'action';
	action: () => void;
}

function useCommands(): Command[] {
	const navigate = useNavigate();

	return useMemo(
		() => [
			// Navigation commands
			{
				id: 'nav-dashboard',
				label: 'Go to Dashboard',
				icon: LayoutDashboard,
				group: 'navigate' as const,
				action: () => navigate('/planning'),
			},
			{
				id: 'nav-enrollment',
				label: 'Go to Enrollment',
				icon: UserRound,
				group: 'navigate' as const,
				action: () => navigate('/planning/enrollment'),
			},
			{
				id: 'nav-revenue',
				label: 'Go to Revenue',
				icon: DollarSign,
				group: 'navigate' as const,
				action: () => navigate('/planning/revenue'),
			},
			{
				id: 'nav-staffing',
				label: 'Go to Staffing',
				icon: Briefcase,
				group: 'navigate' as const,
				action: () => navigate('/planning/staffing'),
			},
			{
				id: 'nav-opex',
				label: 'Go to Operating Expenses',
				icon: Receipt,
				group: 'navigate' as const,
				action: () => navigate('/planning/opex'),
			},
			{
				id: 'nav-pnl',
				label: 'Go to P&L',
				icon: BarChart2,
				group: 'navigate' as const,
				action: () => navigate('/planning/pnl'),
			},
			{
				id: 'nav-scenarios',
				label: 'Go to Scenarios',
				icon: GitBranch,
				group: 'navigate' as const,
				action: () => navigate('/planning/scenarios'),
			},
			{
				id: 'nav-trends',
				label: 'Go to Trends (Dashboard)',
				icon: TrendingUp,
				group: 'navigate' as const,
				action: () => navigate('/planning'),
			},
			// Action commands
			{
				id: 'action-print',
				label: 'Print Current View',
				icon: Printer,
				group: 'action' as const,
				action: () => window.print(),
			},
			{
				id: 'action-calculate',
				label: 'Calculate (trigger from module page)',
				icon: Calculator,
				group: 'action' as const,
				action: () => {
					// Find and click the Calculate button on the current page
					const btn = document.querySelector<HTMLButtonElement>('[data-calculate-button]');
					if (btn && !btn.disabled) btn.click();
				},
			},
		],
		[navigate]
	);
}

// ── Command Palette Component ───────────────────────────────────────────────

export function CommandPalette() {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState('');
	const [selectedIndex, setSelectedIndex] = useState(0);
	const inputRef = useRef<HTMLInputElement>(null);
	const listRef = useRef<HTMLDivElement>(null);

	const commands = useCommands();

	// Register Cmd+K hotkey
	useHotkey('meta+k', () => setOpen(true));

	// Reset state when dialog opens/closes
	useEffect(() => {
		if (open) {
			setQuery('');
			setSelectedIndex(0);
			// Focus input after dialog animation
			requestAnimationFrame(() => {
				inputRef.current?.focus();
			});
		}
	}, [open]);

	// Filter commands by query
	const filtered = useMemo(() => {
		if (!query.trim()) return commands;
		const q = query.toLowerCase();
		return commands.filter((cmd) => cmd.label.toLowerCase().includes(q));
	}, [commands, query]);

	// Group filtered commands
	const groups = useMemo(() => {
		const navCommands = filtered.filter((c) => c.group === 'navigate');
		const actionCommands = filtered.filter((c) => c.group === 'action');
		const result: Array<{ label: string; commands: Command[] }> = [];
		if (navCommands.length > 0) result.push({ label: 'Navigate', commands: navCommands });
		if (actionCommands.length > 0) result.push({ label: 'Actions', commands: actionCommands });
		return result;
	}, [filtered]);

	// Clamp selected index
	useEffect(() => {
		if (selectedIndex >= filtered.length) {
			setSelectedIndex(Math.max(0, filtered.length - 1));
		}
	}, [filtered.length, selectedIndex]);

	const executeCommand = useCallback((cmd: Command) => {
		setOpen(false);
		// Defer to let dialog close first
		requestAnimationFrame(() => {
			cmd.action();
		});
	}, []);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === 'ArrowDown') {
				e.preventDefault();
				setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
			} else if (e.key === 'ArrowUp') {
				e.preventDefault();
				setSelectedIndex((prev) => Math.max(prev - 1, 0));
			} else if (e.key === 'Enter') {
				e.preventDefault();
				const cmd = filtered[selectedIndex];
				if (cmd) executeCommand(cmd);
			}
		},
		[executeCommand, filtered, selectedIndex]
	);

	// Scroll selected item into view
	useEffect(() => {
		const el = listRef.current?.querySelector('[data-selected="true"]');
		el?.scrollIntoView({ block: 'nearest' });
	}, [selectedIndex]);

	// Compute flat index for each command to map to selectedIndex
	let flatIndex = 0;

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogContent
				className="top-[20%] max-w-[520px] translate-y-0 p-0"
				onKeyDown={handleKeyDown}
			>
				{/* Search input */}
				<div className="flex items-center gap-2 border-b border-(--workspace-border) px-4 py-3">
					<Search className="h-4 w-4 shrink-0 text-(--text-muted)" aria-hidden="true" />
					<input
						ref={inputRef}
						type="text"
						value={query}
						onChange={(e) => {
							setQuery(e.target.value);
							setSelectedIndex(0);
						}}
						placeholder="Type a command or search..."
						className={cn(
							'flex-1 bg-transparent text-(--text-sm) text-(--text-primary)',
							'placeholder:text-(--text-muted)',
							'outline-none'
						)}
						aria-label="Search commands"
						role="combobox"
						aria-expanded={open}
						aria-controls="command-list"
						aria-activedescendant={
							filtered[selectedIndex] ? `cmd-${filtered[selectedIndex]!.id}` : undefined
						}
					/>
					<kbd
						className={cn(
							'inline-flex h-5 items-center rounded border border-(--workspace-border)',
							'bg-(--workspace-bg-subtle) px-1.5 text-(length:--text-2xs) font-medium text-(--text-muted)'
						)}
					>
						ESC
					</kbd>
				</div>

				{/* Command list */}
				<div
					ref={listRef}
					id="command-list"
					role="listbox"
					className="max-h-[320px] overflow-y-auto scrollbar-thin py-2"
				>
					{groups.length === 0 && (
						<div className="px-4 py-6 text-center text-(--text-sm) text-(--text-muted)">
							No matching commands.
						</div>
					)}
					{groups.map((group) => (
						<div key={group.label}>
							<div className="px-4 py-1.5 text-(--text-xs) font-medium uppercase tracking-wider text-(--text-muted)">
								{group.label}
							</div>
							{group.commands.map((cmd) => {
								const idx = flatIndex++;
								const isSelected = idx === selectedIndex;
								const Icon = cmd.icon;

								return (
									<button
										key={cmd.id}
										id={`cmd-${cmd.id}`}
										role="option"
										aria-selected={isSelected}
										data-selected={isSelected}
										onClick={() => executeCommand(cmd)}
										onMouseEnter={() => setSelectedIndex(idx)}
										className={cn(
											'flex w-full items-center gap-3 px-4 py-2',
											'text-left text-(--text-sm) text-(--text-primary)',
											'transition-colors duration-(--duration-fast)',
											isSelected && 'bg-(--accent-50) text-(--accent-700)'
										)}
									>
										<Icon
											className={cn(
												'h-4 w-4 shrink-0',
												isSelected ? 'text-(--accent-600)' : 'text-(--text-muted)'
											)}
											aria-hidden="true"
										/>
										<span className="flex-1 truncate">{cmd.label}</span>
									</button>
								);
							})}
						</div>
					))}
				</div>

				{/* Footer hint */}
				<div className="flex items-center gap-4 border-t border-(--workspace-border) px-4 py-2 text-(length:--text-xs) text-(--text-muted)">
					<span>
						<kbd className="rounded border border-(--workspace-border) bg-(--workspace-bg-subtle) px-1">
							{'\u2191'}
						</kbd>{' '}
						<kbd className="rounded border border-(--workspace-border) bg-(--workspace-bg-subtle) px-1">
							{'\u2193'}
						</kbd>{' '}
						navigate
					</span>
					<span>
						<kbd className="rounded border border-(--workspace-border) bg-(--workspace-bg-subtle) px-1">
							{'\u23CE'}
						</kbd>{' '}
						select
					</span>
					<span>
						<kbd className="rounded border border-(--workspace-border) bg-(--workspace-bg-subtle) px-1">
							esc
						</kbd>{' '}
						close
					</span>
				</div>
			</DialogContent>
		</Dialog>
	);
}

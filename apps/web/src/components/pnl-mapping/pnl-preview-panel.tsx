import type { PnlTemplateSection } from '../../hooks/use-pnl-templates';
import { cn } from '../../lib/cn';

export interface PnlPreviewPanelProps {
	sections: PnlTemplateSection[];
	selectedSectionKey: string | null;
	onSelectSection: (sectionKey: string) => void;
}

function getSectionSummary(section: PnlTemplateSection): string {
	if (section.isSubtotal) return '';
	const showCount = section.mappings.filter((m) => m.visibility === 'SHOW').length;
	const groupCount = section.mappings.filter((m) => m.visibility === 'GROUP').length;
	const total = section.mappings.length;
	if (total === 0) return 'No accounts';
	const parts: string[] = [];
	if (showCount > 0) parts.push(`${showCount} shown`);
	if (groupCount > 0) parts.push(`${groupCount} grouped`);
	return parts.join(', ');
}

export function PnlPreviewPanel({
	sections,
	selectedSectionKey,
	onSelectSection,
}: PnlPreviewPanelProps) {
	return (
		<div className="space-y-1" role="listbox" aria-label="P&L template sections">
			{sections.map((section) => {
				const isSelected = section.sectionKey === selectedSectionKey;

				if (section.isSubtotal) {
					return (
						<div
							key={section.sectionKey}
							role="option"
							aria-selected={isSelected}
							tabIndex={0}
							className={cn(
								'flex items-center justify-between',
								'rounded-md border-t-2 border-(--workspace-border)',
								'bg-(--workspace-bg-subtle) px-4 py-2',
								'font-semibold text-(--text-primary)',
								'cursor-pointer transition-colors duration-(--duration-fast)',
								'hover:bg-(--workspace-bg-muted)',
								isSelected && 'ring-2 ring-(--accent-500)'
							)}
							onClick={() => onSelectSection(section.sectionKey)}
							onKeyDown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									onSelectSection(section.sectionKey);
								}
							}}
						>
							<span className="text-(--text-sm) font-semibold">{section.displayLabel}</span>
						</div>
					);
				}

				const summary = getSectionSummary(section);

				return (
					<div
						key={section.sectionKey}
						role="option"
						aria-selected={isSelected}
						tabIndex={0}
						className={cn(
							'flex items-center justify-between',
							'rounded-md px-4 py-2.5',
							'cursor-pointer transition-colors duration-(--duration-fast)',
							'hover:bg-(--workspace-bg-muted)',
							isSelected && 'bg-(--accent-50) ring-2 ring-(--accent-500)',
							!isSelected && 'bg-(--workspace-bg-card)'
						)}
						onClick={() => onSelectSection(section.sectionKey)}
						onKeyDown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								onSelectSection(section.sectionKey);
							}
						}}
					>
						<div className="flex flex-col gap-0.5">
							<span className="text-(--text-sm) font-medium text-(--text-primary)">
								{section.displayLabel}
							</span>
							{summary && <span className="text-(--text-xs) text-(--text-muted)">{summary}</span>}
						</div>

						<span
							className={cn(
								'ml-3 text-(--text-xs) font-medium',
								section.signConvention === 'NEGATIVE'
									? 'text-(--color-error)'
									: 'text-(--color-success)'
							)}
						>
							{section.signConvention === 'NEGATIVE' ? 'NEG' : 'POS'}
						</span>
					</div>
				);
			})}
		</div>
	);
}

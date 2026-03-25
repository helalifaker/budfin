import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { getDefinition } from '../../lib/glossary';
import { cn } from '../../lib/cn';

interface InfoTooltipProps {
	/** The glossary term key to look up. */
	term: string;
	/** Optional override for the tooltip text (bypasses glossary lookup). */
	text?: string;
	/** Size of the info icon in pixels (default: 14). */
	size?: number;
	/** Additional CSS classes for the icon wrapper. */
	className?: string;
}

/**
 * Small (i) icon that displays a tooltip with the term's definition on hover.
 *
 * Looks up the term in the financial glossary. If `text` is provided, it is
 * used directly instead of the glossary lookup.
 */
export function InfoTooltip({ term, text, size = 14, className }: InfoTooltipProps) {
	const definition = text ?? getDefinition(term);
	if (!definition) return null;

	return (
		<Tooltip delayDuration={200}>
			<TooltipTrigger asChild>
				<button
					type="button"
					className={cn(
						'inline-flex shrink-0 items-center justify-center rounded-full',
						'text-(--text-muted) hover:text-(--accent-600)',
						'transition-colors duration-(--duration-fast)',
						'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-(--accent-500)',
						className
					)}
					aria-label={`Info: ${term}`}
				>
					<Info className="shrink-0" style={{ width: size, height: size }} aria-hidden="true" />
				</button>
			</TooltipTrigger>
			<TooltipContent side="top" className="max-w-[280px] text-xs leading-relaxed">
				<p>
					<span className="font-semibold">{term}:</span> {definition}
				</p>
			</TooltipContent>
		</Tooltip>
	);
}

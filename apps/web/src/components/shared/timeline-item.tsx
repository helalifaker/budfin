import type { ReactNode } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '../../lib/cn';

interface TimelineItemProps {
	icon: ReactNode;
	title: string;
	subtitle?: string | undefined;
	timestamp: string;
	className?: string;
}

export function TimelineItem({ icon, title, subtitle, timestamp, className }: TimelineItemProps) {
	const relativeTime = formatDistanceToNow(new Date(timestamp), { addSuffix: true });

	return (
		<div className={cn('flex gap-3 py-2', className)}>
			<div className="flex shrink-0 items-start pt-0.5 text-(--text-muted)">{icon}</div>
			<div className="min-w-0 flex-1">
				<p className="text-sm leading-snug text-(--text-primary)">{title}</p>
				{subtitle && <p className="mt-0.5 text-xs text-(--text-muted)">{subtitle}</p>}
				<p className="mt-0.5 text-xs text-(--text-muted)/60">{relativeTime}</p>
			</div>
		</div>
	);
}

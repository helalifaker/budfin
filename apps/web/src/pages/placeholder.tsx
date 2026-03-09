import { Clock } from 'lucide-react';
import { cn } from '../lib/cn';

interface PlaceholderPageProps {
	title: string;
	description: string;
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
	return (
		<div className="flex flex-1 flex-col items-center justify-center py-24 text-center animate-fade-in">
			<div
				className={cn(
					'flex h-14 w-14 items-center justify-center',
					'rounded-xl bg-(--accent-50)',
					'animate-slide-up'
				)}
			>
				<Clock className="h-7 w-7 text-(--accent-500)" strokeWidth={1.5} aria-hidden="true" />
			</div>
			<h1
				className={cn(
					'mt-5 text-(--text-xl) font-semibold text-(--text-primary)',
					'animate-slide-up'
				)}
				style={{ animationDelay: '100ms' }}
			>
				{title}
			</h1>
			<p
				className={cn('mt-2 max-w-sm text-(--text-sm) text-(--text-secondary)', 'animate-slide-up')}
				style={{ animationDelay: '150ms' }}
			>
				{description}
			</p>
			<div className="mt-4 animate-slide-up" style={{ animationDelay: '200ms' }}>
				<span
					className={cn(
						'inline-block text-(--text-sm) font-medium',
						'bg-gradient-to-r from-(--accent-400) via-(--accent-600) to-(--accent-400)',
						'bg-[length:200%_100%] bg-clip-text text-transparent',
						'animate-shimmer'
					)}
				>
					Coming soon
				</span>
			</div>
		</div>
	);
}

import * as React from 'react';
import { ToggleGroup as RadixToggleGroupNs } from 'radix-ui';
import { cn } from '../../lib/cn';

const RadixRoot = RadixToggleGroupNs.Root;
const RadixItem = RadixToggleGroupNs.Item;

export type ToggleGroupProps = React.ComponentPropsWithoutRef<typeof RadixRoot> & {
	className?: string;
};

export function ToggleGroup({ className, ...props }: ToggleGroupProps) {
	return (
		<RadixRoot
			{...props}
			className={cn(
				'flex rounded-[var(--radius-md)] border border-[var(--workspace-border)]',
				'bg-[var(--workspace-bg-subtle)]',
				className
			)}
		/>
	);
}

export type ToggleGroupItemProps = React.ComponentPropsWithoutRef<typeof RadixItem> & {
	className?: string;
};

export function ToggleGroupItem({ className, ...props }: ToggleGroupItemProps) {
	return (
		<RadixItem
			{...props}
			className={cn(
				'px-3 py-1.5 text-xs font-medium',
				'first:rounded-l-[var(--radius-md)] last:rounded-r-[var(--radius-md)]',
				'bg-transparent text-[var(--text-secondary)]',
				'hover:text-[var(--text-primary)]',
				'data-[state=on]:bg-[var(--accent-500)] data-[state=on]:text-white',
				'data-[state=on]:shadow-[var(--shadow-sm)]',
				'focus-visible:outline-none focus-visible:ring-2',
				'focus-visible:ring-[var(--accent-500)] focus-visible:ring-offset-2',
				'transition-all duration-[var(--duration-fast)]',
				className
			)}
		/>
	);
}

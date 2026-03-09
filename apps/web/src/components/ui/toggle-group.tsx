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
				'flex rounded-md border border-(--workspace-border)',
				'bg-(--workspace-bg-subtle)',
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
				'first:rounded-l-(--radius-md) last:rounded-r-(--radius-md)',
				'bg-transparent text-(--text-secondary)',
				'hover:text-(--text-primary)',
				'data-[state=on]:bg-(--accent-500) data-[state=on]:text-white',
				'data-[state=on]:shadow-(--shadow-sm)',
				'focus-visible:outline-none focus-visible:ring-2',
				'focus-visible:ring-(--accent-500) focus-visible:ring-offset-2',
				'transition-all duration-(--duration-fast)',
				className
			)}
		/>
	);
}

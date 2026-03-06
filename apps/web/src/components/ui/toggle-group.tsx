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
		<RadixRoot {...props} className={cn('flex rounded-md border border-slate-200', className)} />
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
				'px-3 py-1.5 text-xs font-medium transition-colors',
				'first:rounded-l-md last:rounded-r-md',
				'bg-white text-slate-600 hover:bg-slate-50',
				'data-[state=on]:bg-slate-900 data-[state=on]:text-white',
				'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
				className
			)}
		/>
	);
}

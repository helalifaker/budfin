import * as React from 'react';
import { DropdownMenu as P } from 'radix-ui';
import { cn } from '../../lib/cn';

export function DropdownMenu(props: React.ComponentPropsWithoutRef<typeof P.Root>) {
	return <P.Root {...props} />;
}

export function DropdownMenuTrigger(props: React.ComponentPropsWithoutRef<typeof P.Trigger>) {
	return <P.Trigger {...props} />;
}

export function DropdownMenuPortal(props: React.ComponentPropsWithoutRef<typeof P.Portal>) {
	return <P.Portal {...props} />;
}

export function DropdownMenuContent({
	className,
	sideOffset = 4,
	...props
}: React.ComponentPropsWithoutRef<typeof P.Content>) {
	return (
		<P.Portal>
			<P.Content
				sideOffset={sideOffset}
				className={cn(
					'z-50 min-w-[8rem] overflow-hidden rounded-md border border-slate-200',
					'bg-white p-1 shadow-md text-sm text-slate-900',
					'data-[state=open]:animate-in data-[state=closed]:animate-out',
					'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
					'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
					className
				)}
				{...props}
			/>
		</P.Portal>
	);
}

export function DropdownMenuItem({
	className,
	destructive = false,
	...props
}: React.ComponentPropsWithoutRef<typeof P.Item> & { destructive?: boolean }) {
	return (
		<P.Item
			className={cn(
				'relative flex cursor-default select-none items-center gap-2 rounded-sm',
				'px-3 py-1.5 text-sm outline-none transition-colors focus:bg-slate-100',
				'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
				destructive && 'text-red-600 focus:bg-red-50 focus:text-red-700',
				className
			)}
			{...props}
		/>
	);
}

export function DropdownMenuSeparator({
	className,
	...props
}: React.ComponentPropsWithoutRef<typeof P.Separator>) {
	return <P.Separator className={cn('-mx-1 my-1 h-px bg-slate-100', className)} {...props} />;
}

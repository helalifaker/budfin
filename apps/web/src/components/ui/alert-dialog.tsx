import * as React from 'react';
import { AlertDialog as P } from 'radix-ui';
import { cn } from '../../lib/cn';

export function AlertDialog(props: React.ComponentPropsWithoutRef<typeof P.Root>) {
	return <P.Root {...props} />;
}

export function AlertDialogTrigger(props: React.ComponentPropsWithoutRef<typeof P.Trigger>) {
	return <P.Trigger {...props} />;
}

function AlertDialogOverlay({
	className,
	...props
}: React.ComponentPropsWithoutRef<typeof P.Overlay>) {
	return (
		<P.Overlay
			className={cn(
				'fixed inset-0 z-50 bg-black/40',
				'data-[state=open]:animate-in data-[state=closed]:animate-out',
				'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
				className
			)}
			{...props}
		/>
	);
}

export function AlertDialogContent({
	className,
	children,
	...props
}: React.ComponentPropsWithoutRef<typeof P.Content>) {
	return (
		<P.Portal>
			<AlertDialogOverlay />
			<P.Content
				className={cn(
					'fixed left-1/2 top-1/2 z-50 w-full max-w-[480px] -translate-x-1/2 -translate-y-1/2',
					'rounded-[var(--radius-lg)] bg-white p-6 shadow-[var(--shadow-lg)]',
					'data-[state=open]:animate-in data-[state=closed]:animate-out',
					'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
					'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
					className
				)}
				{...props}
			>
				{children}
			</P.Content>
		</P.Portal>
	);
}

export function AlertDialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
	return <div className={cn('mb-4 flex flex-col gap-1', className)} {...props} />;
}

export function AlertDialogTitle({
	className,
	...props
}: React.ComponentPropsWithoutRef<typeof P.Title>) {
	return (
		<P.Title
			className={cn(
				'text-[length:var(--text-lg)] font-semibold text-[var(--text-primary)]',
				className
			)}
			{...props}
		/>
	);
}

export function AlertDialogDescription({
	className,
	...props
}: React.ComponentPropsWithoutRef<typeof P.Description>) {
	return (
		<P.Description
			className={cn('text-[length:var(--text-sm)] text-[var(--text-secondary)]', className)}
			{...props}
		/>
	);
}

export function AlertDialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
	return <div className={cn('mt-6 flex justify-end gap-3', className)} {...props} />;
}

export function AlertDialogAction({
	className,
	...props
}: React.ComponentPropsWithoutRef<typeof P.Action>) {
	return (
		<P.Action
			className={cn(
				'inline-flex h-9 items-center justify-center rounded-[var(--radius-md)]',
				'border border-transparent bg-[var(--accent-500)] px-4',
				'text-[length:var(--text-sm)] font-medium text-white',
				'hover:bg-[var(--accent-600)]',
				'focus:outline-none focus:ring-2 focus:ring-[var(--accent-500)] focus:ring-offset-2',
				'disabled:pointer-events-none disabled:opacity-50',
				'transition-colors duration-[var(--duration-fast)]',
				className
			)}
			{...props}
		/>
	);
}

export function AlertDialogCancel({
	className,
	...props
}: React.ComponentPropsWithoutRef<typeof P.Cancel>) {
	return (
		<P.Cancel
			className={cn(
				'inline-flex h-9 items-center justify-center rounded-[var(--radius-md)]',
				'border border-[var(--workspace-border)] bg-white px-4',
				'text-[length:var(--text-sm)] font-medium text-[var(--text-primary)]',
				'hover:bg-[var(--workspace-bg-subtle)]',
				'focus:outline-none focus:ring-2 focus:ring-[var(--accent-500)] focus:ring-offset-2',
				'disabled:pointer-events-none disabled:opacity-50',
				'transition-colors duration-[var(--duration-fast)]',
				className
			)}
			{...props}
		/>
	);
}

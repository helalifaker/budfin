import * as React from 'react';
import { Dialog as P } from 'radix-ui';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn';

export function Dialog(props: React.ComponentPropsWithoutRef<typeof P.Root>) {
	return <P.Root {...props} />;
}

export function DialogTrigger(props: React.ComponentPropsWithoutRef<typeof P.Trigger>) {
	return <P.Trigger {...props} />;
}

export function DialogClose(props: React.ComponentPropsWithoutRef<typeof P.Close>) {
	return <P.Close {...props} />;
}

function DialogOverlay({ className, ...props }: React.ComponentPropsWithoutRef<typeof P.Overlay>) {
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

export function DialogContent({
	className,
	children,
	...props
}: React.ComponentPropsWithoutRef<typeof P.Content>) {
	return (
		<P.Portal>
			<DialogOverlay />
			<P.Content
				className={cn(
					'fixed left-1/2 top-1/2 z-50 w-full max-w-[480px] -translate-x-1/2 -translate-y-1/2',
					'rounded-lg bg-white p-6 shadow-(--shadow-lg)',
					'data-[state=open]:animate-in data-[state=closed]:animate-out',
					'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
					'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
					className
				)}
				{...props}
			>
				{children}
				<P.Close
					className={cn(
						'absolute right-4 top-4 rounded-sm',
						'opacity-70 hover:opacity-100',
						'focus:outline-none focus:ring-2 focus:ring-(--accent-500)',
						'transition-opacity duration-(--duration-fast)'
					)}
					aria-label="Close"
				>
					<X className="h-4 w-4" />
				</P.Close>
			</P.Content>
		</P.Portal>
	);
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
	return <div className={cn('mb-4 flex flex-col gap-1', className)} {...props} />;
}

export function DialogTitle({
	className,
	...props
}: React.ComponentPropsWithoutRef<typeof P.Title>) {
	return (
		<P.Title
			className={cn('text-(--text-lg) font-semibold text-(--text-primary)', className)}
			{...props}
		/>
	);
}

export function DialogDescription({
	className,
	...props
}: React.ComponentPropsWithoutRef<typeof P.Description>) {
	return (
		<P.Description
			className={cn('text-(--text-sm) text-(--text-secondary)', className)}
			{...props}
		/>
	);
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
	return <div className={cn('mt-6 flex justify-end gap-3', className)} {...props} />;
}

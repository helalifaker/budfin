import * as React from 'react';
import { cn } from '../../lib/cn';

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn(
				'rounded-(--radius-xl) border border-(--workspace-border)',
				'bg-(--workspace-bg-card) shadow-(--shadow-xs)',
				'transition-shadow duration-(--duration-fast)',
				className
			)}
			{...props}
		/>
	);
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
	return <div className={cn('flex flex-col gap-1 px-5 pt-5 pb-3', className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
	return (
		<h3
			className={cn('text-(--text-base) font-semibold text-(--text-primary)', className)}
			{...props}
		/>
	);
}

export function CardDescription({
	className,
	...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
	return <p className={cn('text-(--text-sm) text-(--text-secondary)', className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
	return <div className={cn('px-5 pb-5', className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn(
				'flex items-center justify-end gap-3 px-5 py-4',
				'border-t border-(--workspace-border)',
				className
			)}
			{...props}
		/>
	);
}

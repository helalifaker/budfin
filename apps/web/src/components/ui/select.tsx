/**
 * shadcn/ui Select component — copy-pasted pattern using the unified radix-ui package.
 * Wraps @radix-ui/react-select primitives (exported as Select namespace from 'radix-ui').
 * Do NOT import this from an npm package — it lives here as a local component.
 */
import * as React from 'react';
import { Select as SelectPrimitive } from 'radix-ui';
import { ChevronDown, ChevronUp, Check } from 'lucide-react';
import { cn } from '../../lib/cn';

export type SelectProps = React.ComponentPropsWithoutRef<typeof SelectPrimitive.Root>;

export function Select(props: SelectProps) {
	return <SelectPrimitive.Root {...props} />;
}

export type SelectGroupProps = React.ComponentPropsWithoutRef<typeof SelectPrimitive.Group>;

export function SelectGroup(props: SelectGroupProps) {
	return <SelectPrimitive.Group {...props} />;
}

export type SelectValueProps = React.ComponentPropsWithoutRef<typeof SelectPrimitive.Value>;

export function SelectValue(props: SelectValueProps) {
	return <SelectPrimitive.Value {...props} />;
}

export type SelectTriggerProps = React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>;

export function SelectTrigger({ className, children, ...props }: SelectTriggerProps) {
	return (
		<SelectPrimitive.Trigger
			className={cn(
				'flex h-10 w-full items-center justify-between rounded-md border border-slate-300',
				'bg-white px-3 py-2 text-sm ring-offset-white',
				'placeholder:text-slate-500',
				'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
				'disabled:cursor-not-allowed disabled:opacity-50',
				'[&>span]:line-clamp-1',
				className
			)}
			{...props}
		>
			{children}
			<SelectPrimitive.Icon asChild>
				<ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
			</SelectPrimitive.Icon>
		</SelectPrimitive.Trigger>
	);
}

export type SelectScrollUpButtonProps = React.ComponentPropsWithoutRef<
	typeof SelectPrimitive.ScrollUpButton
>;

export function SelectScrollUpButton({ className, ...props }: SelectScrollUpButtonProps) {
	return (
		<SelectPrimitive.ScrollUpButton
			className={cn('flex cursor-default items-center justify-center py-1', className)}
			{...props}
		>
			<ChevronUp className="h-4 w-4" />
		</SelectPrimitive.ScrollUpButton>
	);
}

export type SelectScrollDownButtonProps = React.ComponentPropsWithoutRef<
	typeof SelectPrimitive.ScrollDownButton
>;

export function SelectScrollDownButton({ className, ...props }: SelectScrollDownButtonProps) {
	return (
		<SelectPrimitive.ScrollDownButton
			className={cn('flex cursor-default items-center justify-center py-1', className)}
			{...props}
		>
			<ChevronDown className="h-4 w-4" />
		</SelectPrimitive.ScrollDownButton>
	);
}

export type SelectContentProps = React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>;

export function SelectContent({
	className,
	children,
	position = 'popper',
	...props
}: SelectContentProps) {
	return (
		<SelectPrimitive.Portal>
			<SelectPrimitive.Content
				className={cn(
					'relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border',
					'border-slate-200 bg-white text-slate-950 shadow-md',
					'data-[state=open]:animate-in data-[state=closed]:animate-out',
					'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
					'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
					'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2',
					'data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
					position === 'popper' &&
						'data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1' +
							' data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1',
					className
				)}
				position={position}
				{...props}
			>
				<SelectScrollUpButton />
				<SelectPrimitive.Viewport
					className={cn(
						'p-1',
						position === 'popper' &&
							'h-[var(--radix-select-trigger-height)] w-full' +
								' min-w-[var(--radix-select-trigger-width)]'
					)}
				>
					{children}
				</SelectPrimitive.Viewport>
				<SelectScrollDownButton />
			</SelectPrimitive.Content>
		</SelectPrimitive.Portal>
	);
}

export type SelectLabelProps = React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>;

export function SelectLabel({ className, ...props }: SelectLabelProps) {
	return (
		<SelectPrimitive.Label
			className={cn('py-1.5 pl-8 pr-2 text-sm font-semibold', className)}
			{...props}
		/>
	);
}

export type SelectItemProps = React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>;

export function SelectItem({ className, children, ...props }: SelectItemProps) {
	return (
		<SelectPrimitive.Item
			className={cn(
				'relative flex w-full cursor-default select-none items-center rounded-sm',
				'py-1.5 pl-8 pr-2 text-sm outline-none',
				'focus:bg-slate-100 focus:text-slate-900',
				'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
				className
			)}
			{...props}
		>
			<span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
				<SelectPrimitive.ItemIndicator>
					<Check className="h-4 w-4" />
				</SelectPrimitive.ItemIndicator>
			</span>
			<SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
		</SelectPrimitive.Item>
	);
}

export type SelectSeparatorProps = React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>;

export function SelectSeparator({ className, ...props }: SelectSeparatorProps) {
	return (
		<SelectPrimitive.Separator
			className={cn('-mx-1 my-1 h-px bg-slate-100', className)}
			{...props}
		/>
	);
}

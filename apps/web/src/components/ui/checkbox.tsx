import * as React from 'react';
import { Checkbox as CheckboxPrimitive } from 'radix-ui';
import { Check } from 'lucide-react';
import { cn } from '../../lib/cn';

export type CheckboxProps = React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>;

export const Checkbox = React.forwardRef<
	React.ComponentRef<typeof CheckboxPrimitive.Root>,
	CheckboxProps
>(({ className, ...props }, ref) => (
	<CheckboxPrimitive.Root
		ref={ref}
		className={cn(
			'peer h-4 w-4 shrink-0 rounded-sm',
			'border border-(--workspace-border-strong)',
			'focus-visible:outline-none focus-visible:ring-2',
			'focus-visible:ring-(--accent-500) focus-visible:ring-offset-2',
			'disabled:cursor-not-allowed disabled:opacity-50',
			'data-[state=checked]:bg-(--accent-500)',
			'data-[state=checked]:border-(--accent-500)',
			'data-[state=checked]:text-white',
			'transition-colors duration-(--duration-fast)',
			className
		)}
		{...props}
	>
		<CheckboxPrimitive.Indicator className="flex items-center justify-center">
			<Check className="h-3 w-3" strokeWidth={3} />
		</CheckboxPrimitive.Indicator>
	</CheckboxPrimitive.Root>
));
Checkbox.displayName = 'Checkbox';

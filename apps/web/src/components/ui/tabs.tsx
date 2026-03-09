import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '../../lib/cn';

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
	React.ComponentRef<typeof TabsPrimitive.List>,
	React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
	<TabsPrimitive.List
		ref={ref}
		className={cn(
			'inline-flex h-9 items-center gap-1 border-b border-(--workspace-border)',
			className
		)}
		{...props}
	/>
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
	React.ComponentRef<typeof TabsPrimitive.Trigger>,
	React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
	<TabsPrimitive.Trigger
		ref={ref}
		className={cn(
			'relative inline-flex items-center justify-center whitespace-nowrap',
			'px-3 py-2 text-(--text-sm) font-medium',
			'text-(--text-muted) transition-colors duration-(--duration-fast)',
			'hover:text-(--text-primary)',
			'focus-visible:outline-none focus-visible:ring-2',
			'focus-visible:ring-(--accent-500) focus-visible:ring-offset-2',
			'disabled:pointer-events-none disabled:opacity-50',
			'data-[state=active]:text-(--accent-600)',
			'data-[state=active]:after:absolute data-[state=active]:after:bottom-0',
			'data-[state=active]:after:left-0 data-[state=active]:after:right-0',
			'data-[state=active]:after:h-0.5 data-[state=active]:after:bg-(--accent-500)',
			'data-[state=active]:after:rounded-full',
			className
		)}
		{...props}
	/>
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
	React.ComponentRef<typeof TabsPrimitive.Content>,
	React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
	<TabsPrimitive.Content
		ref={ref}
		className={cn(
			'mt-3 focus-visible:outline-none focus-visible:ring-2',
			'focus-visible:ring-(--accent-500) focus-visible:ring-offset-2',
			className
		)}
		{...props}
	/>
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };

import { cn } from '../../lib/cn';

interface AnimatedGradientProps {
	className?: string;
}

export function AnimatedGradient({ className }: AnimatedGradientProps) {
	return (
		<div
			className={cn('absolute inset-0', className)}
			style={{
				background: 'var(--gradient-login)',
				backgroundSize: '400% 400%',
				animation: 'mesh-gradient 20s ease infinite',
			}}
			aria-hidden="true"
		/>
	);
}

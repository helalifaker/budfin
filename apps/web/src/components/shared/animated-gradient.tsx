import { cn } from '../../lib/cn';

interface AnimatedGradientProps {
	className?: string;
}

export function AnimatedGradient({ className }: AnimatedGradientProps) {
	return (
		<div
			className={cn('absolute inset-0', className)}
			style={{
				background: 'linear-gradient(-45deg, #0c1222, #0d9488, #134e4a, #1e2d42)',
				backgroundSize: '400% 400%',
				animation: 'mesh-gradient 20s ease infinite',
			}}
			aria-hidden="true"
		/>
	);
}

import { useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/cn';
import { formatMoney } from '../../lib/format-money';

interface CounterProps {
	value: number;
	duration?: number;
	formatter?: ((value: number) => string) | undefined;
	className?: string;
}

export function Counter({
	value,
	duration = 600,
	formatter = (v) => formatMoney(v),
	className,
}: CounterProps) {
	const [displayValue, setDisplayValue] = useState(0);
	const prevValue = useRef(0);
	const rafRef = useRef<number>(0);

	useEffect(() => {
		const start = prevValue.current;
		const diff = value - start;
		const startTime = performance.now();

		function step(currentTime: number) {
			const elapsed = currentTime - startTime;
			const progress = Math.min(elapsed / duration, 1);
			const eased = 1 - Math.pow(1 - progress, 3);
			const current = start + diff * eased;

			setDisplayValue(current);

			if (progress < 1) {
				rafRef.current = requestAnimationFrame(step);
			} else {
				prevValue.current = value;
			}
		}

		rafRef.current = requestAnimationFrame(step);
		return () => cancelAnimationFrame(rafRef.current);
	}, [value, duration]);

	return (
		<span className={cn('tabular-nums', className)} aria-label={formatter(value)}>
			{formatter(Math.round(displayValue))}
		</span>
	);
}

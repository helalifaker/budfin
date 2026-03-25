import { useEffect, useRef, useState } from 'react';
import { Calculator, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/button';

export interface CalculateButtonProps {
	onCalculate: () => void;
	isPending: boolean;
	isSuccess: boolean;
	isError: boolean;
	disabled?: boolean;
	estimatedDurationMs?: number;
}

function useProgressTimer(isPending: boolean, estimatedDurationMs?: number): number {
	const startRef = useRef(0);
	const [progress, setProgress] = useState(0);

	useEffect(() => {
		if (!isPending || !estimatedDurationMs) {
			return;
		}

		startRef.current = Date.now();

		const interval = setInterval(() => {
			const elapsed = Date.now() - startRef.current;
			setProgress(Math.min((elapsed / estimatedDurationMs) * 100, 95));
		}, 100);

		return () => {
			clearInterval(interval);
			setProgress(0);
		};
	}, [isPending, estimatedDurationMs]);

	if (!isPending || !estimatedDurationMs) return 0;
	return progress;
}

export function CalculateButton({
	onCalculate,
	isPending,
	isSuccess,
	isError,
	disabled,
	estimatedDurationMs,
}: CalculateButtonProps) {
	const progress = useProgressTimer(isPending, estimatedDurationMs);

	const getIcon = () => {
		if (isPending) return <Loader2 className="h-4 w-4 animate-spin" />;
		if (isSuccess) return <CheckCircle className="h-4 w-4 text-(--color-success)" />;
		if (isError) return <AlertTriangle className="h-4 w-4 text-(--color-error)" />;
		return <Calculator className="h-4 w-4" />;
	};

	const getLabel = () => {
		if (isPending) return 'Calculating...';
		if (isSuccess) return 'Calculated';
		if (isError) return 'Error';
		return 'Calculate';
	};

	return (
		<Button
			variant="default"
			size="sm"
			onClick={onCalculate}
			disabled={disabled ?? isPending}
			aria-busy={isPending}
			className="relative overflow-hidden"
		>
			{getIcon()}
			<span className="ml-1.5">{getLabel()}</span>
			{isPending && estimatedDurationMs && (
				<div
					className="absolute bottom-0 left-0 h-0.5 bg-(--color-primary) transition-all duration-100"
					style={{ width: `${progress}%` }}
				/>
			)}
		</Button>
	);
}

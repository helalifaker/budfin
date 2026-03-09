import { Calculator, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/button';

interface CalculateButtonProps {
	versionId: number;
	onCalculate: () => void;
	isPending: boolean;
	isSuccess: boolean;
	isError: boolean;
}

export function CalculateButton({
	versionId: _versionId,
	onCalculate,
	isPending,
	isSuccess,
	isError,
}: CalculateButtonProps) {
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
			disabled={isPending}
			aria-busy={isPending}
		>
			{getIcon()}
			<span className="ml-1.5">{getLabel()}</span>
		</Button>
	);
}

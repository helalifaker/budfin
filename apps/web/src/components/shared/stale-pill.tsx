export interface StalePillProps {
	label: string;
}

export function StalePill({ label }: StalePillProps) {
	return (
		<span className="rounded-full bg-(--color-warning-bg) px-2 py-0.5 text-(--text-xs) font-medium text-(--color-warning)">
			{label}
		</span>
	);
}

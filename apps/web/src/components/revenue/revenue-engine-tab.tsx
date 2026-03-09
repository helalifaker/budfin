import { useRevenueResults } from '../../hooks/use-revenue';
import { RevenueMatrixTable } from './revenue-matrix-table';

interface RevenueEngineTabProps {
	versionId: number;
}

export function RevenueEngineTab({ versionId }: RevenueEngineTabProps) {
	const { data, isLoading } = useRevenueResults(versionId);

	if (isLoading) {
		return (
			<div className="flex h-32 items-center justify-center text-sm text-(--text-muted)">
				Loading revenue engine...
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<div className="rounded-lg border border-(--workspace-border) bg-(--workspace-bg-subtle) px-4 py-3 text-sm">
				<div className="font-medium text-(--text-primary)">Revenue Engine Sheet</div>
				<div className="text-(--text-muted)">
					This view mirrors the workbook&apos;s calculated revenue engine, including the
					workbook&apos;s registration subtotals and discount disclosure logic.
				</div>
			</div>

			<RevenueMatrixTable rows={data?.revenueEngine.rows ?? []} ariaLabel="Revenue engine matrix" />
		</div>
	);
}

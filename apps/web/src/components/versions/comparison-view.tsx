import { useState } from 'react';
import { X } from 'lucide-react';
import { useMultiCompare } from '../../hooks/use-versions';
import { Button } from '../ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { ComparisonCharts } from './comparison-charts';
import { ComparisonTable } from './comparison-table';

export type MetricKey = 'revenueHt' | 'staffCosts' | 'netProfit';

export type ComparisonViewProps = {
	versionIds: number[];
	onClose: () => void;
};

export function ComparisonView({ versionIds, onClose }: ComparisonViewProps) {
	const [activeMetric, setActiveMetric] = useState<MetricKey>('revenueHt');
	const { data, isLoading, isError } = useMultiCompare(versionIds);

	if (isLoading) {
		return (
			<div className="rounded-lg border border-[var(--workspace-border)] bg-[var(--bg-card)] p-6">
				<p className="text-[length:var(--text-sm)] text-[var(--text-muted)]">
					Loading comparison data...
				</p>
			</div>
		);
	}

	if (isError || !data) {
		return (
			<div className="rounded-lg border border-[var(--workspace-border)] bg-[var(--bg-card)] p-6">
				<p className="text-[length:var(--text-sm)] text-red-600">Failed to load comparison data.</p>
			</div>
		);
	}

	const versionNames = data.versions.map((v) => v.name);
	const headerLabel = `Comparing: ${versionNames.join(' vs ')}`;

	return (
		<section
			className="rounded-lg border border-[var(--workspace-border)] bg-[var(--bg-card)]"
			aria-label="Version comparison"
		>
			<div className="flex items-center justify-between border-b border-[var(--workspace-border)] px-4 py-3">
				<h2 className="text-[length:var(--text-base)] font-semibold text-[var(--text-primary)]">
					{headerLabel}
				</h2>
				<Button variant="ghost" size="icon" onClick={onClose} aria-label="Close comparison">
					<X className="h-4 w-4" />
				</Button>
			</div>

			<div className="p-4">
				<Tabs value={activeMetric} onValueChange={(v) => setActiveMetric(v as MetricKey)}>
					<TabsList>
						<TabsTrigger value="revenueHt">Revenue HT</TabsTrigger>
						<TabsTrigger value="staffCosts">Staff Costs</TabsTrigger>
						<TabsTrigger value="netProfit">Net Profit</TabsTrigger>
					</TabsList>

					<TabsContent value={activeMetric}>
						<ComparisonCharts data={data} metric={activeMetric} />
						<ComparisonTable data={data} metric={activeMetric} />
					</TabsContent>
				</Tabs>
			</div>
		</section>
	);
}

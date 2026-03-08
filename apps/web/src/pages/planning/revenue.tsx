import { useWorkspaceContext } from '../../hooks/use-workspace-context';
import { useAuthStore } from '../../stores/auth-store';
import { useCalculateRevenue } from '../../hooks/use-revenue';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import { Button } from '../../components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '../../components/ui/toggle-group';
import { FeeGridTab } from '../../components/revenue/fee-grid-tab';
import { DiscountsTab } from '../../components/revenue/discounts-tab';
import { OtherRevenueTab } from '../../components/revenue/other-revenue-tab';
import { ForecastTab } from '../../components/revenue/forecast-tab';
import { RevenueEngineTab } from '../../components/revenue/revenue-engine-tab';

export function RevenuePage() {
	const { versionId, academicPeriod, setAcademicPeriod } = useWorkspaceContext();
	const user = useAuthStore((s) => s.user);
	const isViewer = user?.role === 'Viewer';

	const calculateMutation = useCalculateRevenue(versionId);
	const selectedPeriod =
		academicPeriod === 'AY1' || academicPeriod === 'AY2' || academicPeriod === 'both'
			? academicPeriod
			: 'both';

	if (!versionId) {
		return (
			<div className="flex items-center justify-center h-64 text-[var(--text-muted)]">
				Select a version from the context bar to begin revenue planning.
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<div className="flex flex-col gap-3 rounded-lg border border-[var(--workspace-border)] bg-white p-4 shadow-[var(--shadow-xs)] md:flex-row md:items-center md:justify-between">
				<div className="space-y-1">
					<h1 className="text-xl font-semibold text-[var(--text-primary)]">Revenue</h1>
					<p className="text-sm text-[var(--text-muted)]">
						Use the input sheets to plan revenue, then calculate to populate the application
						equivalent of the Excel revenue engine and executive summary.
					</p>
				</div>

				<div className="flex flex-wrap items-center gap-3">
					<ToggleGroup
						type="single"
						value={selectedPeriod}
						onValueChange={(value) => setAcademicPeriod(value || 'both')}
						aria-label="Academic period filter"
					>
						<ToggleGroupItem value="both">FY2026</ToggleGroupItem>
						<ToggleGroupItem value="AY1">AY1</ToggleGroupItem>
						<ToggleGroupItem value="AY2">AY2</ToggleGroupItem>
					</ToggleGroup>

					{!isViewer && (
						<Button
							size="sm"
							disabled={calculateMutation.isPending}
							onClick={() => calculateMutation.mutate()}
						>
							{calculateMutation.isPending ? 'Calculating...' : 'Calculate Revenue'}
						</Button>
					)}
				</div>
			</div>

			{/* Status feedback */}
			{calculateMutation.isSuccess && (
				<div className="rounded-lg border border-[var(--color-success)] bg-[var(--color-success-bg)] px-4 py-2 text-sm text-[var(--color-success)]">
					Revenue calculated successfully.
				</div>
			)}
			{calculateMutation.isError && (
				<div className="rounded-lg border border-[var(--color-error)] bg-[var(--color-error-bg)] px-4 py-2 text-sm text-[var(--color-error)]">
					Calculation failed. Ensure fee grid and enrollment data are configured.
				</div>
			)}

			<Tabs defaultValue="fees">
				<TabsList>
					<TabsTrigger value="fees">Fee Grid</TabsTrigger>
					<TabsTrigger value="discounts">Discounts</TabsTrigger>
					<TabsTrigger value="other-revenue">Other Revenue</TabsTrigger>
					<TabsTrigger value="engine">Revenue Engine</TabsTrigger>
					<TabsTrigger value="forecast">Executive Summary</TabsTrigger>
				</TabsList>

				<TabsContent value="fees">
					<FeeGridTab versionId={versionId} academicPeriod={selectedPeriod} isReadOnly={isViewer} />
				</TabsContent>

				<TabsContent value="discounts">
					<DiscountsTab versionId={versionId} isReadOnly={isViewer} />
				</TabsContent>

				<TabsContent value="other-revenue">
					<OtherRevenueTab versionId={versionId} isReadOnly={isViewer} />
				</TabsContent>

				<TabsContent value="engine">
					<RevenueEngineTab versionId={versionId} />
				</TabsContent>

				<TabsContent value="forecast">
					<ForecastTab versionId={versionId} />
				</TabsContent>
			</Tabs>
		</div>
	);
}

import { useWorkspaceContext } from '../../hooks/use-workspace-context';
import { useAuthStore } from '../../stores/auth-store';
import { useCalculateRevenue } from '../../hooks/use-revenue';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import { Button } from '../../components/ui/button';
import { FeeGridTab } from '../../components/revenue/fee-grid-tab';
import { DiscountsTab } from '../../components/revenue/discounts-tab';
import { OtherRevenueTab } from '../../components/revenue/other-revenue-tab';
import { ForecastTab } from '../../components/revenue/forecast-tab';

export function RevenuePage() {
	const { versionId } = useWorkspaceContext();
	const user = useAuthStore((s) => s.user);
	const isViewer = user?.role === 'Viewer';

	const calculateMutation = useCalculateRevenue(versionId);

	if (!versionId) {
		return (
			<div className="flex items-center justify-center h-64 text-slate-500">
				Select a version from the context bar to begin revenue planning.
			</div>
		);
	}

	return (
		<div className="space-y-4">
			{/* Module Toolbar */}
			<div className="flex items-center justify-between">
				<h1 className="text-xl font-semibold text-slate-900">Revenue</h1>
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

			{/* Status feedback */}
			{calculateMutation.isSuccess && (
				<div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
					Revenue calculated successfully.
				</div>
			)}
			{calculateMutation.isError && (
				<div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
					Calculation failed. Ensure fee grid and enrollment data are configured.
				</div>
			)}

			{/* Tab Bar */}
			<Tabs defaultValue="fees">
				<TabsList>
					<TabsTrigger value="fees">Fees</TabsTrigger>
					<TabsTrigger value="discounts">Discounts</TabsTrigger>
					<TabsTrigger value="other-revenue">Other Revenue</TabsTrigger>
					<TabsTrigger value="forecast">Forecast</TabsTrigger>
				</TabsList>

				<TabsContent value="fees">
					<FeeGridTab versionId={versionId} />
				</TabsContent>

				<TabsContent value="discounts">
					<DiscountsTab versionId={versionId} />
				</TabsContent>

				<TabsContent value="other-revenue">
					<OtherRevenueTab versionId={versionId} />
				</TabsContent>

				<TabsContent value="forecast">
					<ForecastTab versionId={versionId} />
				</TabsContent>
			</Tabs>
		</div>
	);
}

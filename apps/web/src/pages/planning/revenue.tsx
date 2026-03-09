import { useState } from 'react';
import { useWorkspaceContext } from '../../hooks/use-workspace-context';
import { useAuthStore } from '../../stores/auth-store';
import { useCalculateRevenue } from '../../hooks/use-revenue';
import { useVersions, type BudgetVersion } from '../../hooks/use-versions';
import { WorkspaceBoard } from '../../components/shared/workspace-board';
import { WorkspaceBlock } from '../../components/shared/workspace-block';
import { RevenueKpiRibbon } from '../../components/revenue/kpi-ribbon';
import { TariffAssignmentGrid } from '../../components/revenue/tariff-assignment-grid';
import { FeeGridTab } from '../../components/revenue/fee-grid-tab';
import { DiscountsTab } from '../../components/revenue/discounts-tab';
import { OtherRevenueTab } from '../../components/revenue/other-revenue-tab';
import { RevenueEngineTab } from '../../components/revenue/revenue-engine-tab';
import { ForecastTab } from '../../components/revenue/forecast-tab';
import { Button } from '../../components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '../../components/ui/toggle-group';

export function RevenuePage() {
	const { versionId, academicPeriod, setAcademicPeriod, fiscalYear } = useWorkspaceContext();
	const user = useAuthStore((s) => s.user);
	const isViewer = user?.role === 'Viewer';

	const calculateMutation = useCalculateRevenue(versionId);
	const { data: versionsData } = useVersions(fiscalYear);
	const selectedPeriod =
		academicPeriod === 'AY1' || academicPeriod === 'AY2' || academicPeriod === 'both'
			? academicPeriod
			: 'both';

	const [kpiData, setKpiData] = useState({
		grossHt: 0,
		totalDiscounts: 0,
		netRevenue: 0,
		avgPerStudent: 0,
	});

	const version: BudgetVersion | undefined = versionsData?.data.find((v) => v.id === versionId);
	const isStale = version?.staleModules?.includes('REVENUE') ?? false;

	const handleCalculate = () => {
		calculateMutation.mutate(undefined, {
			onSuccess: (result) => {
				const s = result.summary;
				setKpiData({
					grossHt: Number(s.grossRevenueHt),
					totalDiscounts: Number(s.totalDiscounts),
					netRevenue: Number(s.netRevenueHt),
					avgPerStudent: 0,
				});
			},
		});
	};

	if (!versionId) {
		return (
			<div className="flex items-center justify-center h-64 text-(--text-muted)">
				Select a version from the context bar to begin revenue planning.
			</div>
		);
	}

	return (
		<WorkspaceBoard
			title="Revenue"
			description="Plan tuition revenue, discounts, and other income streams."
			actions={
				<>
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
						<Button size="sm" disabled={calculateMutation.isPending} onClick={handleCalculate}>
							{calculateMutation.isPending ? 'Calculating...' : 'Calculate Revenue'}
						</Button>
					)}
				</>
			}
			kpiRibbon={
				<RevenueKpiRibbon
					grossHt={kpiData.grossHt}
					totalDiscounts={kpiData.totalDiscounts}
					netRevenue={kpiData.netRevenue}
					avgPerStudent={kpiData.avgPerStudent}
					isStale={isStale}
				/>
			}
		>
			{/* Status feedback */}
			{calculateMutation.isSuccess && (
				<div
					className="rounded-lg border border-(--color-success) bg-(--color-success-bg) px-4 py-2 text-sm text-(--color-success)"
					role="status"
				>
					Revenue calculated successfully.
				</div>
			)}
			{calculateMutation.isError && (
				<div
					className="rounded-lg border border-(--color-error) bg-(--color-error-bg) px-4 py-2 text-sm text-(--color-error)"
					role="alert"
				>
					Calculation failed. Ensure fee grid and enrollment data are configured.
				</div>
			)}

			<WorkspaceBlock title="Tariff Assignment" isStale={isStale}>
				<TariffAssignmentGrid
					versionId={versionId}
					academicPeriod={selectedPeriod}
					isReadOnly={isViewer}
				/>
			</WorkspaceBlock>

			<WorkspaceBlock title="Fee Grid & Assumptions">
				<FeeGridTab versionId={versionId} academicPeriod={selectedPeriod} isReadOnly={isViewer} />
			</WorkspaceBlock>

			<WorkspaceBlock title="Discounts">
				<DiscountsTab versionId={versionId} isReadOnly={isViewer} />
			</WorkspaceBlock>

			<WorkspaceBlock title="Other Revenue" defaultOpen={false}>
				<OtherRevenueTab versionId={versionId} isReadOnly={isViewer} />
			</WorkspaceBlock>

			<WorkspaceBlock title="Revenue Engine">
				<RevenueEngineTab versionId={versionId} />
			</WorkspaceBlock>

			<WorkspaceBlock title="Executive Summary">
				<ForecastTab versionId={versionId} />
			</WorkspaceBlock>
		</WorkspaceBoard>
	);
}

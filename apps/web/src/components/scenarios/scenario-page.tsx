import { useCallback, useMemo } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import Decimal from 'decimal.js';
import { useWorkspaceContext } from '../../hooks/use-workspace-context';
import {
	useScenarioParameters,
	useUpdateScenarioParameters,
	useScenarioComparison,
} from '../../hooks/use-scenarios';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { PageTransition } from '../shared/page-transition';
import { cn } from '../../lib/cn';
import type { ScenarioParameters, ScenarioName } from '@budfin/types';

// ── Constants ────────────────────────────────────────────────────────────────

const SCENARIO_LABELS: Record<ScenarioName, string> = {
	Base: 'Base',
	Optimistic: 'Optimistic',
	Pessimistic: 'Pessimistic',
};

const PARAMETER_FIELDS = [
	{ key: 'newEnrollmentFactor', label: 'New Enrollment Factor', step: '0.01' },
	{ key: 'retentionAdjustment', label: 'Retention Adjustment', step: '0.01' },
	{ key: 'feeCollectionRate', label: 'Fee Collection Rate', step: '0.01' },
	{ key: 'scholarshipAllocation', label: 'Scholarship Allocation', step: '0.01' },
	{ key: 'attritionRate', label: 'Attrition Rate', step: '0.01' },
	{ key: 'orsHours', label: 'ORS Hours', step: '0.5' },
] as const;

type ParameterFieldKey = (typeof PARAMETER_FIELDS)[number]['key'];

// ── Form types ───────────────────────────────────────────────────────────────

interface ScenarioFormValues {
	Base: Record<ParameterFieldKey, string>;
	Optimistic: Record<ParameterFieldKey, string>;
	Pessimistic: Record<ParameterFieldKey, string>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatComparisonAmount(value: string): string {
	const d = new Decimal(value);
	if (d.isZero()) return '--';
	const abs = d.abs();
	const formatted = abs.toNumber().toLocaleString('en-US', {
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	});
	return d.isNeg() ? `(${formatted})` : formatted;
}

function buildDefaultValues(params: ScenarioParameters[]): ScenarioFormValues {
	const defaults: ScenarioFormValues = {
		Base: {
			newEnrollmentFactor: '1.000000',
			retentionAdjustment: '1.000000',
			feeCollectionRate: '1.000000',
			scholarshipAllocation: '0.000000',
			attritionRate: '0.000000',
			orsHours: '18.0000',
		},
		Optimistic: {
			newEnrollmentFactor: '1.000000',
			retentionAdjustment: '1.000000',
			feeCollectionRate: '1.000000',
			scholarshipAllocation: '0.000000',
			attritionRate: '0.000000',
			orsHours: '18.0000',
		},
		Pessimistic: {
			newEnrollmentFactor: '1.000000',
			retentionAdjustment: '1.000000',
			feeCollectionRate: '1.000000',
			scholarshipAllocation: '0.000000',
			attritionRate: '0.000000',
			orsHours: '18.0000',
		},
	};

	for (const p of params) {
		const name = p.scenarioName as ScenarioName;
		if (defaults[name]) {
			for (const field of PARAMETER_FIELDS) {
				defaults[name][field.key] = p[field.key];
			}
		}
	}

	return defaults;
}

// ── Parameter Editor ─────────────────────────────────────────────────────────

function ParameterEditor({
	versionId,
	params,
}: {
	versionId: number;
	params: ScenarioParameters[];
}) {
	const updateMutation = useUpdateScenarioParameters(versionId);

	const defaultValues = useMemo(() => buildDefaultValues(params), [params]);

	const { register, handleSubmit, formState } = useForm<ScenarioFormValues>({
		defaultValues,
	});

	const onSubmit: SubmitHandler<ScenarioFormValues> = useCallback(
		async (values) => {
			const scenarios: ScenarioName[] = ['Base', 'Optimistic', 'Pessimistic'];
			for (const name of scenarios) {
				await updateMutation.mutateAsync({
					scenarioName: name,
					params: values[name],
				});
			}
		},
		[updateMutation]
	);

	return (
		<Card>
			<CardHeader>
				<CardTitle>Scenario Parameters</CardTitle>
				<CardDescription>
					Configure adjustment factors for each scenario. Changes mark revenue and downstream
					modules as stale.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form onSubmit={handleSubmit(onSubmit)}>
					<div className="overflow-x-auto">
						<table className="w-full text-sm">
							<thead>
								<tr className="border-b border-(--workspace-border)">
									<th className="px-3 py-2 text-left font-medium text-(--text-muted)">Parameter</th>
									{(['Base', 'Optimistic', 'Pessimistic'] as const).map((name) => (
										<th
											key={name}
											className="px-3 py-2 text-center font-medium text-(--text-muted)"
										>
											{SCENARIO_LABELS[name]}
										</th>
									))}
								</tr>
							</thead>
							<tbody>
								{PARAMETER_FIELDS.map((field) => (
									<tr key={field.key} className="border-b border-(--workspace-border)">
										<td className="px-3 py-2 font-medium">{field.label}</td>
										{(['Base', 'Optimistic', 'Pessimistic'] as const).map((name) => (
											<td key={name} className="px-3 py-2">
												<Input
													type="number"
													step={field.step}
													className="text-right tabular-nums"
													{...register(`${name}.${field.key}` as const)}
												/>
											</td>
										))}
									</tr>
								))}
							</tbody>
						</table>
					</div>
					<div className="mt-4 flex justify-end">
						<Button type="submit" disabled={formState.isSubmitting || updateMutation.isPending}>
							{formState.isSubmitting ? 'Saving...' : 'Save Parameters'}
						</Button>
					</div>
				</form>
			</CardContent>
		</Card>
	);
}

// ── Comparison View ──────────────────────────────────────────────────────────

function ComparisonView({ versionId }: { versionId: number }) {
	const { data, isLoading } = useScenarioComparison(versionId);

	if (isLoading) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Scenario Comparison</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-3">
						{Array.from({ length: 4 }).map((_, i) => (
							<Skeleton key={i} className="h-10 w-full" />
						))}
					</div>
				</CardContent>
			</Card>
		);
	}

	const rows = data?.rows ?? [];

	return (
		<Card>
			<CardHeader>
				<CardTitle>Scenario Comparison</CardTitle>
				<CardDescription>
					Side-by-side view of key financial metrics across scenarios. Delta percentages show
					variance from Base.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="overflow-x-auto">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b border-(--workspace-border)">
								<th className="px-3 py-2 text-left font-medium text-(--text-muted)">Metric</th>
								<th className="px-3 py-2 text-right font-medium text-(--text-muted)">Base</th>
								<th className="px-3 py-2 text-right font-medium text-(--text-muted)">Optimistic</th>
								<th className="px-3 py-2 text-right font-medium text-(--text-muted)">Delta %</th>
								<th className="px-3 py-2 text-right font-medium text-(--text-muted)">
									Pessimistic
								</th>
								<th className="px-3 py-2 text-right font-medium text-(--text-muted)">Delta %</th>
							</tr>
						</thead>
						<tbody>
							{rows.map((row) => {
								const optDelta = parseFloat(row.optimisticDeltaPct);
								const pessDelta = parseFloat(row.pessimisticDeltaPct);

								return (
									<tr key={row.metric} className="border-b border-(--workspace-border)">
										<td className="px-3 py-2 font-medium">{row.metric}</td>
										<td className="px-3 py-2 text-right tabular-nums">
											{formatComparisonAmount(row.base)}
										</td>
										<td className="px-3 py-2 text-right tabular-nums">
											{formatComparisonAmount(row.optimistic)}
										</td>
										<td className="px-3 py-2 text-right">
											<DeltaBadge value={optDelta} />
										</td>
										<td className="px-3 py-2 text-right tabular-nums">
											{formatComparisonAmount(row.pessimistic)}
										</td>
										<td className="px-3 py-2 text-right">
											<DeltaBadge value={pessDelta} />
										</td>
									</tr>
								);
							})}
							{rows.length === 0 && (
								<tr>
									<td colSpan={6} className="px-3 py-8 text-center text-(--text-muted)">
										No comparison data available. Run the P&L calculation first.
									</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>
			</CardContent>
		</Card>
	);
}

// ── Delta Badge ──────────────────────────────────────────────────────────────

function DeltaBadge({ value }: { value: number }) {
	if (value === 0 || isNaN(value)) {
		return (
			<span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-(--workspace-bg-muted) text-(--text-muted)">
				--
			</span>
		);
	}

	const isPositive = value > 0;
	return (
		<span
			className={cn(
				'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium tabular-nums',
				isPositive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
			)}
		>
			{isPositive ? '+' : ''}
			{value.toFixed(1)}%
		</span>
	);
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function ScenarioPage() {
	const { versionId } = useWorkspaceContext();
	const { data: paramsResponse, isLoading } = useScenarioParameters(versionId);

	if (!versionId) {
		return (
			<PageTransition>
				<div className="flex h-[60vh] items-center justify-center">
					<p className="text-(--text-muted)">Select a budget version to configure scenarios.</p>
				</div>
			</PageTransition>
		);
	}

	if (isLoading) {
		return (
			<PageTransition>
				<div className="space-y-6 p-6">
					<Skeleton className="h-8 w-64" />
					<div className="space-y-3">
						{Array.from({ length: 6 }).map((_, i) => (
							<Skeleton key={i} className="h-12 w-full" />
						))}
					</div>
				</div>
			</PageTransition>
		);
	}

	const params = paramsResponse?.data ?? [];

	return (
		<PageTransition>
			<div className="space-y-6 p-6">
				<div>
					<h1 className="text-xl font-semibold text-(--text-primary)">Scenario Modeling</h1>
					<p className="mt-1 text-sm text-(--text-muted)">
						Compare budget scenarios and configure what-if parameters for enrollment, retention, and
						cost factors.
					</p>
				</div>

				<ParameterEditor versionId={versionId} params={params} />
				<ComparisonView versionId={versionId} />
			</div>
		</PageTransition>
	);
}

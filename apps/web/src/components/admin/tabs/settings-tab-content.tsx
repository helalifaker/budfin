import { useCallback, useMemo, useState } from 'react';
import { useDelayedSkeleton } from '../../../hooks/use-delayed-skeleton';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { SettingsCard } from '../settings-card';
import { Button } from '../../ui/button';
import { Skeleton } from '../../ui/skeleton';
import { toast } from '../../ui/toast-state';

interface ConfigItem {
	key: string;
	value: string;
	description: string | null;
	data_type: string;
}

interface ConfigResponse {
	config: ConfigItem[];
}

interface SettingGroup {
	title: string;
	description: string;
	keys: { key: string; label: string }[];
}

const GROUPS: SettingGroup[] = [
	{
		title: 'Session',
		description: 'Session management settings',
		keys: [
			{
				key: 'max_sessions_per_user',
				label: 'Max Sessions per User',
			},
			{
				key: 'session_timeout_minutes',
				label: 'Session Timeout (minutes)',
			},
		],
	},
	{
		title: 'Security',
		description: 'Account security settings',
		keys: [
			{
				key: 'lockout_threshold',
				label: 'Lockout Threshold (attempts)',
			},
			{
				key: 'lockout_duration_minutes',
				label: 'Lockout Duration (minutes)',
			},
		],
	},
	{
		title: 'Application',
		description: 'General application settings',
		keys: [
			{
				key: 'fiscal_year_start_month',
				label: 'Fiscal Year Start (month)',
			},
			{
				key: 'fiscal_year_range',
				label: 'Fiscal Year Range',
			},
			{
				key: 'autosave_interval_seconds',
				label: 'Autosave Interval (seconds)',
			},
		],
	},
];

/**
 * KPI stats derived from system config data.
 * Used by the parent page to populate the AdminKpiRibbon.
 */
export type SettingsKpiStats = {
	sessionTimeout: string;
	lockoutThreshold: string;
	fiscalYear: string;
	autosaveInterval: string;
};

export function useSettingsKpiStats(): SettingsKpiStats | null {
	const { data } = useQuery({
		queryKey: ['system-config'],
		queryFn: () => apiClient<ConfigResponse>('/system-config'),
	});

	return useMemo(() => {
		if (!data) return null;

		const configMap: Record<string, string> = {};
		for (const item of data.config) {
			configMap[item.key] = item.value;
		}

		return {
			sessionTimeout: configMap['session_timeout_minutes'] ?? '-',
			lockoutThreshold: configMap['lockout_threshold'] ?? '-',
			fiscalYear: configMap['fiscal_year_start_month'] ?? '-',
			autosaveInterval: configMap['autosave_interval_seconds'] ?? '-',
		};
	}, [data]);
}

export function SettingsTabContent() {
	const queryClient = useQueryClient();
	const { data, isLoading } = useQuery({
		queryKey: ['system-config'],
		queryFn: () => apiClient<ConfigResponse>('/system-config'),
	});

	const original = useMemo(() => {
		if (!data) return {};
		const map: Record<string, string> = {};
		for (const item of data.config) {
			map[item.key] = item.value;
		}
		return map;
	}, [data]);

	const [values, setValues] = useState<Record<string, string>>({});
	const [lastData, setLastData] = useState(data);
	if (data !== lastData) {
		setLastData(data);
		setValues(original);
	}

	const saveMutation = useMutation({
		mutationFn: (updates: { key: string; value: string }[]) =>
			apiClient('/system-config', {
				method: 'PUT',
				body: JSON.stringify({ updates }),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['system-config'],
			});
			toast.success('Settings saved successfully');
		},
		onError: () => {
			toast.error('Failed to save settings');
		},
	});

	const changedKeys = Object.keys(values).filter((k) => values[k] !== original[k]);
	const hasChanges = changedKeys.length > 0;

	const handleChange = useCallback((key: string, value: string) => {
		setValues((prev) => ({ ...prev, [key]: value }));
	}, []);

	const handleSave = useCallback(() => {
		const updates = changedKeys.map((key) => ({
			key,
			value: values[key]!,
		}));
		saveMutation.mutate(updates);
	}, [changedKeys, values, saveMutation]);

	const showSkeleton = useDelayedSkeleton(isLoading);

	if (isLoading && showSkeleton) {
		return (
			<div>
				<div className="flex items-center justify-end pb-6">
					<Skeleton className="h-9 w-32" />
				</div>
				<div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
					{Array.from({ length: 3 }).map((_, i) => (
						<div
							key={i}
							className="rounded-lg border border-(--workspace-border) bg-(--workspace-bg-card) p-6"
						>
							<Skeleton className="h-5 w-24" />
							<Skeleton className="mt-2 h-4 w-48" />
							<div className="mt-4 space-y-3">
								<Skeleton className="h-9 w-full" />
								<Skeleton className="h-9 w-full" />
							</div>
						</div>
					))}
				</div>
			</div>
		);
	}

	if (isLoading) {
		return null;
	}

	return (
		<div>
			<div className="flex items-center justify-end pb-6">
				<Button
					type="button"
					variant="primary"
					disabled={!hasChanges}
					loading={saveMutation.isPending}
					onClick={handleSave}
				>
					{saveMutation.isPending ? 'Saving...' : 'Save Changes'}
				</Button>
			</div>

			<div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
				{GROUPS.map((group) => (
					<SettingsCard
						key={group.title}
						title={group.title}
						description={group.description}
						fields={group.keys.map(({ key, label }) => ({
							key,
							label,
							value: values[key] ?? '',
							onChange: (v: string) => handleChange(key, v),
							changed: values[key] !== original[key],
						}))}
					/>
				))}
			</div>
		</div>
	);
}

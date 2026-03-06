import { useCallback, useEffect, useState } from 'react';
import {
	useQuery,
	useMutation,
	useQueryClient,
} from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { SettingsCard } from '../../components/admin/settings-card';
import { cn } from '../../lib/cn';

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
				key: 'session_timeout',
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
				key: 'fiscal_year_start',
				label: 'Fiscal Year Start (month)',
			},
			{
				key: 'fiscal_year_range',
				label: 'Fiscal Year Range',
			},
			{
				key: 'autosave_interval',
				label: 'Autosave Interval (seconds)',
			},
		],
	},
];

export function SettingsPage() {
	const queryClient = useQueryClient();
	const [values, setValues] = useState<Record<string, string>>({});
	const [original, setOriginal] = useState<Record<string, string>>(
		{},
	);

	const { data, isLoading } = useQuery({
		queryKey: ['system-config'],
		queryFn: () =>
			apiClient<ConfigResponse>('/system-config'),
	});

	useEffect(() => {
		if (!data) return;
		const map: Record<string, string> = {};
		for (const item of data.config) {
			map[item.key] = item.value;
		}
		setValues(map);
		setOriginal(map);
	}, [data]);

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
		},
	});

	const changedKeys = Object.keys(values).filter(
		(k) => values[k] !== original[k],
	);
	const hasChanges = changedKeys.length > 0;

	const handleChange = useCallback(
		(key: string, value: string) => {
			setValues((prev) => ({ ...prev, [key]: value }));
		},
		[],
	);

	const handleSave = useCallback(() => {
		const updates = changedKeys.map((key) => ({
			key,
			value: values[key]!,
		}));
		saveMutation.mutate(updates);
	}, [changedKeys, values, saveMutation]);

	if (isLoading) {
		return (
			<div className="p-6">
				<p className="text-sm text-slate-500">Loading...</p>
			</div>
		);
	}

	return (
		<div className="p-6">
			<div className="flex items-center justify-between pb-6">
				<h1 className="text-xl font-semibold">
					System Settings
				</h1>
				<button
					type="button"
					disabled={
						!hasChanges || saveMutation.isPending
					}
					onClick={handleSave}
					className={cn(
						'rounded-md bg-blue-600 px-4 py-2',
						'text-sm font-medium text-white',
						'hover:bg-blue-700',
						'disabled:opacity-50',
					)}
				>
					{saveMutation.isPending
						? 'Saving...'
						: 'Save Changes'}
				</button>
			</div>

			<div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
				{GROUPS.map((group) => (
					<SettingsCard
						key={group.title}
						title={group.title}
						description={group.description}
						fields={group.keys.map(
							({ key, label }) => ({
								key,
								label,
								value: values[key] ?? '',
								onChange: (v: string) =>
									handleChange(key, v),
								changed:
									values[key] !== original[key],
							}),
						)}
					/>
				))}
			</div>
		</div>
	);
}

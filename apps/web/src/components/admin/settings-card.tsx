import { cn } from '../../lib/cn';
import { Input } from '../ui/input';

interface SettingField {
	key: string;
	label: string;
	value: string;
	onChange: (value: string) => void;
	changed: boolean;
}

interface SettingsCardProps {
	title: string;
	description: string;
	fields: SettingField[];
}

export function SettingsCard({ title, description, fields }: SettingsCardProps) {
	return (
		<div className="rounded-[var(--radius-lg)] border border-[var(--workspace-border)] bg-[var(--workspace-bg-card)] p-6">
			<h3 className="text-base font-semibold">{title}</h3>
			<p className="mt-1 text-[length:var(--text-sm)] text-[var(--text-muted)]">{description}</p>
			<div className="mt-4 space-y-3">
				{fields.map((field) => (
					<div
						key={field.key}
						className={cn(
							'flex items-center justify-between',
							'rounded-[var(--radius-md)] border-l-4 px-3 py-2',
							field.changed
								? 'border-l-[var(--accent-500)] bg-[var(--accent-50)]/50'
								: 'border-l-transparent'
						)}
					>
						<label
							htmlFor={`setting-${field.key}`}
							className="text-[length:var(--text-sm)] font-medium"
						>
							{field.label}
						</label>
						<Input
							id={`setting-${field.key}`}
							type="number"
							value={field.value}
							onChange={(e) => field.onChange(e.target.value)}
							className="w-24 text-right"
						/>
					</div>
				))}
			</div>
		</div>
	);
}

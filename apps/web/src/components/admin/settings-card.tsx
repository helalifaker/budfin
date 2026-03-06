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
		<div className="rounded-lg border border-slate-200 bg-white p-6">
			<h3 className="text-base font-semibold">{title}</h3>
			<p className="mt-1 text-sm text-slate-500">{description}</p>
			<div className="mt-4 space-y-3">
				{fields.map((field) => (
					<div
						key={field.key}
						className={cn(
							'flex items-center justify-between',
							'rounded-md border-l-4 px-3 py-2',
							field.changed ? 'border-l-blue-500 bg-blue-50/50' : 'border-l-transparent'
						)}
					>
						<label htmlFor={`setting-${field.key}`} className="text-sm font-medium">
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

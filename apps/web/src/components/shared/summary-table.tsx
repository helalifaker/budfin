import { cn } from '../../lib/cn';

export interface SummaryTableRow {
	dot?: string;
	label: string;
	amount: string;
	percent?: string;
}

export interface SummaryTableProps {
	rows: SummaryTableRow[];
	header?: { label: string; amount: string; percent?: string };
}

export function SummaryTable({ rows, header }: SummaryTableProps) {
	return (
		<div className="overflow-hidden rounded-lg border border-(--workspace-border)">
			<table className="w-full text-(--text-sm)">
				{header && (
					<thead>
						<tr className="bg-(--workspace-bg-muted)">
							<th className="px-3 py-1.5 text-left text-(--text-xs) font-medium uppercase tracking-wider text-(--text-muted)">
								{header.label}
							</th>
							<th className="px-3 py-1.5 text-right text-(--text-xs) font-medium uppercase tracking-wider text-(--text-muted)">
								{header.amount}
							</th>
							{header.percent !== undefined && (
								<th className="px-3 py-1.5 text-right text-(--text-xs) font-medium uppercase tracking-wider text-(--text-muted)">
									{header.percent}
								</th>
							)}
						</tr>
					</thead>
				)}
				<tbody>
					{rows.map((row) => (
						<tr key={row.label} className="border-t border-(--workspace-border)">
							<td className="px-3 py-1.5 font-medium">
								<span className="inline-flex items-center gap-1.5">
									{row.dot && (
										<span
											className={cn('inline-block h-2 w-2 rounded-full', row.dot)}
											aria-hidden="true"
										/>
									)}
									{row.label}
								</span>
							</td>
							<td className="px-3 py-1.5 text-right font-mono tabular-nums">{row.amount}</td>
							{row.percent !== undefined && (
								<td className="px-3 py-1.5 text-right font-mono tabular-nums">{row.percent}</td>
							)}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

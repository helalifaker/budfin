import { useMemo } from 'react';
import {
	LineChart,
	Line,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	Legend,
	ResponsiveContainer,
} from 'recharts';
import { useHistorical } from '../../hooks/use-enrollment';

const BAND_COLORS: Record<string, string> = {
	MATERNELLE: '#EC4899',
	ELEMENTAIRE: '#3B82F6',
	COLLEGE: '#22C55E',
	LYCEE: '#A855F7',
	TOTAL: '#1E293B',
};

const BAND_LABELS: Record<string, string> = {
	MATERNELLE: 'Maternelle',
	ELEMENTAIRE: 'Elementaire',
	COLLEGE: 'College',
	LYCEE: 'Lycee',
	TOTAL: 'Total',
};

interface ChartDataPoint {
	year: number;
	MATERNELLE: number;
	ELEMENTAIRE: number;
	COLLEGE: number;
	LYCEE: number;
	TOTAL: number;
}

const GRADE_BAND_MAP: Record<string, string> = {
	PS: 'MATERNELLE',
	MS: 'MATERNELLE',
	GS: 'MATERNELLE',
	CP: 'ELEMENTAIRE',
	CE1: 'ELEMENTAIRE',
	CE2: 'ELEMENTAIRE',
	CM1: 'ELEMENTAIRE',
	CM2: 'ELEMENTAIRE',
	'6eme': 'COLLEGE',
	'5eme': 'COLLEGE',
	'4eme': 'COLLEGE',
	'3eme': 'COLLEGE',
	'2nde': 'LYCEE',
	'1ere': 'LYCEE',
	Terminale: 'LYCEE',
};

export function HistoricalChart() {
	const { data, isLoading } = useHistorical(5);

	const chartData: ChartDataPoint[] = useMemo(() => {
		if (!data?.data) return [];

		const yearMap = new Map<number, Record<string, number>>();
		for (const dp of data.data) {
			const yearData = yearMap.get(dp.academicYear) ?? {
				MATERNELLE: 0,
				ELEMENTAIRE: 0,
				COLLEGE: 0,
				LYCEE: 0,
				TOTAL: 0,
			};
			const band = GRADE_BAND_MAP[dp.gradeLevel] ?? 'TOTAL';
			yearData[band] = (yearData[band] ?? 0) + dp.headcount;
			yearData.TOTAL = (yearData.TOTAL ?? 0) + dp.headcount;
			yearMap.set(dp.academicYear, yearData);
		}

		return [...yearMap.entries()]
			.sort(([a], [b]) => a - b)
			.map(([year, bands]) => ({
				year,
				MATERNELLE: bands.MATERNELLE ?? 0,
				ELEMENTAIRE: bands.ELEMENTAIRE ?? 0,
				COLLEGE: bands.COLLEGE ?? 0,
				LYCEE: bands.LYCEE ?? 0,
				TOTAL: bands.TOTAL ?? 0,
			}));
	}, [data]);

	if (isLoading) {
		return (
			<div className="rounded-[var(--radius-lg)] border p-6">
				<div className="h-64 animate-pulse rounded bg-[var(--workspace-bg-muted)]" />
			</div>
		);
	}

	if (chartData.length === 0) {
		return (
			<div className="rounded-[var(--radius-lg)] border p-6 text-center text-[length:var(--text-sm)] text-[var(--text-muted)]">
				No historical enrollment data available. Import CSV data to see trends.
			</div>
		);
	}

	return (
		<div className="rounded-[var(--radius-lg)] border p-4">
			<h3 className="mb-4 text-[length:var(--text-sm)] font-semibold text-[var(--text-primary)]">
				Historical Enrollment Trends
			</h3>
			{data?.cagrByBand && (
				<div className="mb-3 flex gap-4 text-[length:var(--text-xs)] text-[var(--text-muted)]">
					{Object.entries(data.cagrByBand).map(([band, cagr]) => (
						<span key={band}>
							{BAND_LABELS[band] ?? band}: CAGR {cagr}%
						</span>
					))}
				</div>
			)}
			<ResponsiveContainer width="100%" height={300}>
				<LineChart data={chartData}>
					<CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
					<XAxis dataKey="year" tick={{ fontSize: 12 }} stroke="#94A3B8" />
					<YAxis tick={{ fontSize: 12 }} stroke="#94A3B8" />
					<Tooltip
						contentStyle={{
							fontSize: 12,
							borderRadius: 8,
							border: '1px solid #E2E8F0',
						}}
					/>
					<Legend
						wrapperStyle={{ fontSize: 12 }}
						formatter={(value: string) => BAND_LABELS[value] ?? value}
					/>
					{Object.entries(BAND_COLORS).map(([band, color]) => (
						<Line
							key={band}
							type="monotone"
							dataKey={band}
							stroke={color}
							strokeWidth={band === 'TOTAL' ? 2.5 : 1.5}
							dot={{ r: 3 }}
							activeDot={{ r: 5 }}
						/>
					))}
				</LineChart>
			</ResponsiveContainer>
		</div>
	);
}

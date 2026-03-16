import { ResponsiveContainer } from 'recharts';

export interface ChartWrapperProps {
	children: React.ReactNode;
	height?: number;
}

export function ChartWrapper({ children, height }: ChartWrapperProps) {
	return (
		<ResponsiveContainer width="100%" height={height ?? 200}>
			{children}
		</ResponsiveContainer>
	);
}

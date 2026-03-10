import { useMemo, useId } from 'react';
import { cn } from '../../lib/cn';

export type SparklineProps = {
	data: number[];
	width?: number;
	height?: number;
	color?: string;
	className?: string;
};

export function Sparkline({
	data,
	width = 80,
	height = 24,
	color = 'var(--accent-500)',
	className,
}: SparklineProps) {
	const id = useId();
	const gradientId = `sparkline-grad-${id}`;

	const { points, fillPoints, pathLength } = useMemo(() => {
		if (data.length < 2) return { points: '', fillPoints: '', pathLength: 0 };

		const min = Math.min(...data);
		const max = Math.max(...data);
		const range = max - min || 1;
		const padding = 2;
		const usableW = width - padding * 2;
		const usableH = height - padding * 2;

		const pts = data.map((v, i) => ({
			x: padding + (i / (data.length - 1)) * usableW,
			y: padding + usableH - ((v - min) / range) * usableH,
		}));

		const linePoints = pts.map((p) => `${p.x},${p.y}`).join(' ');
		const first = pts[0]!;
		const last = pts[pts.length - 1]!;
		const fill = `${first.x},${height} ${linePoints} ${last.x},${height}`;

		let len = 0;
		for (let i = 1; i < pts.length; i++) {
			const prev = pts[i - 1]!;
			const curr = pts[i]!;
			const dx = curr.x - prev.x;
			const dy = curr.y - prev.y;
			len += Math.sqrt(dx * dx + dy * dy);
		}

		return { points: linePoints, fillPoints: fill, pathLength: Math.ceil(len) };
	}, [data, width, height]);

	if (data.length < 2) return null;

	return (
		<svg
			width={width}
			height={height}
			viewBox={`0 0 ${width} ${height}`}
			className={cn('overflow-visible', className)}
			aria-hidden="true"
		>
			<defs>
				<linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" stopColor={color} stopOpacity={0.15} />
					<stop offset="100%" stopColor={color} stopOpacity={0} />
				</linearGradient>
			</defs>
			<polygon points={fillPoints} fill={`url(#${gradientId})`} />
			<polyline
				points={points}
				fill="none"
				stroke={color}
				strokeWidth={1.5}
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeDasharray={pathLength}
				strokeDashoffset={pathLength}
				className="animate-sparkline-draw"
				style={{ '--sparkline-length': pathLength } as React.CSSProperties}
			/>
		</svg>
	);
}

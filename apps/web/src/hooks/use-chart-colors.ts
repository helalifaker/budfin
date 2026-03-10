import { useMemo } from 'react';

function getCSSVariableValue(name: string): string {
	if (typeof window === 'undefined') return '';
	return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export interface ChartColors {
	maternelle: string;
	elementaire: string;
	college: string;
	lycee: string;
	total: string;
	grid: string;
	axis: string;
	tooltipBorder: string;
	versionBudget: string;
	versionForecast: string;
	versionActual: string;
	fallback: string;
}

export function useChartColors(): ChartColors {
	return useMemo(
		() => ({
			maternelle: getCSSVariableValue('--chart-maternelle') || '#be185d',
			elementaire: getCSSVariableValue('--chart-elementaire') || '#2563eb',
			college: getCSSVariableValue('--chart-college') || '#15803d',
			lycee: getCSSVariableValue('--chart-lycee') || '#7e22ce',
			total: getCSSVariableValue('--chart-total') || '#0f172a',
			grid: getCSSVariableValue('--chart-grid') || '#e5eaf0',
			axis: getCSSVariableValue('--chart-axis') || '#94a3b8',
			tooltipBorder: getCSSVariableValue('--chart-tooltip-border') || '#e5eaf0',
			versionBudget: getCSSVariableValue('--version-budget') || '#2563eb',
			versionForecast: getCSSVariableValue('--version-forecast') || '#ea580c',
			versionActual: getCSSVariableValue('--version-actual') || '#16a34a',
			fallback: getCSSVariableValue('--text-secondary') || '#475569',
		}),
		[]
	);
}

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
	revenue: string;
	staffCost: string;
	opex: string;
	netProfit: string;
}

export function useChartColors(): ChartColors {
	return useMemo(
		() => ({
			maternelle: getCSSVariableValue('--chart-maternelle') || 'var(--chart-maternelle)',
			elementaire: getCSSVariableValue('--chart-elementaire') || 'var(--chart-elementaire)',
			college: getCSSVariableValue('--chart-college') || 'var(--chart-college)',
			lycee: getCSSVariableValue('--chart-lycee') || 'var(--chart-lycee)',
			total: getCSSVariableValue('--chart-total') || 'var(--chart-total)',
			grid: getCSSVariableValue('--chart-grid') || 'var(--chart-grid)',
			axis: getCSSVariableValue('--chart-axis') || 'var(--chart-axis)',
			tooltipBorder: getCSSVariableValue('--chart-tooltip-border') || 'var(--chart-tooltip-border)',
			versionBudget: getCSSVariableValue('--version-budget') || 'var(--version-budget)',
			versionForecast: getCSSVariableValue('--version-forecast') || 'var(--version-forecast)',
			versionActual: getCSSVariableValue('--version-actual') || 'var(--version-actual)',
			fallback: getCSSVariableValue('--text-secondary') || 'var(--text-secondary)',
			revenue: getCSSVariableValue('--chart-revenue') || '#2563eb',
			staffCost: getCSSVariableValue('--chart-staff-cost') || '#7c3aed',
			opex: getCSSVariableValue('--chart-opex') || '#0891b2',
			netProfit: getCSSVariableValue('--chart-net-profit') || '#16a34a',
		}),
		[]
	);
}

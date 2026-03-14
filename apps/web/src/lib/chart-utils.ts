import type React from 'react';
import { useEffect, useRef, useState } from 'react';

/**
 * Hook that resolves CSS custom properties to SVG-compatible color strings.
 * Recharts renders to SVG where CSS custom properties don't resolve in `fill` attributes.
 * This hook uses getComputedStyle to resolve token values at runtime.
 */
export function useChartColor(tokenName: string): string {
	const [color, setColor] = useState<string>('#000000');
	const resolvedRef = useRef<Map<string, string>>(new Map());

	useEffect(() => {
		const cached = resolvedRef.current.get(tokenName);
		if (cached) {
			setColor(cached);
			return;
		}

		const rootStyle = getComputedStyle(document.documentElement);
		const resolved = rootStyle.getPropertyValue(tokenName).trim();
		if (resolved) {
			// If it's another var() reference, resolve recursively
			const finalColor = resolved.startsWith('var(')
				? rootStyle.getPropertyValue(resolved.replace(/var\(|\)/g, '')).trim()
				: resolved;
			resolvedRef.current.set(tokenName, finalColor);
			setColor(finalColor);
		}
	}, [tokenName]);

	return color;
}

/**
 * Hook that resolves multiple chart colors at once.
 * Accepts an array of CSS custom property names and returns resolved hex/rgb values.
 */
export function useChartSeriesColors(tokenNames: string[]): string[] {
	const [colors, setColors] = useState<string[]>(tokenNames.map(() => '#000000'));
	const joinedTokens = tokenNames.join(',');

	useEffect(() => {
		const rootStyle = getComputedStyle(document.documentElement);
		const resolved = tokenNames.map((token) => {
			const value = rootStyle.getPropertyValue(token).trim();
			if (value && value.startsWith('var(')) {
				return rootStyle.getPropertyValue(value.replace(/var\(|\)/g, '')).trim() || '#000000';
			}
			return value || '#000000';
		});
		setColors(resolved);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [joinedTokens]);

	return colors;
}

/**
 * Pre-configured Recharts tooltip contentStyle using CSS tokens.
 */
export const CHART_TOOLTIP_STYLE: React.CSSProperties = {
	borderRadius: 'var(--radius-md)',
	border: '1px solid var(--chart-tooltip-border)',
	fontSize: 'var(--chart-tooltip-size)',
};

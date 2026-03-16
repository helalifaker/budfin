import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useChartColor, useChartSeriesColors, CHART_TOOLTIP_STYLE } from './chart-utils';

describe('chart-utils', () => {
	let getComputedStyleSpy: ReturnType<typeof vi.spyOn>;
	const mockGetPropertyValue = vi.fn();

	beforeEach(() => {
		mockGetPropertyValue.mockReset();
		getComputedStyleSpy = vi.spyOn(window, 'getComputedStyle').mockReturnValue({
			getPropertyValue: mockGetPropertyValue,
		} as unknown as CSSStyleDeclaration);
	});

	afterEach(() => {
		getComputedStyleSpy.mockRestore();
	});

	describe('useChartColor', () => {
		it('resolves a direct CSS variable value', () => {
			mockGetPropertyValue.mockReturnValue('#2563eb');

			const { result } = renderHook(() => useChartColor('--chart-series-1'));

			expect(result.current).toBe('#2563eb');
			expect(mockGetPropertyValue).toHaveBeenCalledWith('--chart-series-1');
		});

		it('resolves a var() reference to its final value', () => {
			mockGetPropertyValue.mockImplementation((prop: string) => {
				if (prop === '--chart-series-1') return 'var(--color-info)';
				if (prop === '--color-info') return '#2563eb';
				return '';
			});

			const { result } = renderHook(() => useChartColor('--chart-series-1'));

			expect(result.current).toBe('#2563eb');
		});

		it('returns #000000 as default when token is not found', () => {
			mockGetPropertyValue.mockReturnValue('');

			const { result } = renderHook(() => useChartColor('--nonexistent'));

			expect(result.current).toBe('#000000');
		});

		it('caches resolved values for repeated calls', () => {
			mockGetPropertyValue.mockReturnValue('#16a34a');

			const { result, rerender } = renderHook(() => useChartColor('--chart-series-2'));

			expect(result.current).toBe('#16a34a');

			// Rerender should use cached value
			rerender();
			expect(result.current).toBe('#16a34a');
		});

		it('re-resolves when the token name changes', () => {
			mockGetPropertyValue.mockImplementation((prop: string) => {
				if (prop === '--chart-series-1') return '#2563eb';
				if (prop === '--chart-series-2') return '#16a34a';
				return '';
			});

			const { result, rerender } = renderHook(
				({ token }: { token: string }) => useChartColor(token),
				{ initialProps: { token: '--chart-series-1' } }
			);

			expect(result.current).toBe('#2563eb');

			act(() => {
				rerender({ token: '--chart-series-2' });
			});

			expect(result.current).toBe('#16a34a');
		});
	});

	describe('useChartSeriesColors', () => {
		it('resolves multiple tokens at once', () => {
			mockGetPropertyValue.mockImplementation((prop: string) => {
				const map: Record<string, string> = {
					'--chart-series-1': '#2563eb',
					'--chart-series-2': '#16a34a',
					'--chart-series-3': '#d97706',
				};
				return map[prop] ?? '';
			});

			const tokens = ['--chart-series-1', '--chart-series-2', '--chart-series-3'];
			const { result } = renderHook(() => useChartSeriesColors(tokens));

			expect(result.current).toEqual(['#2563eb', '#16a34a', '#d97706']);
		});

		it('falls back to #000000 for unresolvable tokens', () => {
			mockGetPropertyValue.mockReturnValue('');

			const tokens = ['--missing-1', '--missing-2'];
			const { result } = renderHook(() => useChartSeriesColors(tokens));

			expect(result.current).toEqual(['#000000', '#000000']);
		});

		it('resolves nested var() references', () => {
			mockGetPropertyValue.mockImplementation((prop: string) => {
				if (prop === '--chart-series-1') return 'var(--color-info)';
				if (prop === '--color-info') return '#2563eb';
				return '';
			});

			const tokens = ['--chart-series-1'];
			const { result } = renderHook(() => useChartSeriesColors(tokens));

			expect(result.current).toEqual(['#2563eb']);
		});
	});

	describe('CHART_TOOLTIP_STYLE', () => {
		it('exposes expected style properties', () => {
			expect(CHART_TOOLTIP_STYLE).toEqual({
				borderRadius: 'var(--radius-md)',
				border: '1px solid var(--chart-tooltip-border)',
				fontSize: 'var(--chart-tooltip-size)',
			});
		});
	});
});

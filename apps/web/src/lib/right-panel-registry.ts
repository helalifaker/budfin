import type { ReactNode } from 'react';

type PanelRenderer = () => ReactNode;

const registry = new Map<string, PanelRenderer>();

export function registerPanelContent(page: string, renderer: PanelRenderer) {
	registry.set(page, renderer);
}

export function getPanelContent(page: string): PanelRenderer | undefined {
	return registry.get(page);
}

import type { ReactNode } from 'react';

type PanelRenderer = () => ReactNode;
type GuideRenderer = () => ReactNode;

const registry = new Map<string, PanelRenderer>();
const guideRegistry = new Map<string, GuideRenderer>();

export function registerPanelContent(page: string, renderer: PanelRenderer) {
	registry.set(page, renderer);
}

export function getPanelContent(page: string): PanelRenderer | undefined {
	return registry.get(page);
}

export function registerGuideContent(page: string, renderer: GuideRenderer): void {
	guideRegistry.set(page, renderer);
}

export function getGuideContent(page: string): GuideRenderer | undefined {
	return guideRegistry.get(page);
}

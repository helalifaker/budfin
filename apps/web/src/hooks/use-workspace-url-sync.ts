import { useEffect, useRef } from 'react';
import { useWorkspaceContextStore } from '../stores/workspace-context-store';

const PARAM_MAP = {
	fiscalYear: 'fy',
	versionId: 'version',
	comparisonVersionId: 'compare',
	academicPeriod: 'period',
	scenarioId: 'scenario',
} as const;

type SyncKey = keyof typeof PARAM_MAP;
const SYNC_KEYS = Object.keys(PARAM_MAP) as SyncKey[];

function parseUrlParams(): Record<string, string | null> {
	const params = new URLSearchParams(window.location.search);
	return {
		fy: params.get('fy'),
		version: params.get('version'),
		compare: params.get('compare'),
		period: params.get('period'),
		scenario: params.get('scenario'),
	};
}

export function useWorkspaceUrlSync() {
	const hydrate = useWorkspaceContextStore((s) => s.hydrate);
	const hasHydrated = useRef(false);

	// Hydrate store from URL on mount
	useEffect(() => {
		if (hasHydrated.current) return;
		hasHydrated.current = true;

		const raw = parseUrlParams();
		const patch: Record<string, unknown> = {};

		if (raw.fy) {
			const fy = Number(raw.fy);
			if (!Number.isNaN(fy)) patch.fiscalYear = fy;
		}
		if (raw.version) {
			const v = Number(raw.version);
			if (!Number.isNaN(v)) patch.versionId = v;
		}
		if (raw.compare) {
			const c = Number(raw.compare);
			if (!Number.isNaN(c)) patch.comparisonVersionId = c;
		}
		if (raw.period) patch.academicPeriod = raw.period;
		if (raw.scenario) patch.scenarioId = raw.scenario;

		if (Object.keys(patch).length > 0) {
			hydrate(patch);
		}
	}, [hydrate]);

	// Sync store changes to URL via replaceState (no React Router dependency)
	useEffect(() => {
		const unsubscribe = useWorkspaceContextStore.subscribe((state) => {
			const params = new URLSearchParams(window.location.search);

			for (const key of SYNC_KEYS) {
				const urlKey = PARAM_MAP[key];
				const value = state[key];

				if (value === null || value === undefined) {
					params.delete(urlKey);
				} else {
					params.set(urlKey, String(value));
				}
			}

			// Remove default values to keep URL clean
			if (params.get('period') === 'both') params.delete('period');
			if (params.get('scenario') === 'BASE') params.delete('scenario');

			const search = params.toString();
			const newUrl = `${window.location.pathname}${search ? `?${search}` : ''}`;
			window.history.replaceState(null, '', newUrl);
		});

		return unsubscribe;
	}, []);
}

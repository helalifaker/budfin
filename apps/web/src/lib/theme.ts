import { useCallback, useEffect, useSyncExternalStore } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'budfin-theme';

// ── Internal state ──────────────────────────────────────────────────────────

let currentPreference: ThemePreference = 'system';
const listeners = new Set<() => void>();

function notify() {
	for (const listener of listeners) {
		listener();
	}
}

function subscribe(listener: () => void) {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

function getSnapshot(): ThemePreference {
	return currentPreference;
}

// ── Theme application ───────────────────────────────────────────────────────

function getSystemDark(): boolean {
	return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function applyTheme(preference: ThemePreference) {
	const isDark = preference === 'dark' || (preference === 'system' && getSystemDark());
	document.documentElement.classList.toggle('dark', isDark);
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Initializes the theme from localStorage and applies it to the document.
 * Should be called once on app mount (e.g., in RootLayout).
 */
export function initTheme() {
	const stored = localStorage.getItem(STORAGE_KEY) as ThemePreference | null;
	if (stored && ['light', 'dark', 'system'].includes(stored)) {
		currentPreference = stored;
	}
	applyTheme(currentPreference);

	// Listen for system theme changes
	const mql = window.matchMedia('(prefers-color-scheme: dark)');
	mql.addEventListener('change', () => {
		if (currentPreference === 'system') {
			applyTheme('system');
		}
	});
}

/**
 * Sets the theme preference, persists to localStorage, and applies it.
 */
export function setThemePreference(preference: ThemePreference) {
	currentPreference = preference;
	localStorage.setItem(STORAGE_KEY, preference);
	applyTheme(preference);
	notify();
}

/**
 * Hook that returns the current theme preference and a setter.
 */
export function useTheme(): [ThemePreference, (p: ThemePreference) => void] {
	const preference = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

	// Initialize on first mount
	useEffect(() => {
		initTheme();
	}, []);

	const setPreference = useCallback((p: ThemePreference) => {
		setThemePreference(p);
	}, []);

	return [preference, setPreference];
}

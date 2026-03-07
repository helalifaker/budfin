import { create } from 'zustand';

const STORAGE_KEY = 'budfin-sidebar-collapsed';

interface SidebarState {
	isCollapsed: boolean;
	toggle: () => void;
	collapse: () => void;
	expand: () => void;
}

function getPersistedState(): boolean {
	try {
		return localStorage.getItem(STORAGE_KEY) === 'true';
	} catch {
		return false;
	}
}

function persistState(collapsed: boolean) {
	try {
		localStorage.setItem(STORAGE_KEY, String(collapsed));
	} catch {
		// Ignore storage errors
	}
}

export const useSidebarStore = create<SidebarState>((set) => ({
	isCollapsed: getPersistedState(),

	toggle: () =>
		set((state) => {
			const next = !state.isCollapsed;
			persistState(next);
			return { isCollapsed: next };
		}),

	collapse: () =>
		set(() => {
			persistState(true);
			return { isCollapsed: true };
		}),

	expand: () =>
		set(() => {
			persistState(false);
			return { isCollapsed: false };
		}),
}));

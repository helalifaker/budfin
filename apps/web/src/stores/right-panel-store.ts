import { create } from 'zustand';
import { useSidebarStore } from './sidebar-store';

export type RightPanelTab = 'details' | 'activity' | 'audit' | 'help' | 'form';

interface RightPanelState {
	isOpen: boolean;
	activeTab: RightPanelTab;
	width: number;
	activePage: string | null;
	open: (tab?: RightPanelTab) => void;
	close: () => void;
	toggle: () => void;
	setTab: (tab: RightPanelTab) => void;
	setWidth: (width: number) => void;
	setActivePage: (page: string | null) => void;
}

const MIN_WIDTH = 280;
const MAX_WIDTH_RATIO = 0.5;
const DEFAULT_WIDTH = 400;

function clampWidth(width: number): number {
	const maxWidth = typeof window !== 'undefined' ? window.innerWidth * MAX_WIDTH_RATIO : 960;
	return Math.max(MIN_WIDTH, Math.min(width, maxWidth));
}

export const useRightPanelStore = create<RightPanelState>((set) => ({
	isOpen: false,
	activeTab: 'details',
	width: DEFAULT_WIDTH,
	activePage: null,

	open: (tab) =>
		set((state) => {
			useSidebarStore.getState().collapse();
			return {
				isOpen: true,
				activeTab: tab ?? state.activeTab,
			};
		}),

	close: () => set({ isOpen: false }),

	toggle: () =>
		set((state) => {
			if (!state.isOpen) {
				useSidebarStore.getState().collapse();
			}
			return { isOpen: !state.isOpen };
		}),

	setTab: (tab) => set({ activeTab: tab }),

	setWidth: (width) => set({ width: clampWidth(width) }),

	setActivePage: (page) => set({ activePage: page }),
}));

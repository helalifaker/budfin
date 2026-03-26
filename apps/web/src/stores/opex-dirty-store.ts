import { create } from 'zustand';

interface DirtyEntry {
	lineItemId: number;
	month: number;
	amount: string;
}

interface OpExDirtyState {
	dirtyMap: Map<string, DirtyEntry>;
	setDirty: (lineItemId: number, month: number, amount: string) => void;
	getDirtyUpdates: () => DirtyEntry[];
	dirtyCount: () => number;
	flush: () => void;
}

export const useOpExDirtyStore = create<OpExDirtyState>((set, get) => ({
	dirtyMap: new Map(),

	setDirty: (lineItemId, month, amount) => {
		set((state) => {
			const newMap = new Map(state.dirtyMap);
			newMap.set(`${lineItemId}-${month}`, { lineItemId, month, amount });
			return { dirtyMap: newMap };
		});
	},

	getDirtyUpdates: () => Array.from(get().dirtyMap.values()),

	dirtyCount: () => get().dirtyMap.size,

	flush: () => set({ dirtyMap: new Map() }),
}));

import { create } from 'zustand';
import type { GradeCode } from '@budfin/types';

type DirtyField = 'ay1' | 'retention' | 'laterals' | 'override';

interface DirtyRowsState {
	dirtyRows: Map<GradeCode, Set<DirtyField>>;
	dirtyCount: number;
	markDirty: (gradeLevel: GradeCode, field: DirtyField) => void;
	clearRow: (gradeLevel: GradeCode) => void;
	clearAll: () => void;
}

export const useDirtyRowsStore = create<DirtyRowsState>((set) => ({
	dirtyRows: new Map(),
	dirtyCount: 0,
	markDirty: (gradeLevel, field) =>
		set((state) => {
			const next = new Map(state.dirtyRows);
			const fields = new Set(next.get(gradeLevel) ?? []);
			fields.add(field);
			next.set(gradeLevel, fields);
			return { dirtyRows: next, dirtyCount: next.size };
		}),
	clearRow: (gradeLevel) =>
		set((state) => {
			const next = new Map(state.dirtyRows);
			next.delete(gradeLevel);
			return { dirtyRows: next, dirtyCount: next.size };
		}),
	clearAll: () => set({ dirtyRows: new Map(), dirtyCount: 0 }),
}));

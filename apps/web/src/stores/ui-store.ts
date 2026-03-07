import { create } from 'zustand';

interface DialogState {
	id: string;
	open: boolean;
}

interface UiState {
	dialogs: Record<string, DialogState>;
	openDialog: (id: string) => void;
	closeDialog: (id: string) => void;
	isDialogOpen: (id: string) => boolean;
}

export const useUiStore = create<UiState>((set, get) => ({
	dialogs: {},

	openDialog: (id) =>
		set((state) => ({
			dialogs: {
				...state.dialogs,
				[id]: { id, open: true },
			},
		})),

	closeDialog: (id) =>
		set((state) => ({
			dialogs: {
				...state.dialogs,
				[id]: { id, open: false },
			},
		})),

	isDialogOpen: (id) => get().dialogs[id]?.open ?? false,
}));

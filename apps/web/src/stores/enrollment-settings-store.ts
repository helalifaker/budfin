import { create } from 'zustand';

interface EnrollmentSettingsSheetState {
	isOpen: boolean;
	open: () => void;
	close: () => void;
	setOpen: (open: boolean) => void;
}

export const useEnrollmentSettingsSheetStore = create<EnrollmentSettingsSheetState>((set) => ({
	isOpen: false,
	open: () => set({ isOpen: true }),
	close: () => set({ isOpen: false }),
	setOpen: (isOpen) => set({ isOpen }),
}));

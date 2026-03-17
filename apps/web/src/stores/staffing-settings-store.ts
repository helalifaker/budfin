import { create } from 'zustand';

interface StaffingSettingsSheetState {
	isOpen: boolean;
	open: () => void;
	close: () => void;
	setOpen: (open: boolean) => void;
}

export const useStaffingSettingsSheetStore = create<StaffingSettingsSheetState>((set) => ({
	isOpen: false,
	open: () => set({ isOpen: true }),
	close: () => set({ isOpen: false }),
	setOpen: (isOpen) => set({ isOpen }),
}));

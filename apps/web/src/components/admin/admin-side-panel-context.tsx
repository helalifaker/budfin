import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

interface AdminSidePanelState {
	isOpen: boolean;
	title: string;
	content: ReactNode | null;
}

interface AdminSidePanelContextValue {
	isOpen: boolean;
	title: string;
	content: ReactNode | null;
	open: (title: string, content: ReactNode) => void;
	close: () => void;
}

const AdminSidePanelContext = createContext<AdminSidePanelContextValue | null>(null);

export function AdminSidePanelProvider({ children }: { children: ReactNode }) {
	const [state, setState] = useState<AdminSidePanelState>({
		isOpen: false,
		title: '',
		content: null,
	});

	const open = useCallback((title: string, content: ReactNode) => {
		setState({ isOpen: true, title, content });
	}, []);

	const close = useCallback(() => {
		setState((prev) => ({ ...prev, isOpen: false }));
	}, []);

	const value = useMemo(
		() => ({
			isOpen: state.isOpen,
			title: state.title,
			content: state.content,
			open,
			close,
		}),
		[state.isOpen, state.title, state.content, open, close]
	);

	return <AdminSidePanelContext.Provider value={value}>{children}</AdminSidePanelContext.Provider>;
}

export function useAdminSidePanel(): AdminSidePanelContextValue {
	const ctx = useContext(AdminSidePanelContext);
	if (!ctx) {
		throw new Error('useAdminSidePanel must be used within AdminSidePanelProvider');
	}
	return ctx;
}

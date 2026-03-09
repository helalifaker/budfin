import { useEffect } from 'react';

/**
 * Registers a global Ctrl+Shift+N keyboard shortcut to open the Add Employee panel.
 * Only active when the user is not a Viewer.
 */
export function useAddEmployeeShortcut(isViewer: boolean, onAddEmployee: () => void): void {
	useEffect(() => {
		if (isViewer) return;

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.ctrlKey && e.shiftKey && e.key === 'N') {
				e.preventDefault();
				onAddEmployee();
			}
		};

		document.addEventListener('keydown', handleKeyDown);
		return () => document.removeEventListener('keydown', handleKeyDown);
	}, [isViewer, onAddEmployee]);
}

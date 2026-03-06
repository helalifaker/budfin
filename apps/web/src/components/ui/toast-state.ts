type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
	id: string;
	message: string;
	type: ToastType;
}

let _toasts: ToastItem[] = [];
let _listeners: Array<(t: ToastItem[]) => void> = [];

function notify() {
	const snapshot = [..._toasts];
	_listeners.forEach((l) => l(snapshot));
}

function add(message: string, type: ToastType, ms = 4000) {
	const id = Math.random().toString(36).slice(2);
	_toasts = [..._toasts, { id, message, type }];
	notify();
	setTimeout(() => {
		_toasts = _toasts.filter((t) => t.id !== id);
		notify();
	}, ms);
}

export const toast = {
	success: (msg: string) => add(msg, 'success'),
	error: (msg: string) => add(msg, 'error'),
	info: (msg: string) => add(msg, 'info'),
	warning: (msg: string) => add(msg, 'warning'),
};

export function subscribe(listener: (t: ToastItem[]) => void) {
	_listeners.push(listener);
	return () => {
		_listeners = _listeners.filter((l) => l !== listener);
	};
}

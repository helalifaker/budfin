import { create } from 'zustand';
import {
	broadcastLogout,
	broadcastTokenRefresh,
	onAuthMessage,
	shouldSkipRefresh,
} from '../lib/tab-sync';

interface User {
	id: number;
	email: string;
	role: string;
}

interface AuthState {
	accessToken: string | null;
	user: User | null;
	isAuthenticated: boolean;
	isInitializing: boolean;
	login: (email: string, password: string) => Promise<void>;
	refresh: () => Promise<boolean>;
	logout: () => Promise<void>;
	setAuth: (token: string, user: User) => void;
	clearAuth: () => void;
	initialize: () => Promise<void>;
}

let refreshPromise: Promise<boolean> | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
	accessToken: null,
	user: null,
	isAuthenticated: false,
	isInitializing: true,

	setAuth: (token, user) =>
		set({ accessToken: token, user, isAuthenticated: true, isInitializing: false }),

	clearAuth: () =>
		set({
			accessToken: null,
			user: null,
			isAuthenticated: false,
		}),

	initialize: async () => {
		const success = await get().refresh();
		if (!success) {
			set({ isInitializing: false });
		}
	},

	login: async (email, password) => {
		const response = await fetch('/api/v1/auth/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email, password }),
			credentials: 'include',
		});
		if (!response.ok) {
			const data = await response.json();
			throw new Error(data.message || 'Login failed');
		}
		const data = await response.json();
		get().setAuth(data.access_token, data.user);
	},

	refresh: async () => {
		if (shouldSkipRefresh()) {
			return get().accessToken !== null;
		}
		if (refreshPromise) return refreshPromise;
		refreshPromise = (async () => {
			try {
				const response = await fetch('/api/v1/auth/refresh', {
					method: 'POST',
					credentials: 'include',
				});
				if (!response.ok) return false;
				const data = await response.json();
				get().setAuth(data.access_token, data.user);
				broadcastTokenRefresh(data.access_token, data.user);
				return true;
			} catch {
				return false;
			} finally {
				refreshPromise = null;
			}
		})();
		return refreshPromise;
	},

	logout: async () => {
		const token = get().accessToken;
		try {
			await fetch('/api/v1/auth/logout', {
				method: 'POST',
				headers: token ? { Authorization: `Bearer ${token}` } : {},
				credentials: 'include',
			});
		} catch {
			// Ignore logout failures
		}
		get().clearAuth();
		broadcastLogout();
	},
}));

// Listen for auth events from other tabs
onAuthMessage((msg) => {
	if (msg.type === 'TOKEN_REFRESHED') {
		useAuthStore.getState().setAuth(msg.accessToken, msg.user);
	} else if (msg.type === 'LOGOUT') {
		useAuthStore.getState().clearAuth();
	}
});

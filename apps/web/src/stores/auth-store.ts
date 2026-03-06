import { create } from 'zustand';

interface User {
	id: number;
	email: string;
	role: string;
}

interface AuthState {
	accessToken: string | null;
	user: User | null;
	isAuthenticated: boolean;
	login: (email: string, password: string) => Promise<void>;
	refresh: () => Promise<boolean>;
	logout: () => Promise<void>;
	setAuth: (token: string, user: User) => void;
	clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
	accessToken: null,
	user: null,
	isAuthenticated: false,

	setAuth: (token, user) => set({ accessToken: token, user, isAuthenticated: true }),

	clearAuth: () =>
		set({
			accessToken: null,
			user: null,
			isAuthenticated: false,
		}),

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
		try {
			const response = await fetch('/api/v1/auth/refresh', {
				method: 'POST',
				credentials: 'include',
			});
			if (!response.ok) return false;
			const data = await response.json();
			get().setAuth(data.access_token, data.user);
			return true;
		} catch {
			return false;
		}
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
	},
}));

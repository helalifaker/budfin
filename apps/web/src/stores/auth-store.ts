import { create } from 'zustand';
import {
	broadcastLogout,
	broadcastTokenRefresh,
	onAuthMessage,
	shouldSkipRefresh,
} from '../lib/tab-sync';

const GENERIC_AUTH_ERROR = 'Unable to sign in right now. Please try again in a moment.';

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

async function getLoginErrorMessage(response: Response): Promise<string> {
	if (response.status >= 500) {
		return GENERIC_AUTH_ERROR;
	}

	const contentType = response.headers.get('content-type') ?? '';
	if (contentType.includes('application/json')) {
		try {
			const data = (await response.json()) as { message?: unknown };
			if (typeof data.message === 'string' && data.message.trim().length > 0) {
				return data.message;
			}
		} catch {
			// Fall through to the generic fallback below.
		}
	}

	return 'Login failed';
}

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
		let response: Response;
		try {
			response = await fetch('/api/v1/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, password }),
				credentials: 'include',
			});
		} catch {
			throw new Error(GENERIC_AUTH_ERROR);
		}

		if (!response.ok) {
			throw new Error(await getLoginErrorMessage(response));
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
			// Fire-and-forget: logout endpoint failure is non-critical.
			// The access token is already cleared from memory, and the
			// refresh token cookie will expire naturally. Retrying or
			// surfacing this error would degrade UX with no security benefit.
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

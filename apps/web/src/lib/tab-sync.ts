const CHANNEL_NAME = 'budfin-auth';
const REFRESH_DEBOUNCE_MS = 2000;

interface AuthUser {
	id: number;
	email: string;
	role: string;
}

type AuthMessage =
	| { type: 'TOKEN_REFRESHED'; accessToken: string; user: AuthUser }
	| { type: 'LOGOUT' };

type MessageHandler = (msg: AuthMessage) => void;

let channel: BroadcastChannel | null = null;
let lastRefreshTime = 0;

function getChannel(): BroadcastChannel | null {
	if (typeof BroadcastChannel === 'undefined') return null;
	if (!channel) {
		channel = new BroadcastChannel(CHANNEL_NAME);
	}
	return channel;
}

export function broadcastTokenRefresh(accessToken: string, user: AuthUser): void {
	const ch = getChannel();
	if (!ch) return;
	lastRefreshTime = Date.now();
	ch.postMessage({ type: 'TOKEN_REFRESHED', accessToken, user } satisfies AuthMessage);
}

export function broadcastLogout(): void {
	const ch = getChannel();
	if (!ch) return;
	ch.postMessage({ type: 'LOGOUT' } satisfies AuthMessage);
}

export function shouldSkipRefresh(): boolean {
	return Date.now() - lastRefreshTime < REFRESH_DEBOUNCE_MS;
}

export function onAuthMessage(handler: MessageHandler): void {
	const ch = getChannel();
	if (!ch) return;
	ch.onmessage = (event: MessageEvent<AuthMessage>) => {
		if (event.data.type === 'TOKEN_REFRESHED') {
			lastRefreshTime = Date.now();
		}
		handler(event.data);
	};
}

export function closeTabSync(): void {
	if (channel) {
		channel.close();
		channel = null;
	}
}

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const instances: MockBroadcastChannel[] = [];

class MockBroadcastChannel {
	name: string;
	onmessage: ((event: MessageEvent) => void) | null = null;
	postMessage = vi.fn();
	close = vi.fn();
	constructor(name: string) {
		this.name = name;
		instances.push(this);
	}
}

describe('tab-sync', () => {
	let originalBC: typeof globalThis.BroadcastChannel;

	beforeEach(() => {
		originalBC = globalThis.BroadcastChannel;
		globalThis.BroadcastChannel = MockBroadcastChannel as unknown as typeof BroadcastChannel;
		instances.length = 0;
		vi.resetModules();
	});

	afterEach(() => {
		globalThis.BroadcastChannel = originalBC;
	});

	const mockUser = { id: 1, email: 'test@example.com', role: 'admin' };

	it('broadcastTokenRefresh posts TOKEN_REFRESHED message', async () => {
		const { broadcastTokenRefresh, closeTabSync } = await import('./tab-sync');
		broadcastTokenRefresh('tok-123', mockUser);

		expect(instances).toHaveLength(1);
		expect(instances[0]!.postMessage).toHaveBeenCalledWith({
			type: 'TOKEN_REFRESHED',
			accessToken: 'tok-123',
			user: mockUser,
		});
		closeTabSync();
	});

	it('broadcastLogout posts LOGOUT message', async () => {
		const { broadcastLogout, closeTabSync } = await import('./tab-sync');
		broadcastLogout();

		expect(instances[0]!.postMessage).toHaveBeenCalledWith({ type: 'LOGOUT' });
		closeTabSync();
	});

	it('shouldSkipRefresh returns true within debounce window', async () => {
		const { broadcastTokenRefresh, shouldSkipRefresh, closeTabSync } = await import('./tab-sync');
		broadcastTokenRefresh('tok-123', mockUser);

		expect(shouldSkipRefresh()).toBe(true);
		closeTabSync();
	});

	it('shouldSkipRefresh returns false after debounce window', async () => {
		const { shouldSkipRefresh } = await import('./tab-sync');
		expect(shouldSkipRefresh()).toBe(false);
	});

	it('onAuthMessage receives messages and calls handler', async () => {
		const { onAuthMessage, closeTabSync } = await import('./tab-sync');
		const handler = vi.fn();
		onAuthMessage(handler);

		const channel = instances[0]!;
		const event = { data: { type: 'LOGOUT' } } as MessageEvent;
		channel.onmessage!(event);

		expect(handler).toHaveBeenCalledWith({ type: 'LOGOUT' });
		closeTabSync();
	});

	it('onAuthMessage updates lastRefreshTime on TOKEN_REFRESHED', async () => {
		const { onAuthMessage, shouldSkipRefresh, closeTabSync } = await import('./tab-sync');
		const handler = vi.fn();
		onAuthMessage(handler);

		const channel = instances[0]!;
		const event = {
			data: { type: 'TOKEN_REFRESHED', accessToken: 'tok-456', user: mockUser },
		} as MessageEvent;
		channel.onmessage!(event);

		expect(shouldSkipRefresh()).toBe(true);
		closeTabSync();
	});

	it('closeTabSync closes channel and allows re-creation', async () => {
		const { broadcastLogout, closeTabSync } = await import('./tab-sync');
		broadcastLogout();
		expect(instances).toHaveLength(1);

		closeTabSync();
		expect(instances[0]!.close).toHaveBeenCalled();

		broadcastLogout();
		expect(instances).toHaveLength(2);
		closeTabSync();
	});

	it('gracefully degrades when BroadcastChannel is undefined', async () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		delete (globalThis as any).BroadcastChannel;
		vi.resetModules();

		const { broadcastTokenRefresh, broadcastLogout, shouldSkipRefresh, onAuthMessage } =
			await import('./tab-sync');

		expect(() => broadcastTokenRefresh('tok', mockUser)).not.toThrow();
		expect(() => broadcastLogout()).not.toThrow();
		expect(shouldSkipRefresh()).toBe(false);
		expect(() => onAuthMessage(vi.fn())).not.toThrow();
	});
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from './auth-store';

describe('useAuthStore login', () => {
	beforeEach(() => {
		useAuthStore.setState({
			accessToken: null,
			user: null,
			isAuthenticated: false,
			isInitializing: false,
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it('preserves API validation messages for non-5xx responses', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(
				new Response(JSON.stringify({ message: 'Invalid email or password' }), {
					status: 401,
					headers: {
						'Content-Type': 'application/json',
					},
				})
			)
		);

		await expect(useAuthStore.getState().login('admin@efir.edu.sa', 'wrong')).rejects.toThrow(
			'Invalid email or password'
		);
	});

	it('hides raw server payloads for 5xx responses', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(
				new Response(
					JSON.stringify({
						message:
							'Invalid `prisma.user.findUnique()` invocation: The table `public.users` does not exist',
					}),
					{
						status: 500,
						headers: {
							'Content-Type': 'application/json',
						},
					}
				)
			)
		);

		await expect(useAuthStore.getState().login('admin@efir.edu.sa', 'changeme123')).rejects.toThrow(
			'Unable to sign in right now. Please try again in a moment.'
		);
	});

	it('returns a safe message when the request fails before a response arrives', async () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Failed to fetch')));

		await expect(useAuthStore.getState().login('admin@efir.edu.sa', 'changeme123')).rejects.toThrow(
			'Unable to sign in right now. Please try again in a moment.'
		);
	});
});

import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import { logging } from './logging.js';

describe('logging plugin', () => {
	it('registers without error', async () => {
		const app = Fastify({ logger: false });
		await app.register(logging);
		await app.ready();
		await app.close();
	});

	it('sets logContext on request', async () => {
		const app = Fastify({ logger: false });
		await app.register(logging);

		let capturedContext: { requestId: string; userId: number | null } | undefined;
		app.get('/test', async (request) => {
			capturedContext = request.logContext;
			return { ok: true };
		});

		await app.ready();
		await app.inject({ method: 'GET', url: '/test' });

		expect(capturedContext).toBeDefined();
		expect(capturedContext!.requestId).toBeDefined();
		expect(capturedContext!.userId).toBeNull();
		await app.close();
	});
});

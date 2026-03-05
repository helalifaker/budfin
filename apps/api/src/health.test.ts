import { describe, it, expect, afterAll } from 'vitest';
import { buildApp } from './index.js';

describe('GET /api/v1/health', () => {
	const appPromise = buildApp();

	afterAll(async () => {
		const app = await appPromise;
		await app.close();
	});

	it('returns 200 with healthy status', async () => {
		const app = await appPromise;
		const response = await app.inject({
			method: 'GET',
			url: '/api/v1/health',
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({
			status: 'healthy',
			version: '0.0.1',
		});
	});
});

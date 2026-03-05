import { describe, it, expect, afterAll, beforeEach } from 'vitest';
import { buildApp } from '../index.js';

describe('GET /metrics', () => {
	const appPromise = buildApp();

	afterAll(async () => {
		const app = await appPromise;
		await app.close();
	});

	it('returns Prometheus exposition format', async () => {
		const app = await appPromise;
		const response = await app.inject({
			method: 'GET',
			url: '/metrics',
		});

		expect(response.statusCode).toBe(200);
		expect(response.headers['content-type']).toContain('text/plain');
	});

	it('contains all 5 required metrics', async () => {
		const app = await appPromise;
		const response = await app.inject({
			method: 'GET',
			url: '/metrics',
		});

		const body = response.body;
		expect(body).toContain('http_request_duration_ms');
		expect(body).toContain('calculation_duration_ms');
		expect(body).toContain('export_job_duration_ms');
		expect(body).toContain('db_pool_connections_active');
		expect(body).toContain('auth_failures_total');
	});

	it('is outside /api/v1/ prefix', async () => {
		const app = await appPromise;

		const directResponse = await app.inject({
			method: 'GET',
			url: '/metrics',
		});
		expect(directResponse.statusCode).toBe(200);

		const prefixedResponse = await app.inject({
			method: 'GET',
			url: '/api/v1/metrics',
		});
		expect(prefixedResponse.statusCode).toBe(404);
	});
});

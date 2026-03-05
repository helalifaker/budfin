import { describe, it, expect, afterAll, vi, beforeAll } from 'vitest';

vi.mock('./lib/prisma.js', () => ({
	prisma: {
		$queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
		$disconnect: vi.fn(),
	},
}));

const { buildApp } = await import('./index.js');

describe('GET /api/v1/health', () => {
	const appPromise = buildApp();

	afterAll(async () => {
		const app = await appPromise;
		await app.close();
	});

	it('returns 200 with ok status when DB is connected', async () => {
		const app = await appPromise;
		const response = await app.inject({
			method: 'GET',
			url: '/api/v1/health',
		});

		expect(response.statusCode).toBe(200);
		const body = response.json();
		expect(body.status).toBe('ok');
		expect(body.db).toBe('connected');
		expect(typeof body.uptime_seconds).toBe('number');
		expect(body.uptime_seconds).toBeGreaterThanOrEqual(0);
		expect(body.version).toBe('0.0.1');
	});

	it('returns all required fields', async () => {
		const app = await appPromise;
		const response = await app.inject({
			method: 'GET',
			url: '/api/v1/health',
		});

		const body = response.json();
		expect(body).toHaveProperty('status');
		expect(body).toHaveProperty('db');
		expect(body).toHaveProperty('uptime_seconds');
		expect(body).toHaveProperty('version');
	});
});

describe('GET /api/v1/health (DB unreachable)', () => {
	it('returns 503 with degraded status when DB fails', async () => {
		const { prisma } = await import('./lib/prisma.js');
		vi.mocked(prisma.$queryRaw).mockRejectedValueOnce(new Error('Connection refused'));

		const app = await buildApp();
		const response = await app.inject({
			method: 'GET',
			url: '/api/v1/health',
		});

		expect(response.statusCode).toBe(503);
		const body = response.json();
		expect(body.status).toBe('degraded');
		expect(body.db).toBe('unreachable');
		expect(typeof body.uptime_seconds).toBe('number');

		await app.close();
	});
});

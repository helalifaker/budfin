import { afterAll, describe, expect, it } from 'vitest';
import { buildApp } from './index.js';

describe('buildApp master-data route registration', () => {
	const appPromise = buildApp();

	afterAll(async () => {
		const app = await appPromise;
		await app.close();
	});

	it('serves all master-data endpoints through the real app bootstrap', async () => {
		const app = await appPromise;
		const routes = [
			'/api/v1/master-data/accounts',
			'/api/v1/master-data/academic-years',
			'/api/v1/master-data/grade-levels',
			'/api/v1/master-data/nationalities',
			'/api/v1/master-data/tariffs',
			'/api/v1/master-data/departments',
			'/api/v1/master-data/assumptions',
		];

		for (const url of routes) {
			const response = await app.inject({
				method: 'GET',
				url,
			});

			expect(response.statusCode).toBe(401);
		}
	});
});

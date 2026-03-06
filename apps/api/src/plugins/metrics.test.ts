import { describe, it, expect } from 'vitest';
import client from 'prom-client';
import {
	httpRequestDuration,
	calculationDuration,
	exportJobDuration,
	dbPoolConnectionsActive,
	authFailuresTotal,
} from './metrics.js';

describe('metrics definitions', () => {
	it('http_request_duration_ms is a Histogram', () => {
		expect(httpRequestDuration).toBeInstanceOf(client.Histogram);
	});

	it('calculation_duration_ms is a Histogram', () => {
		expect(calculationDuration).toBeInstanceOf(client.Histogram);
	});

	it('export_job_duration_ms is a Histogram', () => {
		expect(exportJobDuration).toBeInstanceOf(client.Histogram);
	});

	it('db_pool_connections_active is a Gauge', () => {
		expect(dbPoolConnectionsActive).toBeInstanceOf(client.Gauge);
	});

	it('auth_failures_total is a Counter', () => {
		expect(authFailuresTotal).toBeInstanceOf(client.Counter);
	});
});

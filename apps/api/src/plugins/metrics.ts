import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import client from 'prom-client';

export const httpRequestDuration = new client.Histogram({
	name: 'http_request_duration_ms',
	help: 'Duration of HTTP requests in milliseconds',
	labelNames: ['endpoint', 'status_code'] as const,
	buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
});

export const calculationDuration = new client.Histogram({
	name: 'calculation_duration_ms',
	help: 'Duration of financial calculations in milliseconds',
	labelNames: ['module'] as const,
	buckets: [1, 5, 10, 25, 50, 100, 250, 500],
});

export const exportJobDuration = new client.Histogram({
	name: 'export_job_duration_ms',
	help: 'Duration of export jobs in milliseconds',
	labelNames: ['format'] as const,
	buckets: [100, 250, 500, 1000, 2500, 5000, 10000],
});

export const dbPoolConnectionsActive = new client.Gauge({
	name: 'db_pool_connections_active',
	help: 'Number of active database pool connections',
});

export const authFailuresTotal = new client.Counter({
	name: 'auth_failures_total',
	help: 'Total number of authentication failures',
	labelNames: ['reason'] as const,
});

client.collectDefaultMetrics();

async function metricsPlugin(app: FastifyInstance) {
	app.addHook('onResponse', async (request, reply) => {
		const duration = reply.elapsedTime;
		httpRequestDuration.observe(
			{
				endpoint: request.routeOptions?.url ?? request.url,
				status_code: reply.statusCode.toString(),
			},
			duration,
		);
	});
}

export const metrics = fp(metricsPlugin, { name: 'metrics' });

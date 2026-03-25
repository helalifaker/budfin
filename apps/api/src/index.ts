import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { logging } from './plugins/logging.js';
import { metrics } from './plugins/metrics.js';
import { auth } from './plugins/auth.js';
import { healthRoutes } from './routes/health.js';
import { metricsRoutes } from './routes/metrics.js';
import { authRoutes } from './routes/auth.js';
import { userRoutes } from './routes/users.js';
import { contextRoutes } from './routes/context.js';
import { auditRoutes } from './routes/audit.js';
import { systemConfigRoutes } from './routes/system-config.js';
import { versionRoutes } from './routes/versions.js';
import { fiscalPeriodRoutes } from './routes/fiscal-periods.js';
import { masterDataRoutes } from './routes/master-data/index.js';
import {
	enrollmentRoutes,
	calculateRoutes,
	enrollmentHistoricalRoutes,
} from './routes/enrollment/index.js';
import { revenueRoutes, revenueCalculateRoutes } from './routes/revenue/index.js';
import { staffingRoutes, staffingCalculateRoutes } from './routes/staffing/index.js';
import { opExRoutes, opExCalculateRoutes } from './routes/opex/index.js';
import { pnlRoutes } from './routes/pnl/index.js';
import { pnlCalculateRoutes } from './routes/pnl/calculate.js';
import { scenarioRoutes } from './routes/scenarios/index.js';
import { dashboardRoutes } from './routes/dashboard.js';

export async function buildApp() {
	const app = Fastify({
		logger: false,
	});

	app.setValidatorCompiler(validatorCompiler);
	app.setSerializerCompiler(serializerCompiler);

	await app.register(logging);
	await app.register(metrics);
	await app.register(cors, {
		origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
		credentials: true,
	});
	await app.register(cookie);
	await app.register(rateLimit, {
		max: 100,
		timeWindow: '1 minute',
	});
	await app.register(auth);
	await app.register(healthRoutes, { prefix: '/api/v1' });
	await app.register(metricsRoutes);
	await app.register(authRoutes, { prefix: '/api/v1/auth' });
	await app.register(userRoutes, { prefix: '/api/v1/users' });
	await app.register(contextRoutes, { prefix: '/api/v1' });
	await app.register(auditRoutes, { prefix: '/api/v1/audit' });
	await app.register(systemConfigRoutes, {
		prefix: '/api/v1/system-config',
	});
	await app.register(masterDataRoutes, {
		prefix: '/api/v1/master-data',
	});
	await app.register(versionRoutes, { prefix: '/api/v1/versions' });
	await app.register(enrollmentRoutes, {
		prefix: '/api/v1/versions/:versionId/enrollment',
	});
	await app.register(calculateRoutes, {
		prefix: '/api/v1/versions/:versionId/calculate',
	});
	await app.register(enrollmentHistoricalRoutes, {
		prefix: '/api/v1/enrollment',
	});
	await app.register(revenueRoutes, {
		prefix: '/api/v1/versions/:versionId',
	});
	await app.register(revenueCalculateRoutes, {
		prefix: '/api/v1/versions/:versionId/calculate',
	});
	await app.register(fiscalPeriodRoutes, { prefix: '/api/v1/fiscal-periods' });
	await app.register(staffingRoutes, {
		prefix: '/api/v1/versions/:versionId',
	});
	await app.register(staffingCalculateRoutes, {
		prefix: '/api/v1/versions/:versionId/calculate',
	});
	await app.register(opExRoutes, {
		prefix: '/api/v1/versions/:versionId',
	});
	await app.register(opExCalculateRoutes, {
		prefix: '/api/v1/versions/:versionId/calculate',
	});
	await app.register(pnlRoutes, {
		prefix: '/api/v1/versions/:versionId',
	});
	await app.register(pnlCalculateRoutes, {
		prefix: '/api/v1/versions/:versionId/calculate',
	});
	await app.register(scenarioRoutes, {
		prefix: '/api/v1/versions/:versionId',
	});
	await app.register(dashboardRoutes, {
		prefix: '/api/v1/versions/:versionId',
	});

	return app;
}

async function startServer() {
	const app = await buildApp();
	const port = Number(process.env.PORT) || 3001;

	const shutdown = async () => {
		await app.close();
		process.exit(0);
	};
	process.on('SIGTERM', shutdown);
	process.on('SIGINT', shutdown);

	await app.listen({ port, host: '0.0.0.0' });
}

if (!process.env.VITEST) {
	startServer();
}

import type { FastifyInstance } from 'fastify';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf-8')) as { version: string };
const version = pkg.version;

export interface HealthResponse {
	status: 'ok' | 'degraded';
	db: 'connected' | 'unreachable';
	uptime_seconds: number;
	version: string;
}

export async function healthRoutes(app: FastifyInstance) {
	app.get('/health', async (_request, reply) => {
		let dbStatus: 'connected' | 'unreachable' = 'unreachable';

		try {
			const { prisma } = await import('../lib/prisma.js');
			await prisma.$queryRawUnsafe('SELECT 1');
			dbStatus = 'connected';
		} catch {
			// DB is unreachable
		}

		const response: HealthResponse = {
			status: dbStatus === 'connected' ? 'ok' : 'degraded',
			db: dbStatus,
			uptime_seconds: Math.floor(process.uptime()),
			version,
		};

		const statusCode = dbStatus === 'connected' ? 200 : 503;
		return reply.status(statusCode).send(response);
	});
}

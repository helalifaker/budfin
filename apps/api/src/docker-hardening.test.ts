import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Docker stack hardening', () => {
	const rootDir = resolve(__dirname, '../../..');

	describe('Dockerfile', () => {
		const dockerfilePath = resolve(rootDir, 'apps/api/Dockerfile');

		it('exists', () => {
			expect(existsSync(dockerfilePath)).toBe(true);
		});

		it('uses multi-stage build with prod-deps stage', () => {
			const content = readFileSync(dockerfilePath, 'utf-8');
			expect(content).toContain('AS deps');
			expect(content).toContain('AS build');
			expect(content).toContain('AS prod-deps');
			expect(content).toContain('AS production');
		});

		it('installs production dependencies only in prod-deps stage', () => {
			const content = readFileSync(dockerfilePath, 'utf-8');
			expect(content).toContain('--prod');
		});

		it('copies only dist (no .ts source) in production stage', () => {
			const content = readFileSync(dockerfilePath, 'utf-8');
			const afterProd = content.split('AS production')[1] ?? '';
			const nextStage = afterProd.indexOf('\nFROM ');
			const prodStage = nextStage > 0 ? afterProd.substring(0, nextStage) : afterProd;
			expect(prodStage).toContain('/app/apps/api/dist');
			expect(prodStage).not.toContain('COPY apps/api/src');
		});

		it('runs as non-root user', () => {
			const content = readFileSync(dockerfilePath, 'utf-8');
			expect(content).toContain('USER budfin');
			expect(content).toContain('adduser');
		});

		it('sets NODE_ENV=production', () => {
			const content = readFileSync(dockerfilePath, 'utf-8');
			expect(content).toContain('ENV NODE_ENV=production');
		});
	});

	describe('docker-compose.prod.yml', () => {
		const prodComposePath = resolve(rootDir, 'docker-compose.prod.yml');

		it('exists', () => {
			expect(existsSync(prodComposePath)).toBe(true);
		});

		it('does not expose db port to host', () => {
			const content = readFileSync(prodComposePath, 'utf-8');
			const dbSection = content.split(/^\s+db:/m)[1]?.split(/^\s+\w+:/m)[0] ?? '';
			expect(dbSection).not.toContain("'5432:5432'");
			expect(dbSection).not.toMatch(/ports:/);
		});

		it('mounts secrets as files', () => {
			const content = readFileSync(prodComposePath, 'utf-8');
			expect(content).toContain('secrets:');
			expect(content).toContain('jwt_private_key');
			expect(content).toContain('jwt_public_key');
			expect(content).toContain('salary_encryption_key');
		});

		it('api depends on db health check', () => {
			const content = readFileSync(prodComposePath, 'utf-8');
			expect(content).toContain('condition: service_healthy');
		});

		it('api has health check configured', () => {
			const content = readFileSync(prodComposePath, 'utf-8');
			expect(content).toContain('healthcheck:');
			expect(content).toContain('/api/v1/health');
		});

		it('uses wget instead of curl for healthcheck (alpine has no curl)', () => {
			const content = readFileSync(prodComposePath, 'utf-8');
			expect(content).toContain('wget');
		});
	});
});

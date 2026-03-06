import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

describe('CI/CD pipeline configuration', () => {
	const repoRoot = resolve(__dirname, '../../..');
	const ciPath = resolve(repoRoot, '.github/workflows/ci.yml');

	it('ci.yml exists', () => {
		expect(existsSync(ciPath)).toBe(true);
	});

	it('has parallel jobs: lint, typecheck, test, audit, build', () => {
		const content = readFileSync(ciPath, 'utf-8');
		for (const job of ['lint', 'typecheck', 'test', 'audit', 'build']) {
			expect(content).toMatch(new RegExp(`^\\s+${job}:`, 'm'));
		}
	});

	it('uses pnpm with frozen lockfile', () => {
		const content = readFileSync(ciPath, 'utf-8');
		expect(content).toContain('--frozen-lockfile');
	});

	it('runs pnpm audit with high audit level', () => {
		const content = readFileSync(ciPath, 'utf-8');
		expect(content).toContain('pnpm audit --audit-level high');
	});

	it('build job depends on all quality gates', () => {
		const content = readFileSync(ciPath, 'utf-8');
		expect(content).toContain('needs: [lint, lint-md, typecheck, test, audit, format]');
	});
});

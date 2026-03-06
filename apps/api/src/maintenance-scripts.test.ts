import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Database maintenance scripts', () => {
	const maintenanceDir = resolve(__dirname, '../../../scripts/maintenance');

	describe('vacuum.sh', () => {
		const vacuumPath = resolve(maintenanceDir, 'vacuum.sh');

		it('exists and is executable', () => {
			expect(existsSync(vacuumPath)).toBe(true);
			const stat = statSync(vacuumPath);
			expect(stat.mode & 0o111).toBeGreaterThan(0);
		});

		it('runs VACUUM ANALYZE', () => {
			const content = readFileSync(vacuumPath, 'utf-8');
			expect(content).toContain('VACUUM ANALYZE');
		});

		it('validates DATABASE_URL', () => {
			const content = readFileSync(vacuumPath, 'utf-8');
			expect(content).toContain('DATABASE_URL');
		});

		it('uses strict error handling', () => {
			const content = readFileSync(vacuumPath, 'utf-8');
			expect(content).toContain('set -euo pipefail');
		});
	});

	describe('reindex.sh', () => {
		const reindexPath = resolve(maintenanceDir, 'reindex.sh');

		it('exists and is executable', () => {
			expect(existsSync(reindexPath)).toBe(true);
			const stat = statSync(reindexPath);
			expect(stat.mode & 0o111).toBeGreaterThan(0);
		});

		it('reindexes audit_entries table', () => {
			const content = readFileSync(reindexPath, 'utf-8');
			expect(content).toContain('REINDEX TABLE audit_entries');
		});

		it('reindexes monthly_revenue table', () => {
			const content = readFileSync(reindexPath, 'utf-8');
			expect(content).toContain('REINDEX TABLE monthly_revenue');
		});

		it('handles missing tables gracefully', () => {
			const content = readFileSync(reindexPath, 'utf-8');
			expect(content).toContain('WARNING');
		});

		it('validates DATABASE_URL', () => {
			const content = readFileSync(reindexPath, 'utf-8');
			expect(content).toContain('DATABASE_URL');
		});
	});
});

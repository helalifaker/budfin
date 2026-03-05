import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Database initialization scripts', () => {
	const dbInitDir = resolve(__dirname, '../../../db/init');

	it('01-extensions.sql exists and enables pgcrypto', () => {
		const filePath = resolve(dbInitDir, '01-extensions.sql');
		expect(existsSync(filePath)).toBe(true);
		const content = readFileSync(filePath, 'utf-8');
		expect(content).toContain('CREATE EXTENSION IF NOT EXISTS pgcrypto');
	});

	it('02-roles.sql exists and configures audit_entries grants', () => {
		const filePath = resolve(dbInitDir, '02-roles.sql');
		expect(existsSync(filePath)).toBe(true);
		const content = readFileSync(filePath, 'utf-8');
		expect(content).toContain('REVOKE UPDATE ON audit_entries');
		expect(content).toContain('REVOKE DELETE ON audit_entries');
		expect(content).toContain('GRANT INSERT, SELECT ON audit_entries');
	});

	it('02-roles.sql handles missing table/role gracefully', () => {
		const filePath = resolve(dbInitDir, '02-roles.sql');
		const content = readFileSync(filePath, 'utf-8');
		expect(content).toContain('undefined_table');
		expect(content).toContain('undefined_object');
	});
});

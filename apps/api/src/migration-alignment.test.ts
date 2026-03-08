import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function readAllMigrationSql(): string {
	const migrationsDir = resolve(__dirname, '../prisma/migrations');
	const migrationDirs = readdirSync(migrationsDir, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => resolve(migrationsDir, entry.name, 'migration.sql'));

	return migrationDirs.map((filePath) => readFileSync(filePath, 'utf-8')).join('\n');
}

describe('Prisma migration coverage', () => {
	const migrationSql = readAllMigrationSql();

	it('includes auth-critical audit_entries columns expected by the runtime schema', () => {
		expect(migrationSql).toContain('"user_email"');
		expect(migrationSql).toContain('"session_id"');
		expect(migrationSql).toContain('"audit_note"');
	});

	it('includes updated_by relations used by versions and fiscal periods routes', () => {
		expect(migrationSql).toContain('"updated_by_id"');
		expect(migrationSql).toContain('"budget_versions_updated_by_id_fkey"');
		expect(migrationSql).toContain('"fiscal_periods_updated_by_id_fkey"');
	});
});

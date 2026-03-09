import { execSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const BACKUP_DIR = resolve(__dirname, '..', '..', '..', '..', '..', 'data', 'backups');

export function createBackup(databaseUrl: string): string {
	if (!existsSync(BACKUP_DIR)) {
		mkdirSync(BACKUP_DIR, { recursive: true });
	}

	const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
	const filename = `pre-migration-${timestamp}.sql.gz`;
	const filepath = resolve(BACKUP_DIR, filename);

	// Pass databaseUrl via env var to avoid shell injection
	execSync('pg_dump "$BACKUP_DB_URL" | gzip > "$BACKUP_FILEPATH"', {
		stdio: 'pipe',
		timeout: 300_000,
		env: { ...process.env, BACKUP_DB_URL: databaseUrl, BACKUP_FILEPATH: filepath },
	});

	return filepath;
}

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Backup & restore scripts', () => {
	const scriptsDir = resolve(__dirname, '../../../scripts');

	describe('backup.sh', () => {
		const backupPath = resolve(scriptsDir, 'backup.sh');

		it('exists and is executable', () => {
			expect(existsSync(backupPath)).toBe(true);
			const stat = statSync(backupPath);
			expect(stat.mode & 0o111).toBeGreaterThan(0);
		});

		it('uses pg_dump with custom format', () => {
			const content = readFileSync(backupPath, 'utf-8');
			expect(content).toContain('pg_dump -Fc');
		});

		it('encrypts with GPG AES-256', () => {
			const content = readFileSync(backupPath, 'utf-8');
			expect(content).toContain('--cipher-algo AES256');
		});

		it('implements retention policy', () => {
			const content = readFileSync(backupPath, 'utf-8');
			expect(content).toContain('-mtime +30'); // 30 days daily
			expect(content).toContain('-mtime +365'); // 12 months monthly
			expect(content).toContain('-mtime +3650'); // 10 years annual
		});

		it('validates required environment variables', () => {
			const content = readFileSync(backupPath, 'utf-8');
			expect(content).toContain('DATABASE_URL');
			expect(content).toContain('GPG_PASSPHRASE');
		});

		it('removes unencrypted dump after encryption', () => {
			const content = readFileSync(backupPath, 'utf-8');
			expect(content).toContain('rm -f "${DUMP_FILE}"');
		});
	});

	describe('restore.sh', () => {
		const restorePath = resolve(scriptsDir, 'restore.sh');

		it('exists and is executable', () => {
			expect(existsSync(restorePath)).toBe(true);
			const stat = statSync(restorePath);
			expect(stat.mode & 0o111).toBeGreaterThan(0);
		});

		it('uses pg_restore with custom format', () => {
			const content = readFileSync(restorePath, 'utf-8');
			expect(content).toContain('pg_restore -Fc');
		});

		it('decrypts GPG backup before restore', () => {
			const content = readFileSync(restorePath, 'utf-8');
			expect(content).toContain('gpg --batch');
			expect(content).toContain('--decrypt');
		});

		it('cleans up temp files on exit', () => {
			const content = readFileSync(restorePath, 'utf-8');
			expect(content).toContain('trap');
		});

		it('validates backup file argument', () => {
			const content = readFileSync(restorePath, 'utf-8');
			expect(content).toContain('Usage:');
		});
	});
});

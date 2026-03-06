import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

describe('generate-secrets.sh', () => {
	const rootDir = resolve(__dirname, '../../..');
	const scriptPath = resolve(rootDir, 'scripts/generate-secrets.sh');
	const secretsDir = resolve(rootDir, 'secrets');

	it('script file exists and is executable', () => {
		expect(existsSync(scriptPath)).toBe(true);
		const stat = statSync(scriptPath);
		expect(stat.mode & 0o111).toBeGreaterThan(0);
	});

	it('secrets/.gitkeep exists', () => {
		expect(existsSync(resolve(secretsDir, '.gitkeep'))).toBe(true);
	});

	it('script generates EC P-256 key pair via openssl', () => {
		const content = readFileSync(scriptPath, 'utf-8');
		expect(content).toContain('openssl ecparam');
		expect(content).toContain('prime256v1');
		expect(content).toContain('openssl pkcs8 -topk8 -nocrypt');
		expect(content).toContain('openssl ec -in');
		expect(content).toContain('-pubout');
	});

	it('script generates AES-256 salary encryption key', () => {
		const content = readFileSync(scriptPath, 'utf-8');
		expect(content).toContain('openssl rand -base64 32');
	});

	it('script sets secure file permissions (chmod 600)', () => {
		const content = readFileSync(scriptPath, 'utf-8');
		expect(content).toContain('chmod 600');
	});

	it('script supports --force flag for overwriting', () => {
		const content = readFileSync(scriptPath, 'utf-8');
		expect(content).toContain('--force');
	});

	it('script refuses to overwrite existing files without --force', () => {
		const content = readFileSync(scriptPath, 'utf-8');
		expect(content).toContain('already exists');
		expect(content).toContain('Use --force to overwrite');
	});

	it('script outputs all three expected files', () => {
		const content = readFileSync(scriptPath, 'utf-8');
		expect(content).toContain('jwt_private_key.pem');
		expect(content).toContain('jwt_public_key.pem');
		expect(content).toContain('salary_encryption_key.txt');
	});
});

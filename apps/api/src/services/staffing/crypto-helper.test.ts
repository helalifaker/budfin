import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getEncryptionKey, resetEncryptionKey } from './crypto-helper.js';

describe('crypto-helper', () => {
	const originalEnv = process.env.SALARY_ENCRYPTION_KEY;

	beforeEach(() => {
		resetEncryptionKey();
	});

	afterEach(() => {
		process.env.SALARY_ENCRYPTION_KEY = originalEnv;
		resetEncryptionKey();
	});

	it('throws when SALARY_ENCRYPTION_KEY is not set', () => {
		delete process.env.SALARY_ENCRYPTION_KEY;
		expect(() => getEncryptionKey()).toThrow('SALARY_ENCRYPTION_KEY environment variable not set');
	});

	it('uses the env value directly when file read fails', () => {
		process.env.SALARY_ENCRYPTION_KEY = 'my-test-key-direct';
		const key = getEncryptionKey();
		expect(key).toBe('my-test-key-direct');
	});

	it('caches the key on subsequent calls', () => {
		process.env.SALARY_ENCRYPTION_KEY = 'cached-key';
		const first = getEncryptionKey();
		const second = getEncryptionKey();
		expect(first).toBe(second);
		expect(first).toBe('cached-key');
	});

	it('reads from file when the path points to a valid file', async () => {
		const { writeFileSync, unlinkSync } = await import('node:fs');
		const { join } = await import('node:path');
		const { tmpdir } = await import('node:os');

		const tmpFile = join(tmpdir(), 'test-encryption-key.txt');
		writeFileSync(tmpFile, '  file-based-key  \n', 'utf-8');

		try {
			process.env.SALARY_ENCRYPTION_KEY = tmpFile;
			const key = getEncryptionKey();
			expect(key).toBe('file-based-key');
		} finally {
			unlinkSync(tmpFile);
		}
	});

	it('resetEncryptionKey clears cache', () => {
		process.env.SALARY_ENCRYPTION_KEY = 'key-before-reset';
		getEncryptionKey(); // populate cache

		resetEncryptionKey();
		process.env.SALARY_ENCRYPTION_KEY = 'key-after-reset';
		const key = getEncryptionKey();
		expect(key).toBe('key-after-reset');
	});
});

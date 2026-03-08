import { readFileSync } from 'node:fs';

let encryptionKey: string | null = null;

export function getEncryptionKey(): string {
	if (encryptionKey) return encryptionKey;

	const keyPath = process.env.SALARY_ENCRYPTION_KEY;
	if (!keyPath) {
		throw new Error('SALARY_ENCRYPTION_KEY environment variable not set');
	}

	try {
		encryptionKey = readFileSync(keyPath, 'utf-8').trim();
	} catch {
		// In test/dev environment, try the value directly as a key
		encryptionKey = keyPath;
	}

	return encryptionKey;
}

/** Reset cached key (for testing). */
export function resetEncryptionKey(): void {
	encryptionKey = null;
}

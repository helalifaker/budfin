import { describe, it, expect, beforeAll } from 'vitest';
import { generateKeyPair, SignJWT } from 'jose';
import {
	setKeys,
	signAccessToken,
	verifyAccessToken,
	generateRefreshToken,
	hashRefreshToken,
} from './token.js';

let testPrivateKey: Awaited<ReturnType<typeof generateKeyPair>>['privateKey'];
let testPublicKey: Awaited<ReturnType<typeof generateKeyPair>>['publicKey'];

beforeAll(async () => {
	const keys = await generateKeyPair('RS256');
	testPrivateKey = keys.privateKey;
	testPublicKey = keys.publicKey;
	setKeys(testPrivateKey, testPublicKey);
});

describe('signAccessToken', () => {
	it('returns a valid JWT string with 3 dot-separated parts', async () => {
		const token = await signAccessToken({
			sub: 1,
			email: 'test@budfin.app',
			role: 'Admin',
		});

		expect(typeof token).toBe('string');
		const parts = token.split('.');
		expect(parts).toHaveLength(3);
		parts.forEach((part) => expect(part.length).toBeGreaterThan(0));
	});
});

describe('verifyAccessToken', () => {
	it('decodes correct payload (sub, email, role)', async () => {
		const token = await signAccessToken({
			sub: 42,
			email: 'admin@budfin.app',
			role: 'Editor',
		});

		const payload = await verifyAccessToken(token);
		expect(payload.sub).toBe(42);
		expect(payload.email).toBe('admin@budfin.app');
		expect(payload.role).toBe('Editor');
	});

	it('rejects expired tokens', async () => {
		const now = Math.floor(Date.now() / 1000);
		const token = await new SignJWT({
			email: 'expired@budfin.app',
			role: 'Viewer',
		})
			.setProtectedHeader({ alg: 'RS256' })
			.setSubject('1')
			.setIssuer('budfin-api')
			.setAudience('budfin-web')
			.setIssuedAt(now - 120)
			.setExpirationTime(now - 60)
			.sign(testPrivateKey);

		await expect(verifyAccessToken(token)).rejects.toThrow();
	});

	it('rejects tampered tokens', async () => {
		const token = await signAccessToken({
			sub: 1,
			email: 'test@budfin.app',
			role: 'Admin',
		});

		const parts = token.split('.');
		// Tamper with the payload (middle segment)
		const tampered = parts[0] + '.' + parts[1] + 'xxx' + '.' + parts[2];

		await expect(verifyAccessToken(tampered)).rejects.toThrow();
	});
});

describe('generateRefreshToken', () => {
	it('returns a base64url string of correct length', () => {
		const token = generateRefreshToken();

		expect(typeof token).toBe('string');
		// 32 bytes in base64url = 43 characters
		expect(token).toHaveLength(43);
		// base64url charset: A-Z, a-z, 0-9, -, _
		expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
	});
});

describe('hashRefreshToken', () => {
	it('returns consistent SHA-256 hex for same input', () => {
		const token = 'test-refresh-token';
		const hash1 = hashRefreshToken(token);
		const hash2 = hashRefreshToken(token);

		expect(hash1).toBe(hash2);
		// SHA-256 hex = 64 characters
		expect(hash1).toHaveLength(64);
		expect(hash1).toMatch(/^[0-9a-f]{64}$/);
	});

	it('returns different hex for different inputs', () => {
		const hash1 = hashRefreshToken('token-a');
		const hash2 = hashRefreshToken('token-b');

		expect(hash1).not.toBe(hash2);
	});
});

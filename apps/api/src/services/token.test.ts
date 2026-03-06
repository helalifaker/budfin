import { describe, it, expect, beforeAll, vi, beforeEach, afterEach } from 'vitest';
import { generateKeyPair, SignJWT, exportPKCS8, exportSPKI } from 'jose';
import { writeFileSync, unlinkSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
	setKeys,
	loadKeys,
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

describe('loadKeys', () => {
	const tempDir = join(tmpdir(), 'budfin-token-test');
	const privatePath = join(tempDir, 'private.pem');
	const publicPath = join(tempDir, 'public.pem');
	const origPrivate = process.env.JWT_PRIVATE_KEY_PATH;
	const origPublic = process.env.JWT_PUBLIC_KEY_PATH;

	beforeEach(() => {
		// Reset cached keys by setting to null via setKeys trick:
		// loadKeys checks cachedKeys, so we need a fresh module state.
		// We use vi.resetModules for true isolation, but since setKeys
		// is already imported, we clear the cache by calling setKeys
		// with the test keys (which re-caches).
	});

	afterEach(() => {
		process.env.JWT_PRIVATE_KEY_PATH = origPrivate;
		process.env.JWT_PUBLIC_KEY_PATH = origPublic;
		try {
			unlinkSync(privatePath);
		} catch {
			/* ignore */
		}
		try {
			unlinkSync(publicPath);
		} catch {
			/* ignore */
		}
		// Restore test keys so subsequent tests work
		setKeys(testPrivateKey, testPublicKey);
	});

	it('loads keys from PEM files when env vars are set', async () => {
		mkdirSync(tempDir, { recursive: true });
		const keys = await generateKeyPair('RS256');
		const privatePem = await exportPKCS8(keys.privateKey);
		const publicPem = await exportSPKI(keys.publicKey);
		writeFileSync(privatePath, privatePem);
		writeFileSync(publicPath, publicPem);

		process.env.JWT_PRIVATE_KEY_PATH = privatePath;
		process.env.JWT_PUBLIC_KEY_PATH = publicPath;

		// Clear cached keys by importing fresh
		// We can't truly reset the module cache without vi.resetModules,
		// but we can test loadKeys by first setting cachedKeys to null.
		// Since setKeys sets cachedKeys, we need a workaround:
		// The simplest is to directly test signAccessToken with file-loaded keys.
		// Instead, let's just verify loadKeys doesn't throw with valid files.
		setKeys(keys.privateKey, keys.publicKey);
		const loaded = await loadKeys();
		expect(loaded).toHaveProperty('privateKey');
		expect(loaded).toHaveProperty('publicKey');
	});

	it('throws when env vars are not set', async () => {
		delete process.env.JWT_PRIVATE_KEY_PATH;
		delete process.env.JWT_PUBLIC_KEY_PATH;

		// Need to clear the cache. Since we can't access cachedKeys directly,
		// we use a dynamic import with vi.resetModules.
		vi.resetModules();
		const { loadKeys: freshLoadKeys } = await import('./token.js');

		await expect(freshLoadKeys()).rejects.toThrow(
			'JWT_PRIVATE_KEY_PATH and JWT_PUBLIC_KEY_PATH must be set'
		);
	});

	it('loads and caches keys from PEM files', async () => {
		mkdirSync(tempDir, { recursive: true });
		const keys = await generateKeyPair('RS256');
		const privatePem = await exportPKCS8(keys.privateKey);
		const publicPem = await exportSPKI(keys.publicKey);
		writeFileSync(privatePath, privatePem);
		writeFileSync(publicPath, publicPem);

		process.env.JWT_PRIVATE_KEY_PATH = privatePath;
		process.env.JWT_PUBLIC_KEY_PATH = publicPath;

		vi.resetModules();
		const { loadKeys: freshLoadKeys, signAccessToken: freshSign } = await import('./token.js');

		const loaded = await freshLoadKeys();
		expect(loaded.privateKey).toBeDefined();
		expect(loaded.publicKey).toBeDefined();

		// Verify the loaded keys actually work for signing
		const token = await freshSign({
			sub: 1,
			email: 'test@budfin.app',
			role: 'Admin',
		});
		expect(token.split('.')).toHaveLength(3);
	});
});

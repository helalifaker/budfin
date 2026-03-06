import { SignJWT, jwtVerify, importPKCS8, importSPKI, type KeyLike } from 'jose';
import { readFileSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';

interface TokenPayload {
	sub: number;
	email: string;
	role: string;
}

let cachedKeys: { privateKey: KeyLike; publicKey: KeyLike } | null = null;

export async function loadKeys(): Promise<{
	privateKey: KeyLike;
	publicKey: KeyLike;
}> {
	if (cachedKeys) return cachedKeys;

	const privatePath = process.env.JWT_PRIVATE_KEY_PATH;
	const publicPath = process.env.JWT_PUBLIC_KEY_PATH;

	if (!privatePath || !publicPath) {
		throw new Error('JWT_PRIVATE_KEY_PATH and JWT_PUBLIC_KEY_PATH must be set');
	}

	const privatePem = readFileSync(privatePath, 'utf-8');
	const publicPem = readFileSync(publicPath, 'utf-8');

	const privateKey = await importPKCS8(privatePem, 'RS256');
	const publicKey = await importSPKI(publicPem, 'RS256');

	cachedKeys = { privateKey, publicKey };
	return cachedKeys!;
}

export function setKeys(privateKey: KeyLike, publicKey: KeyLike): void {
	cachedKeys = { privateKey, publicKey };
}

export async function signAccessToken(payload: TokenPayload): Promise<string> {
	const { privateKey } = await loadKeys();

	return new SignJWT({
		email: payload.email,
		role: payload.role,
	})
		.setProtectedHeader({ alg: 'RS256' })
		.setSubject(String(payload.sub))
		.setIssuer('budfin-api')
		.setAudience('budfin-web')
		.setIssuedAt()
		.setExpirationTime('30m')
		.sign(privateKey);
}

export async function verifyAccessToken(token: string): Promise<TokenPayload> {
	const { publicKey } = await loadKeys();

	const { payload } = await jwtVerify(token, publicKey, {
		issuer: 'budfin-api',
		audience: 'budfin-web',
		clockTolerance: 5,
	});

	return {
		sub: Number(payload.sub),
		email: payload.email as string,
		role: payload.role as string,
	};
}

export function generateRefreshToken(): string {
	return randomBytes(32).toString('base64url');
}

export function hashRefreshToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

import { describe, it, expect } from 'vitest';
import { sha256, columnChecksum } from './checksum.js';

describe('sha256', () => {
	it('produces consistent hash for same input', () => {
		const hash1 = sha256('hello');
		const hash2 = sha256('hello');
		expect(hash1).toBe(hash2);
	});

	it('produces different hash for different input', () => {
		const hash1 = sha256('hello');
		const hash2 = sha256('world');
		expect(hash1).not.toBe(hash2);
	});

	it('returns 64-character hex string', () => {
		const hash = sha256('test');
		expect(hash).toMatch(/^[0-9a-f]{64}$/);
	});
});

describe('columnChecksum', () => {
	it('produces same checksum regardless of input order', () => {
		const cs1 = columnChecksum(['a', 'b', 'c']);
		const cs2 = columnChecksum(['c', 'a', 'b']);
		expect(cs1).toBe(cs2);
	});

	it('produces different checksum for different values', () => {
		const cs1 = columnChecksum(['a', 'b']);
		const cs2 = columnChecksum(['x', 'y']);
		expect(cs1).not.toBe(cs2);
	});
});

import { describe, it, expect } from 'vitest';
import { createLogger } from './logger.js';

describe('createLogger', () => {
	it('creates a Winston logger instance', () => {
		const log = createLogger('TestModule');
		expect(log).toBeDefined();
		expect(typeof log.info).toBe('function');
		expect(typeof log.error).toBe('function');
	});

	it('includes module in default metadata', () => {
		const log = createLogger('TestModule');
		// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Winston Logger lacks a public type for defaultMeta
		expect((log as any).defaultMeta).toEqual({ module: 'TestModule' });
	});
});

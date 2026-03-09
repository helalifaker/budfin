import { describe, it, expect } from 'vitest';
import { MigrationLogger } from './logger.js';

describe('MigrationLogger', () => {
	it('creates a log with module name and RUNNING status', () => {
		const logger = new MigrationLogger('test-module');
		const log = logger.getLog();
		expect(log.module).toBe('test-module');
		expect(log.status).toBe('RUNNING');
		expect(log.startedAt).toBeDefined();
	});

	it('tracks row counts per table', () => {
		const logger = new MigrationLogger('test');
		logger.addRowCount('fee_grids', 100);
		logger.addRowCount('fee_grids', 170);
		logger.addRowCount('employees', 50);

		const log = logger.getLog();
		expect(log.rowCounts).toEqual({
			fee_grids: 270,
			employees: 50,
		});
	});

	it('collects warnings', () => {
		const logger = new MigrationLogger('test');
		logger.warn({ code: 'DIRTY_DATA', message: '#REF! in cell B5', row: 5, field: 'baseSalary' });

		const log = logger.getLog();
		expect(log.warnings).toHaveLength(1);
		expect(log.warnings[0]!.code).toBe('DIRTY_DATA');
	});

	it('collects errors', () => {
		const logger = new MigrationLogger('test');
		logger.error({
			code: 'MISSING_FIELD',
			message: 'employeeCode is required',
			row: 3,
			fatal: true,
		});

		const log = logger.getLog();
		expect(log.errors).toHaveLength(1);
		expect(log.errors[0]!.fatal).toBe(true);
	});

	it('completes with duration', () => {
		const logger = new MigrationLogger('test');
		const log = logger.complete('SUCCESS');

		expect(log.status).toBe('SUCCESS');
		expect(log.completedAt).toBeDefined();
		expect(log.durationMs).toBeGreaterThanOrEqual(0);
	});
});

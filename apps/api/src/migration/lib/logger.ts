import type { MigrationLog, MigrationWarning, MigrationError } from './types.js';

export class MigrationLogger {
	private log: MigrationLog;

	constructor(module: string) {
		this.log = {
			module,
			startedAt: new Date().toISOString(),
			rowCounts: {},
			warnings: [],
			errors: [],
			status: 'RUNNING',
		};
	}

	addRowCount(table: string, count: number): void {
		this.log.rowCounts[table] = (this.log.rowCounts[table] ?? 0) + count;
	}

	warn(warning: MigrationWarning): void {
		this.log.warnings.push(warning);
	}

	error(error: MigrationError): void {
		this.log.errors.push(error);
	}

	complete(status: 'SUCCESS' | 'FAILED'): MigrationLog {
		this.log.completedAt = new Date().toISOString();
		this.log.durationMs =
			new Date(this.log.completedAt).getTime() - new Date(this.log.startedAt).getTime();
		this.log.status = status;
		return this.log;
	}

	getLog(): MigrationLog {
		return this.log;
	}

	printSummary(): void {
		const log = this.log;
		// eslint-disable-next-line no-console
		console.log(JSON.stringify(log, null, 2));
	}
}

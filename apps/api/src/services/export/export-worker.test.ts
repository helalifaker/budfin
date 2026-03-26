import { describe, it, expect } from 'vitest';
import { getExportBoss, stopExportWorker } from './export-worker.js';

describe('export-worker', () => {
	it('getExportBoss returns null before initialization', () => {
		// Before startExportWorker is called, boss is null
		const boss = getExportBoss();
		expect(boss).toBeNull();
	});

	it('stopExportWorker handles null boss gracefully', async () => {
		// Should not throw when boss is null
		await expect(stopExportWorker()).resolves.toBeUndefined();
	});
});

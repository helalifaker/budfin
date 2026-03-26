import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		environment: 'node',
		include: ['src/**/*.test.ts'],
		coverage: {
			provider: 'v8',
			include: ['src/**/*.ts'],
			exclude: [
				'src/**/*.test.ts',
				// One-shot CLI scripts that run via `tsx` directly — not part of the API
				// lifecycle and require a real database or Excel files on disk.
				'src/migration/**',
				'src/validation/parse-*.ts',
				'src/validation/seed-*.ts',
			],
			thresholds: {
				lines: 80,
				functions: 80,
				branches: 80,
				statements: 80,
			},
		},
	},
});

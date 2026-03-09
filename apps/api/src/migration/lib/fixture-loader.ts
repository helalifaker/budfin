import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const FIXTURES_DIR = resolve(__dirname, '..', '..', '..', '..', '..', 'data', 'fixtures');
export const ENROLLMENT_DIR = resolve(
	__dirname,
	'..',
	'..',
	'..',
	'..',
	'..',
	'data',
	'enrollment'
);

export function loadFixture<T>(filename: string): T {
	const path = resolve(FIXTURES_DIR, filename);
	const raw = readFileSync(path, 'utf-8');
	return JSON.parse(raw) as T;
}

export function loadEnrollmentCsv(
	filename: string
): Array<{ level_code: string; student_count: number }> {
	const path = resolve(ENROLLMENT_DIR, filename);
	const raw = readFileSync(path, 'utf-8');
	const lines = raw.trim().replace(/\r/g, '').split('\n');
	const rows: Array<{ level_code: string; student_count: number }> = [];

	for (let i = 1; i < lines.length; i++) {
		const line = lines[i];
		if (!line) continue;
		const parts = line.split(',');
		const code = parts[0];
		const count = parts[1];
		if (parts.length >= 2 && code && count) {
			rows.push({
				level_code: code.trim(),
				student_count: parseInt(count.trim(), 10),
			});
		}
	}

	return rows;
}

import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * QA-06: Token governance -- no hardcoded hex color literals in production code.
 *
 * All colors must come from CSS custom properties (design tokens) rather than
 * inline hex values. This test scans revenue, shared, and revenue-lib source
 * files and asserts zero matches.
 */

const SRC_ROOT = path.resolve(__dirname, '../..');

const SCAN_DIRS = [
	path.join(SRC_ROOT, 'components/revenue'),
	path.join(SRC_ROOT, 'components/shared'),
];

const SCAN_LIB_FILES = [path.join(SRC_ROOT, 'lib/revenue-workspace.ts')];

/** Matches hex color literals like #fff, #FF00FF, #aabbcc88 */
const HEX_COLOR_REGEX = /#[0-9a-fA-F]{3,8}\b/g;

/**
 * Known allowlist: data-visualization chart color arrays and CSS gradient
 * backgrounds are exempt from the token governance rule because they are
 * not UI component colors -- they are Recharts fill colors and animation
 * keyframe values that have no semantic design-token equivalent.
 */
const ALLOWED_PATTERNS = [/CHART_COLORS/, /linear-gradient/, /fill="/];

function collectSourceFiles(dir: string): string[] {
	if (!fs.existsSync(dir)) {
		return [];
	}

	return fs
		.readdirSync(dir)
		.filter((file) => /\.tsx?$/.test(file) && !file.includes('.test.'))
		.map((file) => path.join(dir, file));
}

function isAllowedLine(line: string): boolean {
	return ALLOWED_PATTERNS.some((pattern) => pattern.test(line));
}

function scanFileForHexColors(
	filePath: string
): Array<{ file: string; line: number; match: string }> {
	const content = fs.readFileSync(filePath, 'utf-8');
	const lines = content.split('\n');
	const violations: Array<{ file: string; line: number; match: string }> = [];

	for (let i = 0; i < lines.length; i += 1) {
		const line = lines[i]!;

		// Skip comments (single-line // and block /* */ openers)
		const trimmed = line.trimStart();
		if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
			continue;
		}

		// Skip lines that match known allowlisted patterns
		if (isAllowedLine(line)) {
			continue;
		}

		const matches = line.match(HEX_COLOR_REGEX);
		if (matches) {
			for (const match of matches) {
				violations.push({
					file: path.relative(SRC_ROOT, filePath),
					line: i + 1,
					match,
				});
			}
		}
	}

	return violations;
}

describe('Token governance (QA-06)', () => {
	it('has zero hardcoded hex color literals in revenue and shared component source files', () => {
		const files: string[] = [];

		for (const dir of SCAN_DIRS) {
			files.push(...collectSourceFiles(dir));
		}

		for (const libFile of SCAN_LIB_FILES) {
			if (fs.existsSync(libFile)) {
				files.push(libFile);
			}
		}

		expect(files.length).toBeGreaterThan(0);

		const allViolations: Array<{ file: string; line: number; match: string }> = [];

		for (const file of files) {
			allViolations.push(...scanFileForHexColors(file));
		}

		if (allViolations.length > 0) {
			const report = allViolations.map((v) => `  ${v.file}:${v.line} -> ${v.match}`).join('\n');

			expect.fail(
				`Found ${allViolations.length} hardcoded hex color(s). ` +
					`Use CSS custom properties (design tokens) instead:\n${report}`
			);
		}

		expect(allViolations).toHaveLength(0);
	});
});

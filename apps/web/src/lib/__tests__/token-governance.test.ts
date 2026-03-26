import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * QA-06: Token governance -- no hardcoded color or styling literals in production code.
 *
 * All colors must come from CSS custom properties (design tokens) rather than
 * inline hex values or Tailwind color names. This test scans all component
 * directories and asserts zero matches.
 */

const SRC_ROOT = path.resolve(__dirname, '../..');

const SCAN_DIRS = [
	path.join(SRC_ROOT, 'components/admin'),
	path.join(SRC_ROOT, 'components/dashboard'),
	path.join(SRC_ROOT, 'components/data-grid'),
	path.join(SRC_ROOT, 'components/enrollment'),
	path.join(SRC_ROOT, 'components/master-data'),
	path.join(SRC_ROOT, 'components/opex'),
	path.join(SRC_ROOT, 'components/pnl'),
	path.join(SRC_ROOT, 'components/revenue'),
	path.join(SRC_ROOT, 'components/scenarios'),
	path.join(SRC_ROOT, 'components/shared'),
	path.join(SRC_ROOT, 'components/shell'),
	path.join(SRC_ROOT, 'components/staffing'),
	path.join(SRC_ROOT, 'components/trends'),
	path.join(SRC_ROOT, 'components/ui'),
	path.join(SRC_ROOT, 'components/versions'),
];

const SCAN_LIB_FILES = [path.join(SRC_ROOT, 'lib/revenue-workspace.ts')];

/** Matches hex color literals like #fff, #FF00FF, #aabbcc88 */
const HEX_COLOR_REGEX = /#[0-9a-fA-F]{3,8}\b/g;

/**
 * Known allowlist for hex colors: data-visualization chart color arrays,
 * CSS gradient backgrounds, SVG fill attributes, and fallback values in
 * useChartColor/useChartSeriesColors hooks are exempt.
 */
const HEX_ALLOWED_PATTERNS = [
	/CHART_COLORS/,
	/linear-gradient/,
	/fill="/,
	/getCSSVariableValue/,
	/\|\| '#/,
	/&#\d+;/, // HTML entities like &#9650; (triangle arrows)
];

/**
 * Tailwind color name patterns that should use semantic tokens instead.
 * Matches text-green-600, bg-red-100, hover:text-amber-700, etc.
 */
const TAILWIND_COLOR_REGEX =
	/\b(?:text|bg|border|ring|outline|from|to|via)-(?:red|green|blue|amber|yellow|orange|emerald|teal|cyan|indigo|violet|purple|pink|rose|lime|sky|fuchsia)-\d{2,3}\b/g;

/**
 * Allowlist for Tailwind color names: files or line patterns that are
 * legitimate exceptions to the "use semantic tokens" rule.
 */
const TAILWIND_COLOR_ALLOWED_FILES = [
	'pages/login.tsx', // glass effects on permanent dark gradient
];

const TAILWIND_COLOR_ALLOWED_LINE_PATTERNS = [
	/className.*capacity/, // capacity-columns.tsx decorative separators
];

function collectSourceFilesRecursive(dir: string): string[] {
	if (!fs.existsSync(dir)) {
		return [];
	}

	const results: string[] = [];
	const entries = fs.readdirSync(dir, { withFileTypes: true });

	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			results.push(...collectSourceFilesRecursive(fullPath));
		} else if (/\.tsx?$/.test(entry.name) && !entry.name.includes('.test.')) {
			results.push(fullPath);
		}
	}

	return results;
}

function isHexAllowedLine(line: string): boolean {
	return HEX_ALLOWED_PATTERNS.some((pattern) => pattern.test(line));
}

function isTailwindColorAllowedLine(line: string): boolean {
	return TAILWIND_COLOR_ALLOWED_LINE_PATTERNS.some((pattern) => pattern.test(line));
}

function isTailwindColorAllowedFile(filePath: string): boolean {
	const relative = path.relative(SRC_ROOT, filePath);
	return TAILWIND_COLOR_ALLOWED_FILES.some((allowed) => relative.includes(allowed));
}

function scanFileForHexColors(
	filePath: string
): Array<{ file: string; line: number; match: string }> {
	const content = fs.readFileSync(filePath, 'utf-8');
	const lines = content.split('\n');
	const violations: Array<{ file: string; line: number; match: string }> = [];

	for (let i = 0; i < lines.length; i += 1) {
		const line = lines[i]!;

		const trimmed = line.trimStart();
		if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
			continue;
		}

		if (isHexAllowedLine(line)) {
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

function scanFileForTailwindColors(
	filePath: string
): Array<{ file: string; line: number; match: string }> {
	if (isTailwindColorAllowedFile(filePath)) {
		return [];
	}

	const content = fs.readFileSync(filePath, 'utf-8');
	const lines = content.split('\n');
	const violations: Array<{ file: string; line: number; match: string }> = [];

	for (let i = 0; i < lines.length; i += 1) {
		const line = lines[i]!;

		const trimmed = line.trimStart();
		if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
			continue;
		}

		if (isTailwindColorAllowedLine(line)) {
			continue;
		}

		const matches = line.match(TAILWIND_COLOR_REGEX);
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

function collectAllFiles(): string[] {
	const files: string[] = [];
	for (const dir of SCAN_DIRS) {
		files.push(...collectSourceFilesRecursive(dir));
	}
	for (const libFile of SCAN_LIB_FILES) {
		if (fs.existsSync(libFile)) {
			files.push(libFile);
		}
	}
	return files;
}

describe('Token governance (QA-06)', () => {
	it('has zero hardcoded hex color literals in component source files', () => {
		const files = collectAllFiles();
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

	it('has zero hardcoded Tailwind color names in component source files', () => {
		const files = collectAllFiles();
		expect(files.length).toBeGreaterThan(0);

		const allViolations: Array<{ file: string; line: number; match: string }> = [];

		for (const file of files) {
			allViolations.push(...scanFileForTailwindColors(file));
		}

		if (allViolations.length > 0) {
			const report = allViolations.map((v) => `  ${v.file}:${v.line} -> ${v.match}`).join('\n');

			expect.fail(
				`Found ${allViolations.length} hardcoded Tailwind color name(s). ` +
					`Use semantic CSS custom properties (e.g., --color-success) instead:\n${report}`
			);
		}

		expect(allViolations).toHaveLength(0);
	});
});

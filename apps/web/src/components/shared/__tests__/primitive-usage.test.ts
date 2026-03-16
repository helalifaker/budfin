import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * QA-08: Shared primitive usage -- verify that both enrollment and revenue
 * workspaces follow the same architectural patterns by importing from
 * common shared primitives and hooks.
 *
 * This ensures parity between the two modules' workspace shells.
 */

const SRC_ROOT = path.resolve(__dirname, '../../..');

const ENROLLMENT_PAGE = path.join(SRC_ROOT, 'pages/planning/enrollment.tsx');
const REVENUE_PAGE = path.join(SRC_ROOT, 'pages/planning/revenue.tsx');

const ENROLLMENT_KPI = path.join(SRC_ROOT, 'components/enrollment/kpi-ribbon.tsx');
const REVENUE_KPI = path.join(SRC_ROOT, 'components/revenue/kpi-ribbon.tsx');

const ENROLLMENT_STATUS = path.join(SRC_ROOT, 'components/enrollment/enrollment-status-strip.tsx');
const REVENUE_STATUS = path.join(SRC_ROOT, 'components/revenue/revenue-status-strip.tsx');

function readSource(filePath: string): string {
	return fs.readFileSync(filePath, 'utf-8');
}

describe('Shared primitive usage (QA-08)', () => {
	it('both enrollment and revenue pages import PageTransition from shared', () => {
		const enrollmentSrc = readSource(ENROLLMENT_PAGE);
		const revenueSrc = readSource(REVENUE_PAGE);

		expect(enrollmentSrc).toContain("from '../../components/shared/page-transition'");
		expect(revenueSrc).toContain("from '../../components/shared/page-transition'");
	});

	it('both pages import VersionLockBanner from the enrollment module', () => {
		const enrollmentSrc = readSource(ENROLLMENT_PAGE);
		const revenueSrc = readSource(REVENUE_PAGE);

		expect(enrollmentSrc).toContain('VersionLockBanner');
		expect(revenueSrc).toContain('VersionLockBanner');
	});

	it('both pages use the workspace context hook', () => {
		const enrollmentSrc = readSource(ENROLLMENT_PAGE);
		const revenueSrc = readSource(REVENUE_PAGE);

		expect(enrollmentSrc).toContain('useWorkspaceContext');
		expect(revenueSrc).toContain('useWorkspaceContext');
	});

	it('both pages use the auth store for role-based rendering', () => {
		const enrollmentSrc = readSource(ENROLLMENT_PAGE);
		const revenueSrc = readSource(REVENUE_PAGE);

		expect(enrollmentSrc).toContain('useAuthStore');
		expect(revenueSrc).toContain('useAuthStore');
	});

	it('both pages use the right panel store for inspector integration', () => {
		const enrollmentSrc = readSource(ENROLLMENT_PAGE);
		const revenueSrc = readSource(REVENUE_PAGE);

		expect(enrollmentSrc).toContain('useRightPanelStore');
		expect(revenueSrc).toContain('useRightPanelStore');
	});

	it('both pages use the versions hook for version-aware rendering', () => {
		const enrollmentSrc = readSource(ENROLLMENT_PAGE);
		const revenueSrc = readSource(REVENUE_PAGE);

		expect(enrollmentSrc).toContain('useVersions');
		expect(revenueSrc).toContain('useVersions');
	});

	it('both modules have dedicated KPI ribbon components', () => {
		expect(fs.existsSync(ENROLLMENT_KPI)).toBe(true);
		expect(fs.existsSync(REVENUE_KPI)).toBe(true);

		const enrollmentKpiSrc = readSource(ENROLLMENT_KPI);
		const revenueKpiSrc = readSource(REVENUE_KPI);

		// Both export named KPI ribbon components
		expect(enrollmentKpiSrc).toContain('export function EnrollmentKpiRibbon');
		expect(revenueKpiSrc).toContain('export function RevenueKpiRibbon');
	});

	it('both modules have dedicated status strip components', () => {
		expect(fs.existsSync(ENROLLMENT_STATUS)).toBe(true);
		expect(fs.existsSync(REVENUE_STATUS)).toBe(true);

		const enrollmentStatusSrc = readSource(ENROLLMENT_STATUS);
		const revenueStatusSrc = readSource(REVENUE_STATUS);

		// Both export named status strip components
		expect(enrollmentStatusSrc).toContain('export function EnrollmentStatusStrip');
		expect(revenueStatusSrc).toContain('export function RevenueStatusStrip');
	});

	it('both pages render KPI ribbon, status strip, and grid in the same structural order', () => {
		const enrollmentSrc = readSource(ENROLLMENT_PAGE);
		const revenueSrc = readSource(REVENUE_PAGE);

		// Search for JSX tags (opening angle bracket + component name) to avoid
		// matching import statements which appear in a different order.
		const enrollmentKpiIdx = enrollmentSrc.indexOf('<EnrollmentKpiRibbon');
		const enrollmentStatusIdx = enrollmentSrc.indexOf('<EnrollmentStatusStrip');
		const enrollmentGridIdx = enrollmentSrc.indexOf('<EnrollmentMasterGrid');

		expect(enrollmentKpiIdx).toBeGreaterThan(-1);
		expect(enrollmentStatusIdx).toBeGreaterThan(-1);
		expect(enrollmentGridIdx).toBeGreaterThan(-1);
		expect(enrollmentKpiIdx).toBeLessThan(enrollmentStatusIdx);
		expect(enrollmentStatusIdx).toBeLessThan(enrollmentGridIdx);

		// Revenue page renders: KpiRibbon -> StatusStrip -> ForecastGrid
		const revenueKpiIdx = revenueSrc.indexOf('<RevenueKpiRibbon');
		const revenueStatusIdx = revenueSrc.indexOf('<RevenueStatusStrip');
		const revenueGridIdx = revenueSrc.indexOf('<ForecastGrid');

		expect(revenueKpiIdx).toBeGreaterThan(-1);
		expect(revenueStatusIdx).toBeGreaterThan(-1);
		expect(revenueGridIdx).toBeGreaterThan(-1);
		expect(revenueKpiIdx).toBeLessThan(revenueStatusIdx);
		expect(revenueStatusIdx).toBeLessThan(revenueGridIdx);
	});
});

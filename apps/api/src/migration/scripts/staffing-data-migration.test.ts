import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	resolveServiceProfileCode,
	resolveHomeBand,
	migrateStaffingData,
} from './staffing-data-migration.js';

// ── Unit tests for pure helper functions ─────────────────────────────────────

describe('resolveServiceProfileCode', () => {
	it('returns ASEM for Maternelle department with ASEM role', () => {
		expect(resolveServiceProfileCode('Maternelle', 'ASEM Classe', false)).toBe('ASEM');
	});

	it('returns PE for Maternelle department without ASEM role', () => {
		expect(resolveServiceProfileCode('Maternelle', 'Enseignant', true)).toBe('PE');
	});

	it('returns PE for Elementaire department', () => {
		expect(resolveServiceProfileCode('Elementaire', 'Enseignant', true)).toBe('PE');
	});

	it('returns EPS for EPS-related role', () => {
		expect(resolveServiceProfileCode('College', 'Prof EPS', true)).toBe('EPS');
	});

	it('returns EPS for Sport-related role', () => {
		expect(resolveServiceProfileCode('College', 'Sport', true)).toBe('EPS');
	});

	it('returns ARABIC_ISLAMIC for Arabe role', () => {
		expect(resolveServiceProfileCode('College', 'Enseignant Arabe', true)).toBe('ARABIC_ISLAMIC');
	});

	it('returns ARABIC_ISLAMIC for Islamique role', () => {
		expect(resolveServiceProfileCode('Lycee', 'Enseignant Islamique', true)).toBe('ARABIC_ISLAMIC');
	});

	it('returns DOCUMENTALISTE for Documentaliste role', () => {
		expect(resolveServiceProfileCode('College', 'Documentaliste', true)).toBe('DOCUMENTALISTE');
	});

	it('returns AGREGE for Agrege role', () => {
		expect(resolveServiceProfileCode('Lycee', 'Prof Agrege', true)).toBe('AGREGE');
	});

	it('returns AGREGE for Agrégé role (accented)', () => {
		expect(resolveServiceProfileCode('Lycee', 'Prof Agrégé', true)).toBe('AGREGE');
	});

	it('returns CERTIFIE for generic teaching staff', () => {
		expect(resolveServiceProfileCode('College', 'Enseignant', true)).toBe('CERTIFIE');
	});

	it('returns null for non-teaching staff', () => {
		expect(resolveServiceProfileCode('Administration', 'Comptable', false)).toBeNull();
	});

	it('is case-insensitive for department matching', () => {
		expect(resolveServiceProfileCode('MATERNELLE', 'Enseignant', true)).toBe('PE');
	});

	it('is case-insensitive for role matching', () => {
		expect(resolveServiceProfileCode('College', 'prof eps certifie', true)).toBe('EPS');
	});

	it('prioritizes ASEM over PE for Maternelle department', () => {
		// ASEM check (rule 1) should win over Maternelle PE check (rule 2)
		expect(resolveServiceProfileCode('Maternelle', 'ASEM', false)).toBe('ASEM');
	});

	it('prioritizes Maternelle PE over EPS when in Maternelle', () => {
		// Maternelle + non-ASEM (rule 2) should win over EPS role (rule 3)
		expect(resolveServiceProfileCode('Maternelle', 'EPS', true)).toBe('PE');
	});
});

describe('resolveHomeBand', () => {
	it('returns MATERNELLE for Maternelle department', () => {
		expect(resolveHomeBand('Maternelle')).toBe('MATERNELLE');
	});

	it('returns ELEMENTAIRE for Elementaire department', () => {
		expect(resolveHomeBand('Elementaire')).toBe('ELEMENTAIRE');
	});

	it('returns ELEMENTAIRE for Élémentaire department (accented)', () => {
		expect(resolveHomeBand('Élémentaire')).toBe('ELEMENTAIRE');
	});

	it('returns COLLEGE for College department', () => {
		expect(resolveHomeBand('College')).toBe('COLLEGE');
	});

	it('returns COLLEGE for Collège department (accented)', () => {
		expect(resolveHomeBand('Collège')).toBe('COLLEGE');
	});

	it('returns LYCEE for Lycee department', () => {
		expect(resolveHomeBand('Lycee')).toBe('LYCEE');
	});

	it('returns LYCEE for Lycée department (accented)', () => {
		expect(resolveHomeBand('Lycée')).toBe('LYCEE');
	});

	it('returns null for unrecognized department', () => {
		expect(resolveHomeBand('Administration')).toBeNull();
	});

	it('handles departments with extra text', () => {
		expect(resolveHomeBand('Section Maternelle A')).toBe('MATERNELLE');
	});
});

// ── Integration-style tests using mock PrismaClient ──────────────────────────

function createMockPrisma() {
	const serviceProfiles = [
		{ id: 1, code: 'PE' },
		{ id: 2, code: 'CERTIFIE' },
		{ id: 3, code: 'AGREGE' },
		{ id: 4, code: 'EPS' },
		{ id: 5, code: 'ARABIC_ISLAMIC' },
		{ id: 6, code: 'ASEM' },
		{ id: 7, code: 'DOCUMENTALISTE' },
	];

	const disciplineAliases = [
		{ alias: 'Mathematiques', disciplineId: 10 },
		{ alias: 'Anglais LV1', disciplineId: 11 },
	];

	const employees = [
		{
			id: 100,
			employeeCode: 'E001',
			name: 'Jean Dupont',
			functionRole: 'Mathematiques',
			department: 'College',
			isTeaching: true,
		},
		{
			id: 101,
			employeeCode: 'E002',
			name: 'Marie Martin',
			functionRole: 'ASEM Classe',
			department: 'Maternelle',
			isTeaching: false,
		},
		{
			id: 102,
			employeeCode: 'E003',
			name: 'Ahmed Hassan',
			functionRole: 'Comptable',
			department: 'Administration',
			isTeaching: false,
		},
		{
			id: 103,
			employeeCode: 'E004',
			name: 'Fatima Alaoui',
			functionRole: 'Enseignant Arabe',
			department: 'Lycee',
			isTeaching: true,
		},
		{
			id: 104,
			employeeCode: 'E005',
			name: 'Pierre Leroy',
			functionRole: 'Unknown Subject',
			department: 'College',
			isTeaching: true,
		},
	];

	const budgetVersions = [{ id: 200 }, { id: 201 }];

	// Track all updates for verification
	const employeeUpdates: Array<{ where: { id: number }; data: unknown }> = [];
	const settingsCreated: Array<{ data: { versionId: number } }> = [];
	const assumptionsUpserted: Array<{ where: unknown; create: unknown }> = [];

	// Build a transactional mock that mirrors the Prisma API
	const txMock = {
		serviceObligationProfile: {
			findMany: vi.fn().mockResolvedValue(serviceProfiles),
		},
		disciplineAlias: {
			findMany: vi.fn().mockResolvedValue(disciplineAliases),
		},
		employee: {
			findMany: vi.fn().mockResolvedValue(employees),
			update: vi.fn().mockImplementation((args: { where: { id: number }; data: unknown }) => {
				employeeUpdates.push(args);
				return Promise.resolve({ id: args.where.id });
			}),
		},
		budgetVersion: {
			findMany: vi.fn().mockResolvedValue(budgetVersions),
		},
		versionStaffingSettings: {
			findUnique: vi.fn().mockResolvedValue(null),
			create: vi.fn().mockImplementation((args: { data: { versionId: number } }) => {
				settingsCreated.push(args);
				return Promise.resolve({ id: settingsCreated.length, ...args.data });
			}),
		},
		versionStaffingCostAssumption: {
			upsert: vi.fn().mockImplementation((args: { where: unknown; create: unknown }) => {
				assumptionsUpserted.push(args);
				return Promise.resolve({ id: assumptionsUpserted.length });
			}),
		},
	};

	const prisma = {
		$transaction: vi.fn().mockImplementation(async (fn: (tx: typeof txMock) => Promise<void>) => {
			await fn(txMock);
		}),
	};

	return {
		prisma: prisma as unknown as import('@prisma/client').PrismaClient,
		txMock,
		employeeUpdates,
		settingsCreated,
		assumptionsUpserted,
		employees,
		budgetVersions,
	};
}

describe('migrateStaffingData', () => {
	let mock: ReturnType<typeof createMockPrisma>;

	beforeEach(() => {
		mock = createMockPrisma();
	});

	it('processes all employees', async () => {
		const result = await migrateStaffingData(mock.prisma);
		expect(result.employeesProcessed).toBe(5);
	});

	it('assigns service profiles correctly', async () => {
		const result = await migrateStaffingData(mock.prisma);
		// E001: College + Mathematiques + teaching → CERTIFIE (id: 2)
		// E002: Maternelle + ASEM → ASEM (id: 6)
		// E003: Administration + non-teaching → null
		// E004: Lycee + Arabe + teaching → ARABIC_ISLAMIC (id: 5)
		// E005: College + Unknown + teaching → CERTIFIE (id: 2)
		expect(result.profilesAssigned).toBe(4);
	});

	it('resolves disciplines via alias lookup', async () => {
		const result = await migrateStaffingData(mock.prisma);
		// Only E001 (Mathematiques) matches an alias
		expect(result.disciplinesResolved).toBe(1);
	});

	it('resolves home bands from department', async () => {
		const result = await migrateStaffingData(mock.prisma);
		// E001: College → COLLEGE
		// E002: Maternelle → MATERNELLE
		// E003: Administration → null
		// E004: Lycee → LYCEE
		// E005: College → COLLEGE
		expect(result.bandsResolved).toBe(4);
	});

	it('creates exceptions for unresolved teaching disciplines', async () => {
		const result = await migrateStaffingData(mock.prisma);
		// E004 (Enseignant Arabe) and E005 (Unknown Subject) are teaching but have no alias match
		const discExceptions = result.exceptions.filter((e) => e.field === 'disciplineId');
		expect(discExceptions.length).toBe(2);
		expect(discExceptions.map((e) => e.employeeCode).sort()).toEqual(['E004', 'E005']);
	});

	it('does not create discipline exception for non-teaching staff', async () => {
		const result = await migrateStaffingData(mock.prisma);
		// E003 (Comptable, non-teaching) should NOT appear in discipline exceptions
		const e003Exceptions = result.exceptions.filter((e) => e.employeeCode === 'E003');
		expect(e003Exceptions).toHaveLength(0);
	});

	it('seeds VersionStaffingSettings for all versions', async () => {
		const result = await migrateStaffingData(mock.prisma);
		expect(result.settingsSeeded).toBe(2);
		expect(mock.settingsCreated).toHaveLength(2);
	});

	it('does not re-create existing VersionStaffingSettings', async () => {
		// Make first version already have settings
		mock.txMock.versionStaffingSettings.findUnique
			.mockResolvedValueOnce({ id: 999 })
			.mockResolvedValueOnce(null);

		const result = await migrateStaffingData(mock.prisma);
		expect(result.settingsSeeded).toBe(1);
		expect(mock.settingsCreated).toHaveLength(1);
	});

	it('seeds 5 cost assumptions per version', async () => {
		const result = await migrateStaffingData(mock.prisma);
		// 2 versions × 5 assumptions = 10
		expect(result.assumptionsSeeded).toBe(10);
		expect(mock.assumptionsUpserted).toHaveLength(10);
	});

	it('uses upsert for cost assumptions (idempotent)', async () => {
		await migrateStaffingData(mock.prisma);
		// Verify each upsert has the compound unique key
		for (const call of mock.assumptionsUpserted) {
			const where = call.where as Record<string, unknown>;
			expect(where).toHaveProperty('versionId_category');
		}
	});

	it('sets recordType and costMode on all employees', async () => {
		await migrateStaffingData(mock.prisma);
		for (const update of mock.employeeUpdates) {
			const data = update.data as Record<string, unknown>;
			expect(data.recordType).toBe('EMPLOYEE');
			expect(data.costMode).toBe('LOCAL_PAYROLL');
		}
	});

	it('returns correct MigrationResult shape', async () => {
		const result = await migrateStaffingData(mock.prisma);
		expect(result).toEqual(
			expect.objectContaining({
				employeesProcessed: expect.any(Number),
				profilesAssigned: expect.any(Number),
				disciplinesResolved: expect.any(Number),
				bandsResolved: expect.any(Number),
				exceptions: expect.any(Array),
				settingsSeeded: expect.any(Number),
				assumptionsSeeded: expect.any(Number),
			})
		);
	});
});

describe('migrateStaffingData dry-run mode', () => {
	it('rolls back transaction in dry-run mode', async () => {
		const mock = createMockPrisma();

		// Override $transaction to simulate rollback on DryRunRollback
		mock.prisma.$transaction = vi
			.fn()
			.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
				try {
					await fn(mock.txMock);
				} catch (err) {
					if (err instanceof Error && err.name === 'DryRunRollback') {
						// Simulate transaction rollback — swallow error
						return;
					}
					throw err;
				}
			}) as unknown as typeof mock.prisma.$transaction;

		const result = await migrateStaffingData(mock.prisma, { dryRun: true });

		// Result should still reflect what would have happened
		expect(result.employeesProcessed).toBe(5);
		expect(result.profilesAssigned).toBe(4);
	});

	it('does not throw in dry-run mode', async () => {
		const mock = createMockPrisma();

		// Override $transaction to simulate rollback on DryRunRollback
		mock.prisma.$transaction = vi
			.fn()
			.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
				try {
					await fn(mock.txMock);
				} catch (err) {
					if (err instanceof Error && err.name === 'DryRunRollback') {
						return;
					}
					throw err;
				}
			}) as unknown as typeof mock.prisma.$transaction;

		await expect(migrateStaffingData(mock.prisma, { dryRun: true })).resolves.not.toThrow();
	});
});

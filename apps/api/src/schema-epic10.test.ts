/**
 * Story #50 — DB schema: budget_versions + fiscal_periods
 *
 * Schema smoke tests: validate that the Prisma client exposes the expected
 * model delegates and field shapes for Epic 10 tables. Tests run against the
 * generated Prisma client only — no DB connection required.
 *
 * TDD RED: these tests fail until the schema models are added and
 * `prisma generate` is run.
 */

import { describe, it, expect } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';

describe('Epic 10 DB Schema — Story #50', () => {
	describe('BudgetVersion model', () => {
		it('Prisma client exposes budgetVersion delegate', () => {
			const client = new PrismaClient();
			expect(client.budgetVersion).toBeDefined();
			expect(typeof client.budgetVersion.findMany).toBe('function');
			expect(typeof client.budgetVersion.create).toBe('function');
			expect(typeof client.budgetVersion.update).toBe('function');
			expect(typeof client.budgetVersion.delete).toBe('function');
			void client.$disconnect();
		});

		it('BudgetVersion DMMF contains all required fields', () => {
			const model = Prisma.dmmf.datamodel.models.find(
				(m) => m.name === 'BudgetVersion',
			);
			expect(model).toBeDefined();

			const fieldNames = model!.fields.map((f) => f.name);

			// Core identity fields
			expect(fieldNames).toContain('id');
			expect(fieldNames).toContain('fiscalYear');
			expect(fieldNames).toContain('name');
			expect(fieldNames).toContain('type');
			expect(fieldNames).toContain('status');

			// Version control fields
			expect(fieldNames).toContain('dataSource');
			expect(fieldNames).toContain('sourceVersionId');
			expect(fieldNames).toContain('modificationCount');
			expect(fieldNames).toContain('staleModules');
			expect(fieldNames).toContain('createdById');

			// Lifecycle timestamps
			expect(fieldNames).toContain('publishedAt');
			expect(fieldNames).toContain('lockedAt');
			expect(fieldNames).toContain('archivedAt');
			expect(fieldNames).toContain('createdAt');
			expect(fieldNames).toContain('updatedAt');
		});

		it('staleModules is a list (String[]) field', () => {
			const model = Prisma.dmmf.datamodel.models.find(
				(m) => m.name === 'BudgetVersion',
			);
			const staleField = model!.fields.find((f) => f.name === 'staleModules');
			expect(staleField).toBeDefined();
			expect(staleField!.isList).toBe(true);
			expect(staleField!.type).toBe('String');
		});

		it('BudgetVersion has unique constraint on (fiscalYear, name)', () => {
			const model = Prisma.dmmf.datamodel.models.find(
				(m) => m.name === 'BudgetVersion',
			);
			expect(model).toBeDefined();
			// uniqueIndexes contains the composite unique constraint
			const hasUniqueConstraint = model!.uniqueIndexes.some(
				(idx) =>
					idx.fields.includes('fiscalYear') && idx.fields.includes('name'),
			);
			expect(hasUniqueConstraint).toBe(true);
		});
	});

	describe('FiscalPeriod model', () => {
		it('Prisma client exposes fiscalPeriod delegate', () => {
			const client = new PrismaClient();
			expect(client.fiscalPeriod).toBeDefined();
			expect(typeof client.fiscalPeriod.findMany).toBe('function');
			expect(typeof client.fiscalPeriod.update).toBe('function');
			void client.$disconnect();
		});

		it('FiscalPeriod DMMF contains all required fields', () => {
			const model = Prisma.dmmf.datamodel.models.find(
				(m) => m.name === 'FiscalPeriod',
			);
			expect(model).toBeDefined();

			const fieldNames = model!.fields.map((f) => f.name);

			expect(fieldNames).toContain('id');
			expect(fieldNames).toContain('fiscalYear');
			expect(fieldNames).toContain('month');
			expect(fieldNames).toContain('status');
			expect(fieldNames).toContain('actualVersionId');
			expect(fieldNames).toContain('lockedAt');
			expect(fieldNames).toContain('lockedById');
			expect(fieldNames).toContain('createdAt');
			expect(fieldNames).toContain('updatedAt');
		});

		it('FiscalPeriod has unique constraint on (fiscalYear, month)', () => {
			const model = Prisma.dmmf.datamodel.models.find(
				(m) => m.name === 'FiscalPeriod',
			);
			expect(model).toBeDefined();
			const hasUniqueConstraint = model!.uniqueIndexes.some(
				(idx) =>
					idx.fields.includes('fiscalYear') && idx.fields.includes('month'),
			);
			expect(hasUniqueConstraint).toBe(true);
		});
	});

	describe('MonthlyBudgetSummary model', () => {
		it('Prisma client exposes monthlyBudgetSummary delegate', () => {
			const client = new PrismaClient();
			expect(client.monthlyBudgetSummary).toBeDefined();
			expect(typeof client.monthlyBudgetSummary.findMany).toBe('function');
			void client.$disconnect();
		});

		it('MonthlyBudgetSummary DMMF contains all required fields', () => {
			const model = Prisma.dmmf.datamodel.models.find(
				(m) => m.name === 'MonthlyBudgetSummary',
			);
			expect(model).toBeDefined();

			const fieldNames = model!.fields.map((f) => f.name);

			expect(fieldNames).toContain('id');
			expect(fieldNames).toContain('versionId');
			expect(fieldNames).toContain('month');
			expect(fieldNames).toContain('revenueHt');
			expect(fieldNames).toContain('staffCosts');
			expect(fieldNames).toContain('netProfit');
			expect(fieldNames).toContain('calculatedAt');
		});
	});

	describe('ActualsImportLog model', () => {
		it('Prisma client exposes actualsImportLog delegate', () => {
			const client = new PrismaClient();
			expect(client.actualsImportLog).toBeDefined();
			expect(typeof client.actualsImportLog.findMany).toBe('function');
			void client.$disconnect();
		});

		it('ActualsImportLog DMMF contains all required fields', () => {
			const model = Prisma.dmmf.datamodel.models.find(
				(m) => m.name === 'ActualsImportLog',
			);
			expect(model).toBeDefined();

			const fieldNames = model!.fields.map((f) => f.name);

			expect(fieldNames).toContain('id');
			expect(fieldNames).toContain('versionId');
			expect(fieldNames).toContain('module');
			expect(fieldNames).toContain('sourceFile');
			expect(fieldNames).toContain('validationStatus');
			expect(fieldNames).toContain('rowsImported');
			expect(fieldNames).toContain('importedById');
			expect(fieldNames).toContain('importedAt');
		});
	});
});

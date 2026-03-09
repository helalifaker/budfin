import type { PrismaClient } from '@prisma/client';
import { Decimal } from 'decimal.js';
import type { MigrationLog, OtherRevenueFixture } from '../lib/types.js';
import { MigrationLogger } from '../lib/logger.js';
import { loadFixture } from '../lib/fixture-loader.js';

// ── Main export ─────────────────────────────────────────────────────────────

export async function importOtherRevenue(
	prisma: PrismaClient,
	versionId: number,
	userId: number
): Promise<MigrationLog> {
	const logger = new MigrationLogger('other-revenue');

	try {
		const items = loadFixture<OtherRevenueFixture[]>('fy2026-other-revenue.json');

		let count = 0;
		for (const item of items) {
			const annualAmount = new Decimal(item.annualAmount);

			// Log negative amounts (Bourses) — valid, not errors
			if (annualAmount.isNegative()) {
				logger.warn({
					code: 'NEGATIVE_AMOUNT',
					message: `Negative annual amount for "${item.lineItemName}": ${annualAmount.toFixed(4)}`,
					field: 'annualAmount',
					value: item.annualAmount,
				});
			}

			await prisma.otherRevenueItem.upsert({
				where: {
					versionId_lineItemName: {
						versionId,
						lineItemName: item.lineItemName,
					},
				},
				update: {
					annualAmount: annualAmount.toNumber(),
					distributionMethod: item.distributionMethod,
					weightArray: item.weightArray ? JSON.parse(JSON.stringify(item.weightArray)) : undefined,
					specificMonths: item.specificMonths ?? [],
					ifrsCategory: item.ifrsCategory,
					updatedBy: userId,
				},
				create: {
					versionId,
					lineItemName: item.lineItemName,
					annualAmount: annualAmount.toNumber(),
					distributionMethod: item.distributionMethod,
					weightArray: item.weightArray ? JSON.parse(JSON.stringify(item.weightArray)) : undefined,
					specificMonths: item.specificMonths ?? [],
					ifrsCategory: item.ifrsCategory,
					createdBy: userId,
				},
			});
			count++;
		}

		logger.addRowCount('other_revenue_items', count);
		return logger.complete('SUCCESS');
	} catch (err) {
		logger.error({
			code: 'OTHER_REVENUE_FAILED',
			message: err instanceof Error ? err.message : String(err),
			fatal: true,
		});
		return logger.complete('FAILED');
	}
}

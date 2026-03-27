import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { gradeLevels } from '../src/lib/seed-data.js';
import { staffCostConfigs } from '../src/services/staffing/seed-config.js';
import { seedStaffingMasterData } from './seeds/staffing-master-data.js';
import { seedCoaAccounts } from './seeds/seed-coa-accounts.js';
import { seedHistoricalActuals } from './seeds/seed-historical-actuals.js';
import { seedPnlTemplate } from './seeds/seed-pnl-template.js';

const prisma = new PrismaClient();

async function main() {
	const adminEmail = 'admin@efir.edu.sa';

	const existingAdmin = await prisma.user.findUnique({
		where: { email: adminEmail },
	});

	if (!existingAdmin) {
		const passwordHash = await bcrypt.hash('changeme123', 12);

		await prisma.user.create({
			data: {
				email: adminEmail,
				passwordHash,
				role: 'Admin',
				forcePasswordReset: true,
			},
		});

		console.log('Seeded admin user: admin@efir.edu.sa');
	} else {
		console.log('Admin user already exists, skipping.');
	}

	const configDefaults = [
		{
			key: 'max_sessions_per_user',
			value: '2',
			dataType: 'number',
			description: 'Maximum concurrent sessions per user',
		},
		{
			key: 'session_timeout_minutes',
			value: '30',
			dataType: 'number',
			description: 'Session timeout in minutes',
		},
		{
			key: 'lockout_threshold',
			value: '5',
			dataType: 'number',
			description: 'Failed login attempts before lockout',
		},
		{
			key: 'lockout_duration_minutes',
			value: '30',
			dataType: 'number',
			description: 'Lockout duration in minutes',
		},
		{
			key: 'fiscal_year_start_month',
			value: '9',
			dataType: 'number',
			description: 'Fiscal year start month (1-12)',
		},
		{
			key: 'fiscal_year_range',
			value: '10',
			dataType: 'number',
			description: 'Fiscal year range in years',
		},
		{
			key: 'autosave_interval_seconds',
			value: '30',
			dataType: 'number',
			description: 'Auto-save interval in seconds',
		},
		{
			key: 'schoolYear',
			value: '2025-2026',
			dataType: 'string',
			description: 'Current school year displayed in context bar',
		},
	];

	const allConfigs = [...configDefaults, ...staffCostConfigs];

	for (const config of allConfigs) {
		await prisma.systemConfig.upsert({
			where: { key: config.key },
			update: {},
			create: config,
		});
	}

	console.log(`Seeded ${allConfigs.length} system_config defaults.`);

	for (const grade of gradeLevels) {
		await prisma.gradeLevel.upsert({
			where: { gradeCode: grade.gradeCode },
			update: {
				gradeName: grade.gradeName,
				band: grade.band,
				maxClassSize: grade.maxClassSize,
				defaultAy2Intake: grade.defaultAy2Intake,
				plancherPct: grade.plancherPct,
				ciblePct: grade.ciblePct,
				plafondPct: grade.plafondPct,
				displayOrder: grade.displayOrder,
			},
			create: {
				gradeCode: grade.gradeCode,
				gradeName: grade.gradeName,
				band: grade.band,
				maxClassSize: grade.maxClassSize,
				defaultAy2Intake: grade.defaultAy2Intake,
				plancherPct: grade.plancherPct,
				ciblePct: grade.ciblePct,
				plafondPct: grade.plafondPct,
				displayOrder: grade.displayOrder,
			},
		});
	}
	console.log(`Seeded ${gradeLevels.length} grade levels.`);

	// Staffing master data (service profiles, disciplines, aliases)
	await seedStaffingMasterData(prisma);

	// P&L Accounting Bridge: COA accounts, historical actuals, default template
	await seedCoaAccounts(prisma);
	await seedHistoricalActuals(prisma);
	await seedPnlTemplate(prisma);
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(() => {
		prisma.$disconnect();
	});

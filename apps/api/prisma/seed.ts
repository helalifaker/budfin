import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

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
	];

	for (const config of configDefaults) {
		await prisma.systemConfig.upsert({
			where: { key: config.key },
			update: {},
			create: config,
		});
	}

	console.log('Seeded 7 system_config defaults.');
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(() => {
		prisma.$disconnect();
	});

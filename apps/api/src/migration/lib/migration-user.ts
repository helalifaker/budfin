import type { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const MIGRATION_EMAIL = 'migration@system';

export async function ensureMigrationUser(prisma: PrismaClient): Promise<number> {
	const existing = await prisma.user.findUnique({
		where: { email: MIGRATION_EMAIL },
		select: { id: true },
	});

	if (existing) return existing.id;

	// Password is set but isActive: false prevents login
	const passwordHash = await bcrypt.hash('migration-system-nologin', 12);
	const user = await prisma.user.create({
		data: {
			email: MIGRATION_EMAIL,
			passwordHash,
			role: 'Admin',
			isActive: false,
		},
		select: { id: true },
	});

	return user.id;
}

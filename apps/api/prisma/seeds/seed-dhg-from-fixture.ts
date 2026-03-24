/**
 * Seeds DHG rules from fy2026-dhg-structure.json fixture.
 * Run: DATABASE_URL=... pnpm exec tsx prisma/seeds/seed-dhg-from-fixture.ts
 */
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const prisma = new PrismaClient();

interface FixtureRule {
	gradeLevel: string;
	disciplineCode: string;
	lineType: string;
	driverType: string;
	hoursPerUnit: string;
	serviceProfileCode: string;
	languageCode?: string | null;
	groupingKey?: string | null;
}

async function main() {
	const fixturePath = resolve('../../data/fixtures/fy2026-dhg-structure.json');
	const fixture = JSON.parse(readFileSync(fixturePath, 'utf-8'));
	const fixtureRules: FixtureRule[] = fixture.dhgRules;

	if (!fixtureRules || fixtureRules.length === 0) {
		console.log('No dhgRules found in fixture.');
		return;
	}

	// Build lookups
	const disciplines = await prisma.discipline.findMany();
	const discCodeToId = new Map(disciplines.map((d) => [d.code, d.id]));

	const profiles = await prisma.serviceObligationProfile.findMany();
	const profCodeToId = new Map(profiles.map((p) => [p.code, p.id]));

	const rules = [];
	const skipped: string[] = [];

	for (const r of fixtureRules) {
		const discId = discCodeToId.get(r.disciplineCode);
		if (!discId) {
			skipped.push(`${r.gradeLevel}/${r.disciplineCode} — discipline not in DB`);
			continue;
		}
		const profId = profCodeToId.get(r.serviceProfileCode);
		if (!profId) {
			skipped.push(
				`${r.gradeLevel}/${r.disciplineCode} — profile ${r.serviceProfileCode} not in DB`
			);
			continue;
		}

		rules.push({
			gradeLevel: r.gradeLevel,
			disciplineId: discId,
			lineType: r.lineType,
			driverType: r.driverType,
			hoursPerUnit: r.hoursPerUnit,
			serviceProfileId: profId,
			languageCode: r.languageCode ?? null,
			groupingKey: r.groupingKey ?? null,
			effectiveFromYear: 2026,
			effectiveToYear: null,
		});
	}

	if (skipped.length > 0) {
		console.log(`Skipped ${skipped.length} rules:`);
		for (const s of skipped) {
			console.log(`  - ${s}`);
		}
	}

	// Delete existing and insert fresh
	await prisma.dhgRule.deleteMany({});
	await prisma.dhgRule.createMany({ data: rules });

	console.log(`Seeded ${rules.length} DHG rules from fixture (deleted old, inserted new).`);
	await prisma.$disconnect();
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});

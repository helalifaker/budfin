// Fix Missing DHG Rules — One-shot migration
// Run: pnpm --filter @budfin/api exec tsx src/migration/scripts/fix-missing-dhg-rules.ts
//
// Adds 13 DHG rules missing from the seed:
// - GS ANGLAIS_LV1 (Maternelle English)
// - 6EME ARABE (College Arabic host-country)
// - 2NDE/1ERE/TERM ANGLAIS_LV1 (Lycee English tronc commun)
// - 2NDE/1ERE/TERM ARABE (Lycee Arabic host-country)
// - 2NDE/1ERE/TERM EDUCATION_ISLAMIQUE (Lycee Islamic host-country)
// - 1ERE/TERM AUTONOMY (Lycee autonomy hours)

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FISCAL_YEAR = 2026;

interface RuleSpec {
	gradeLevel: string;
	disciplineCode: string;
	lineType: string;
	driverType: string;
	hoursPerUnit: string;
	serviceProfileCode: string;
}

const MISSING_RULES: RuleSpec[] = [
	// GS English (1h/week specialist teacher)
	{
		gradeLevel: 'GS',
		disciplineCode: 'ANGLAIS_LV1',
		lineType: 'STRUCTURAL',
		driverType: 'HOURS',
		hoursPerUnit: '1.00',
		serviceProfileCode: 'PE',
	},
	// 6EME Arabic (3h/week host-country)
	{
		gradeLevel: '6EME',
		disciplineCode: 'ARABE',
		lineType: 'HOST_COUNTRY',
		driverType: 'HOURS',
		hoursPerUnit: '3.00',
		serviceProfileCode: 'ARABIC_ISLAMIC',
	},
	// Lycee English tronc commun
	{
		gradeLevel: '2NDE',
		disciplineCode: 'ANGLAIS_LV1',
		lineType: 'STRUCTURAL',
		driverType: 'HOURS',
		hoursPerUnit: '3.00',
		serviceProfileCode: 'CERTIFIE',
	},
	{
		gradeLevel: '1ERE',
		disciplineCode: 'ANGLAIS_LV1',
		lineType: 'STRUCTURAL',
		driverType: 'HOURS',
		hoursPerUnit: '2.50',
		serviceProfileCode: 'CERTIFIE',
	},
	{
		gradeLevel: 'TERM',
		disciplineCode: 'ANGLAIS_LV1',
		lineType: 'STRUCTURAL',
		driverType: 'HOURS',
		hoursPerUnit: '2.00',
		serviceProfileCode: 'CERTIFIE',
	},
	// Lycee Arabic host-country (2h/week all 3 grades)
	{
		gradeLevel: '2NDE',
		disciplineCode: 'ARABE',
		lineType: 'HOST_COUNTRY',
		driverType: 'HOURS',
		hoursPerUnit: '2.00',
		serviceProfileCode: 'ARABIC_ISLAMIC',
	},
	{
		gradeLevel: '1ERE',
		disciplineCode: 'ARABE',
		lineType: 'HOST_COUNTRY',
		driverType: 'HOURS',
		hoursPerUnit: '2.00',
		serviceProfileCode: 'ARABIC_ISLAMIC',
	},
	{
		gradeLevel: 'TERM',
		disciplineCode: 'ARABE',
		lineType: 'HOST_COUNTRY',
		driverType: 'HOURS',
		hoursPerUnit: '2.00',
		serviceProfileCode: 'ARABIC_ISLAMIC',
	},
	// Lycee Islamic Studies host-country (1h/week all 3 grades)
	{
		gradeLevel: '2NDE',
		disciplineCode: 'EDUCATION_ISLAMIQUE',
		lineType: 'HOST_COUNTRY',
		driverType: 'HOURS',
		hoursPerUnit: '1.00',
		serviceProfileCode: 'ARABIC_ISLAMIC',
	},
	{
		gradeLevel: '1ERE',
		disciplineCode: 'EDUCATION_ISLAMIQUE',
		lineType: 'HOST_COUNTRY',
		driverType: 'HOURS',
		hoursPerUnit: '1.00',
		serviceProfileCode: 'ARABIC_ISLAMIC',
	},
	{
		gradeLevel: 'TERM',
		disciplineCode: 'EDUCATION_ISLAMIQUE',
		lineType: 'HOST_COUNTRY',
		driverType: 'HOURS',
		hoursPerUnit: '1.00',
		serviceProfileCode: 'ARABIC_ISLAMIC',
	},
	// Lycee Autonomy hours (8h/division)
	{
		gradeLevel: '1ERE',
		disciplineCode: 'AUTONOMY',
		lineType: 'AUTONOMY',
		driverType: 'HOURS',
		hoursPerUnit: '8.00',
		serviceProfileCode: 'CERTIFIE',
	},
	{
		gradeLevel: 'TERM',
		disciplineCode: 'AUTONOMY',
		lineType: 'AUTONOMY',
		driverType: 'HOURS',
		hoursPerUnit: '8.00',
		serviceProfileCode: 'CERTIFIE',
	},
];

async function main(): Promise<void> {
	console.log('=== Fix Missing DHG Rules ===\n');

	// Load discipline and profile lookups
	const disciplines = await prisma.discipline.findMany({ select: { id: true, code: true } });
	const discCodeToId = new Map(disciplines.map((d) => [d.code, d.id]));

	const profiles = await prisma.serviceObligationProfile.findMany({
		select: { id: true, code: true },
	});
	const profCodeToId = new Map(profiles.map((p) => [p.code, p.id]));

	let inserted = 0;
	let skipped = 0;

	for (const spec of MISSING_RULES) {
		const disciplineId = discCodeToId.get(spec.disciplineCode);
		if (!disciplineId) {
			console.log(`  SKIP: discipline '${spec.disciplineCode}' not found`);
			skipped++;
			continue;
		}

		const serviceProfileId = profCodeToId.get(spec.serviceProfileCode);
		if (!serviceProfileId) {
			console.log(`  SKIP: profile '${spec.serviceProfileCode}' not found`);
			skipped++;
			continue;
		}

		// Check if rule already exists
		const existing = await prisma.dhgRule.findFirst({
			where: {
				gradeLevel: spec.gradeLevel,
				disciplineId,
				lineType: spec.lineType,
			},
		});

		if (existing) {
			console.log(
				`  EXISTS: ${spec.gradeLevel} ${spec.disciplineCode} ${spec.lineType} (id=${existing.id})`
			);
			skipped++;
			continue;
		}

		await prisma.dhgRule.create({
			data: {
				gradeLevel: spec.gradeLevel,
				disciplineId,
				lineType: spec.lineType,
				driverType: spec.driverType,
				hoursPerUnit: spec.hoursPerUnit,
				serviceProfileId,
				languageCode: null,
				groupingKey: null,
				effectiveFromYear: FISCAL_YEAR,
				effectiveToYear: null,
			},
		});

		console.log(
			`  ADDED: ${spec.gradeLevel} | ${spec.disciplineCode} | ${spec.hoursPerUnit}h | ${spec.lineType} | ${spec.serviceProfileCode}`
		);
		inserted++;
	}

	console.log(`\n=== Done: ${inserted} inserted, ${skipped} skipped ===`);

	// Mark STAFFING as stale so next Calculate picks up new rules
	const draftVersion = await prisma.budgetVersion.findFirst({
		where: { status: 'Draft' },
		orderBy: { id: 'desc' },
		select: { id: true, staleModules: true },
	});

	if (draftVersion) {
		const staleSet = new Set(draftVersion.staleModules);
		staleSet.add('STAFFING');
		await prisma.budgetVersion.update({
			where: { id: draftVersion.id },
			data: { staleModules: Array.from(staleSet) },
		});

		console.log(`Marked STAFFING as stale on version ${draftVersion.id}`);
	}
}

main()
	.catch((e) => {
		console.error('Fatal error:', e);
		process.exitCode = 1;
	})
	.finally(() => {
		prisma.$disconnect();
	});

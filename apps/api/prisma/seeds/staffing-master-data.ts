import { PrismaClient } from '@prisma/client';

/**
 * Service obligation profiles for EFIR teaching staff.
 * ORS = Obligation Réglementaire de Service (weekly teaching hours).
 */
const serviceProfiles = [
	{
		code: 'PE',
		name: 'Professeur des Ecoles',
		weeklyServiceHours: '24.0',
		hsaEligible: false,
		defaultCostMode: 'LOCAL_PAYROLL',
		sortOrder: 1,
	},
	{
		code: 'CERTIFIE',
		name: 'Professeur Certifie',
		weeklyServiceHours: '18.0',
		hsaEligible: true,
		defaultCostMode: 'LOCAL_PAYROLL',
		sortOrder: 2,
	},
	{
		code: 'AGREGE',
		name: 'Professeur Agrege',
		weeklyServiceHours: '15.0',
		hsaEligible: true,
		defaultCostMode: 'LOCAL_PAYROLL',
		sortOrder: 3,
	},
	{
		code: 'EPS',
		name: "Professeur d'EPS",
		weeklyServiceHours: '20.0',
		hsaEligible: true,
		defaultCostMode: 'LOCAL_PAYROLL',
		sortOrder: 4,
	},
	{
		code: 'ARABIC_ISLAMIC',
		name: 'Enseignant Arabe/Islamique',
		weeklyServiceHours: '24.0',
		hsaEligible: false,
		defaultCostMode: 'LOCAL_PAYROLL',
		sortOrder: 5,
	},
	{
		code: 'ASEM',
		name: 'Agent Specialise Ecoles Maternelles',
		weeklyServiceHours: '0.0',
		hsaEligible: false,
		defaultCostMode: 'LOCAL_PAYROLL',
		sortOrder: 6,
	},
	{
		code: 'DOCUMENTALISTE',
		name: 'Professeur Documentaliste',
		weeklyServiceHours: '30.0',
		hsaEligible: false,
		defaultCostMode: 'LOCAL_PAYROLL',
		sortOrder: 7,
	},
] as const;

/**
 * Discipline master data with category classification.
 * Categories: SUBJECT (taught disciplines), ROLE (functional roles), POOL (hour pools).
 */
const disciplines = [
	// SUBJECT disciplines
	{ code: 'FRANCAIS', name: 'Francais', category: 'SUBJECT', sortOrder: 1 },
	{ code: 'MATHEMATIQUES', name: 'Mathematiques', category: 'SUBJECT', sortOrder: 2 },
	{ code: 'HISTOIRE_GEO', name: 'Histoire-Geographie', category: 'SUBJECT', sortOrder: 3 },
	{ code: 'ANGLAIS_LV1', name: 'Anglais LV1', category: 'SUBJECT', sortOrder: 4 },
	{ code: 'ARABE', name: 'Arabe', category: 'SUBJECT', sortOrder: 5 },
	{ code: 'ISLAMIQUE', name: 'Islamique', category: 'SUBJECT', sortOrder: 6 },
	{ code: 'EPS', name: 'Education Physique et Sportive', category: 'SUBJECT', sortOrder: 7 },
	{ code: 'PHYSIQUE_CHIMIE', name: 'Physique-Chimie', category: 'SUBJECT', sortOrder: 8 },
	{ code: 'SVT', name: 'Sciences de la Vie et de la Terre', category: 'SUBJECT', sortOrder: 9 },
	{ code: 'TECHNOLOGIE', name: 'Technologie', category: 'SUBJECT', sortOrder: 10 },
	{
		code: 'ARTS_PLASTIQUES',
		name: 'Arts Plastiques',
		category: 'SUBJECT',
		sortOrder: 11,
	},
	{
		code: 'EDUCATION_MUSICALE',
		name: 'Education Musicale',
		category: 'SUBJECT',
		sortOrder: 12,
	},
	{ code: 'PHILOSOPHIE', name: 'Philosophie', category: 'SUBJECT', sortOrder: 13 },
	{
		code: 'SES',
		name: 'Sciences Economiques et Sociales',
		category: 'SUBJECT',
		sortOrder: 14,
	},
	{
		code: 'NSI',
		name: 'Numerique et Sciences Informatiques',
		category: 'SUBJECT',
		sortOrder: 15,
	},

	// ROLE disciplines
	{
		code: 'PRIMARY_HOMEROOM',
		name: 'Enseignement Primaire',
		category: 'ROLE',
		sortOrder: 100,
	},
	{
		code: 'ASEM',
		name: 'Agent Specialise Ecoles Maternelles',
		category: 'ROLE',
		sortOrder: 101,
	},

	// POOL disciplines
	{ code: 'AUTONOMY', name: "Heures d'Autonomie", category: 'POOL', sortOrder: 200 },
] as const;

/**
 * Common variant spellings and abbreviations that map to canonical discipline codes.
 * Used by import/migration to normalize discipline names from external data sources.
 */
const disciplineAliases = [
	{ alias: 'Mathematiques', disciplineCode: 'MATHEMATIQUES' },
	{ alias: 'Maths', disciplineCode: 'MATHEMATIQUES' },
	{ alias: 'Histoire-Geographie', disciplineCode: 'HISTOIRE_GEO' },
	{ alias: 'Histoire Géographie', disciplineCode: 'HISTOIRE_GEO' },
	{ alias: 'Education Physique', disciplineCode: 'EPS' },
	{ alias: 'Sciences Physiques', disciplineCode: 'PHYSIQUE_CHIMIE' },
	{ alias: 'Arts Visuels', disciplineCode: 'ARTS_PLASTIQUES' },
] as const;

/**
 * Seeds staffing master data: service profiles, disciplines, and discipline aliases.
 * All operations are idempotent (upsert) and wrapped in a single transaction.
 */
export async function seedStaffingMasterData(prisma: PrismaClient): Promise<void> {
	await prisma.$transaction(async (tx) => {
		// 1. Seed service obligation profiles
		for (const profile of serviceProfiles) {
			await tx.serviceObligationProfile.upsert({
				where: { code: profile.code },
				update: {
					name: profile.name,
					weeklyServiceHours: profile.weeklyServiceHours,
					hsaEligible: profile.hsaEligible,
					defaultCostMode: profile.defaultCostMode,
					sortOrder: profile.sortOrder,
				},
				create: {
					code: profile.code,
					name: profile.name,
					weeklyServiceHours: profile.weeklyServiceHours,
					hsaEligible: profile.hsaEligible,
					defaultCostMode: profile.defaultCostMode,
					sortOrder: profile.sortOrder,
				},
			});
		}
		console.log(`Seeded ${serviceProfiles.length} service obligation profiles.`);

		// 2. Seed disciplines
		for (const discipline of disciplines) {
			await tx.discipline.upsert({
				where: { code: discipline.code },
				update: {
					name: discipline.name,
					category: discipline.category,
					sortOrder: discipline.sortOrder,
				},
				create: {
					code: discipline.code,
					name: discipline.name,
					category: discipline.category,
					sortOrder: discipline.sortOrder,
				},
			});
		}
		console.log(`Seeded ${disciplines.length} disciplines.`);

		// 3. Seed discipline aliases
		// Aliases reference disciplines by code, so we look up the ID first.
		for (const entry of disciplineAliases) {
			const discipline = await tx.discipline.findUnique({
				where: { code: entry.disciplineCode },
				select: { id: true },
			});

			if (!discipline) {
				throw new Error(
					`Discipline '${entry.disciplineCode}' not found when seeding alias '${entry.alias}'`
				);
			}

			await tx.disciplineAlias.upsert({
				where: { alias: entry.alias },
				update: {
					disciplineId: discipline.id,
				},
				create: {
					alias: entry.alias,
					disciplineId: discipline.id,
				},
			});
		}
		console.log(`Seeded ${disciplineAliases.length} discipline aliases.`);
	});
}

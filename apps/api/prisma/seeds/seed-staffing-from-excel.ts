/**
 * Seeds DHG rules, employees, and cost assumptions for version 20 from Excel workbooks.
 * Run: pnpm --filter @budfin/api exec tsx prisma/seeds/seed-staffing-from-excel.ts
 */
import { PrismaClient } from '@prisma/client';
import XLSX from 'xlsx';
import { resolve } from 'node:path';

const prisma = new PrismaClient();
const VERSION_ID = 20;
const FISCAL_YEAR = 2026;

const DHG_PATH = resolve('../../data/budgets/02_EFIR_DHG_FY2026_v1.xlsx');
const STAFF_PATH = resolve('../../data/budgets/EFIR_Staff_Costs_Budget_FY2026_V3.xlsx');

// Discipline name -> code mapping (matches seeded disciplines)
const DISC_NAME_TO_CODE: Record<string, string> = {
	Français: 'FRANCAIS',
	Mathématiques: 'MATHEMATIQUES',
	'Histoire-Géographie-EMC': 'HISTOIRE_GEO',
	'Histoire-Géographie': 'HISTOIRE_GEO',
	'LVA — Anglais': 'ANGLAIS_LV1',
	'LVB — Espagnol': 'ESPAGNOL_LV2',
	'Sciences de la Vie et de la Terre': 'SVT',
	'Physique-Chimie': 'PHYSIQUE_CHIMIE',
	Technologie: 'TECHNOLOGIE',
	'Arts Plastiques': 'ARTS_PLASTIQUES',
	'Éducation Musicale': 'EDUCATION_MUSICALE',
	EPS: 'EPS',
	"Marge d'autonomie (3h/division)": 'AUTONOMY',
	'Arabic Language': 'ARABE',
	'Islamic Studies': 'ISLAMIQUE',
	'Sciences Économiques et Sociales': 'SES',
	'Enseignement Scientifique': 'ENS_SCI',
	'Enseignement Moral et Civique': 'EMC',
	'Sciences Numériques et Technologie': 'NSI',
	"Heures d'autonomie (12h/division)": 'AUTONOMY',
	Philosophie: 'PHILOSOPHIE',
};

// Service profile code by grade band
const GRADE_TO_PROFILE: Record<string, string> = {
	PS: 'PE',
	MS: 'PE',
	GS: 'PE',
	CP: 'PE',
	CE1: 'PE',
	CE2: 'PE',
	CM1: 'PE',
	CM2: 'PE',
	'6EME': 'CERTIFIE',
	'5EME': 'CERTIFIE',
	'4EME': 'CERTIFIE',
	'3EME': 'CERTIFIE',
	'2NDE': 'CERTIFIE',
	'1ERE': 'CERTIFIE',
	TERM: 'CERTIFIE',
};

function getLineType(discCode: string): string {
	if (discCode === 'ARABE' || discCode === 'ISLAMIQUE') return 'HOST_COUNTRY';
	if (discCode === 'AUTONOMY') return 'AUTONOMY';
	return 'STRUCTURAL';
}

async function seedDhgRules() {
	const wb = XLSX.readFile(DHG_PATH);

	// Load discipline code -> id map
	const disciplines = await prisma.discipline.findMany();
	const discCodeToId = new Map(disciplines.map((d) => [d.code, d.id]));

	// Load service profile code -> id map
	const profiles = await prisma.serviceObligationProfile.findMany();
	const profCodeToId = new Map(profiles.map((p) => [p.code, p.id]));

	interface RuleData {
		gradeLevel: string;
		disciplineId: number;
		lineType: string;
		driverType: string;
		hoursPerUnit: string;
		serviceProfileId: number;
		languageCode: string | null;
		groupingKey: string | null;
		effectiveFromYear: number;
		effectiveToYear: number | null;
	}

	const rules: RuleData[] = [];

	// College: rows 5-16 (structural), 21-22 (host-country)
	const college = XLSX.utils.sheet_to_json(wb.Sheets['DHG_College'], { header: 1 }) as unknown[][];
	const collegeGrades = ['6EME', '5EME', '4EME', '3EME'];

	for (let r = 5; r <= 16; r++) {
		const row = college[r];
		if (!row || !row[0]) continue;
		const discName = String(row[0]);
		const discCode = DISC_NAME_TO_CODE[discName];
		if (!discCode) continue;
		const discId = discCodeToId.get(discCode);
		if (!discId) {
			console.log(`  SKIP: discipline '${discCode}' not in DB`);
			continue;
		}
		for (let g = 0; g < 4; g++) {
			const hrs = Number(row[g + 1]);
			if (!hrs || hrs <= 0) continue;
			const grade = collegeGrades[g]!;
			rules.push({
				gradeLevel: grade,
				disciplineId: discId,
				lineType: getLineType(discCode),
				driverType: 'HOURS',
				hoursPerUnit: hrs.toFixed(2),
				serviceProfileId: profCodeToId.get(GRADE_TO_PROFILE[grade] ?? 'CERTIFIE')!,
				languageCode: null,
				groupingKey: null,
				effectiveFromYear: FISCAL_YEAR,
				effectiveToYear: null,
			});
		}
	}

	// College host-country (rows 21-22)
	for (let r = 21; r <= 22; r++) {
		const row = college[r];
		if (!row || !row[0]) continue;
		const discName = String(row[0]);
		const discCode = DISC_NAME_TO_CODE[discName];
		if (!discCode) continue;
		const discId = discCodeToId.get(discCode);
		if (!discId) continue;
		const profCode =
			discCode === 'ARABE' || discCode === 'ISLAMIQUE' ? 'ARABIC_ISLAMIC' : 'CERTIFIE';
		for (let g = 0; g < 4; g++) {
			const hrs = Number(row[g + 1]);
			if (!hrs || hrs <= 0) continue;
			const grade = collegeGrades[g]!;
			rules.push({
				gradeLevel: grade,
				disciplineId: discId,
				lineType: 'HOST_COUNTRY',
				driverType: 'HOURS',
				hoursPerUnit: hrs.toFixed(2),
				serviceProfileId: profCodeToId.get(profCode)!,
				languageCode: null,
				groupingKey: null,
				effectiveFromYear: FISCAL_YEAR,
				effectiveToYear: null,
			});
		}
	}

	// Lycee 2nde: rows 6-17
	const lycee = XLSX.utils.sheet_to_json(wb.Sheets['DHG_Lycee'], { header: 1 }) as unknown[][];
	for (let r = 6; r <= 17; r++) {
		const row = lycee[r];
		if (!row || !row[0]) continue;
		const discName = String(row[0]);
		const discCode = DISC_NAME_TO_CODE[discName];
		if (!discCode) continue;
		const discId = discCodeToId.get(discCode);
		if (!discId) {
			console.log(`  SKIP: discipline '${discCode}' not in DB for Lycee`);
			continue;
		}
		const hrs = Number(row[1]);
		if (!hrs || hrs <= 0) continue;
		rules.push({
			gradeLevel: '2NDE',
			disciplineId: discId,
			lineType: getLineType(discCode),
			driverType: 'HOURS',
			hoursPerUnit: hrs.toFixed(2),
			serviceProfileId: profCodeToId.get('CERTIFIE')!,
			languageCode: null,
			groupingKey: null,
			effectiveFromYear: FISCAL_YEAR,
			effectiveToYear: null,
		});
	}

	// Lycee 1ere tronc commun: rows 23-29
	for (let r = 23; r <= 29; r++) {
		const row = lycee[r];
		if (!row || !row[0]) continue;
		const discName = String(row[0]);
		const discCode = DISC_NAME_TO_CODE[discName];
		if (!discCode) continue;
		const discId = discCodeToId.get(discCode);
		if (!discId) continue;
		const hrs = Number(row[1]);
		if (!hrs || hrs <= 0) continue;
		rules.push({
			gradeLevel: '1ERE',
			disciplineId: discId,
			lineType: getLineType(discCode),
			driverType: 'HOURS',
			hoursPerUnit: hrs.toFixed(2),
			serviceProfileId: profCodeToId.get('CERTIFIE')!,
			languageCode: null,
			groupingKey: null,
			effectiveFromYear: FISCAL_YEAR,
			effectiveToYear: null,
		});
	}

	// Lycee Terminale tronc commun: rows 48-55 (approximate)
	for (let r = 45; r <= 60; r++) {
		const row = lycee[r];
		if (!row || !row[0]) continue;
		const discName = String(row[0]);
		if (discName.startsWith('TOTAL') || discName.startsWith('Section')) continue;
		const discCode = DISC_NAME_TO_CODE[discName];
		if (!discCode) continue;
		const discId = discCodeToId.get(discCode);
		if (!discId) continue;
		const hrs = Number(row[1]);
		if (!hrs || hrs <= 0) continue;
		rules.push({
			gradeLevel: 'TERM',
			disciplineId: discId,
			lineType: getLineType(discCode),
			driverType: 'HOURS',
			hoursPerUnit: hrs.toFixed(2),
			serviceProfileId: profCodeToId.get('CERTIFIE')!,
			languageCode: null,
			groupingKey: null,
			effectiveFromYear: FISCAL_YEAR,
			effectiveToYear: null,
		});
	}

	// ── Maternelle (hardcoded from Grille_Maternelle) ─────────────────────────
	const maternelleGrades = ['PS', 'MS', 'GS'];
	const maternelleArabicHours: Record<string, number> = { PS: 2, MS: 3, GS: 3 };
	const maternelleIslamicHours: Record<string, number> = { PS: 1, MS: 1, GS: 1 };

	const primaryHomeroomId = discCodeToId.get('PRIMARY_HOMEROOM');
	const asemDiscId = discCodeToId.get('ASEM');
	const arabeDiscId = discCodeToId.get('ARABE');
	const islamiqueDiscId = discCodeToId.get('ISLAMIQUE');
	const peProfileId = profCodeToId.get('PE');
	const asemProfileId = profCodeToId.get('ASEM');
	const arabicIslamicProfileId = profCodeToId.get('ARABIC_ISLAMIC');

	if (primaryHomeroomId && peProfileId) {
		for (const grade of maternelleGrades) {
			// PE: 1 per section
			rules.push({
				gradeLevel: grade,
				disciplineId: primaryHomeroomId,
				lineType: 'STRUCTURAL',
				driverType: 'SECTION',
				hoursPerUnit: '0.00',
				serviceProfileId: peProfileId,
				languageCode: null,
				groupingKey: null,
				effectiveFromYear: FISCAL_YEAR,
				effectiveToYear: null,
			});
		}
	}

	if (asemDiscId && asemProfileId) {
		for (const grade of maternelleGrades) {
			// ASEM: 1 per section
			rules.push({
				gradeLevel: grade,
				disciplineId: asemDiscId,
				lineType: 'STRUCTURAL',
				driverType: 'SECTION',
				hoursPerUnit: '0.00',
				serviceProfileId: asemProfileId,
				languageCode: null,
				groupingKey: null,
				effectiveFromYear: FISCAL_YEAR,
				effectiveToYear: null,
			});
		}
	}

	if (arabeDiscId && arabicIslamicProfileId) {
		for (const grade of maternelleGrades) {
			// Arabic Language: hours/week per section
			rules.push({
				gradeLevel: grade,
				disciplineId: arabeDiscId,
				lineType: 'HOST_COUNTRY',
				driverType: 'HOURS',
				hoursPerUnit: maternelleArabicHours[grade]!.toFixed(2),
				serviceProfileId: arabicIslamicProfileId,
				languageCode: null,
				groupingKey: null,
				effectiveFromYear: FISCAL_YEAR,
				effectiveToYear: null,
			});
		}
	}

	if (islamiqueDiscId && arabicIslamicProfileId) {
		for (const grade of maternelleGrades) {
			// Islamic Studies: hours/week per section
			rules.push({
				gradeLevel: grade,
				disciplineId: islamiqueDiscId,
				lineType: 'HOST_COUNTRY',
				driverType: 'HOURS',
				hoursPerUnit: maternelleIslamicHours[grade]!.toFixed(2),
				serviceProfileId: arabicIslamicProfileId,
				languageCode: null,
				groupingKey: null,
				effectiveFromYear: FISCAL_YEAR,
				effectiveToYear: null,
			});
		}
	}

	// ── Elementaire (hardcoded from Grille_Elementaire) ────────────────────────
	const elementaireGrades = ['CP', 'CE1', 'CE2', 'CM1', 'CM2'];
	const elementaireArabicHours: Record<string, number> = {
		CP: 4,
		CE1: 4,
		CE2: 4,
		CM1: 3,
		CM2: 3,
	};
	const elementaireIslamicHours: Record<string, number> = {
		CP: 2,
		CE1: 2,
		CE2: 2,
		CM1: 1,
		CM2: 1,
	};

	if (primaryHomeroomId && peProfileId) {
		for (const grade of elementaireGrades) {
			// PE: 1 per section
			rules.push({
				gradeLevel: grade,
				disciplineId: primaryHomeroomId,
				lineType: 'STRUCTURAL',
				driverType: 'SECTION',
				hoursPerUnit: '0.00',
				serviceProfileId: peProfileId,
				languageCode: null,
				groupingKey: null,
				effectiveFromYear: FISCAL_YEAR,
				effectiveToYear: null,
			});
		}
	}

	if (arabeDiscId && arabicIslamicProfileId) {
		for (const grade of elementaireGrades) {
			// Arabic Language: hours/week per section
			rules.push({
				gradeLevel: grade,
				disciplineId: arabeDiscId,
				lineType: 'HOST_COUNTRY',
				driverType: 'HOURS',
				hoursPerUnit: elementaireArabicHours[grade]!.toFixed(2),
				serviceProfileId: arabicIslamicProfileId,
				languageCode: null,
				groupingKey: null,
				effectiveFromYear: FISCAL_YEAR,
				effectiveToYear: null,
			});
		}
	}

	if (islamiqueDiscId && arabicIslamicProfileId) {
		for (const grade of elementaireGrades) {
			// Islamic Studies: hours/week per section
			rules.push({
				gradeLevel: grade,
				disciplineId: islamiqueDiscId,
				lineType: 'HOST_COUNTRY',
				driverType: 'HOURS',
				hoursPerUnit: elementaireIslamicHours[grade]!.toFixed(2),
				serviceProfileId: arabicIslamicProfileId,
				languageCode: null,
				groupingKey: null,
				effectiveFromYear: FISCAL_YEAR,
				effectiveToYear: null,
			});
		}
	}

	// Delete existing and insert
	await prisma.dhgRule.deleteMany({});
	if (rules.length > 0) {
		await prisma.dhgRule.createMany({ data: rules });
	}
	console.log(`Seeded ${rules.length} DHG rules.`);
}

async function seedCostAssumptions() {
	// From Assumptions sheet rows 28-31
	const assumptions = [
		{ category: 'REMPLACEMENTS', calculationMode: 'FLAT_ANNUAL', value: '272167' },
		{ category: 'FORMATION', calculationMode: 'PERCENT_OF_PAYROLL', value: '0.01' },
		{ category: 'RESIDENT_SALAIRES', calculationMode: 'FLAT_ANNUAL', value: '7356097' },
		{ category: 'RESIDENT_LOGEMENT', calculationMode: 'FLAT_ANNUAL', value: '647400' },
		{ category: 'RESIDENT_PENSION', calculationMode: 'FLAT_ANNUAL', value: '0' },
	];

	await prisma.versionStaffingCostAssumption.deleteMany({ where: { versionId: VERSION_ID } });
	await prisma.versionStaffingCostAssumption.createMany({
		data: assumptions.map((a) => ({ versionId: VERSION_ID, ...a })),
	});
	console.log(`Seeded ${assumptions.length} cost assumptions.`);
}

async function seedStaffingSettings() {
	// HSA parameters from DHG Parameters sheet
	await prisma.versionStaffingSettings.upsert({
		where: { versionId: VERSION_ID },
		update: {
			hsaTargetHours: '1.5',
			hsaFirstHourRate: '500',
			hsaAdditionalHourRate: '400',
			hsaMonths: 10,
			academicWeeks: 36,
			ajeerAnnualLevy: '9500',
			ajeerMonthlyFee: '160',
		},
		create: {
			versionId: VERSION_ID,
			hsaTargetHours: '1.5',
			hsaFirstHourRate: '500',
			hsaAdditionalHourRate: '400',
			hsaMonths: 10,
			academicWeeks: 36,
			ajeerAnnualLevy: '9500',
			ajeerMonthlyFee: '160',
		},
	});
	console.log('Seeded staffing settings (HSA, Ajeer, academic weeks).');
}

async function seedEmployees() {
	const wb = XLSX.readFile(STAFF_PATH);
	const rows = XLSX.utils.sheet_to_json(wb.Sheets['Staff Master Data'], {
		header: 1,
	}) as unknown[][];

	// Row 3 is header, rows 4+ are data
	// Cols: #, Last, First, Function, Department, Status, JoiningDate, YoS,
	//       BaseSalary, HousingIL, TransportIT, RespPremium, HSA, MonthlyGross,
	//       Hourly%, Saudi/Ajeer, Payment, Aug

	// Read key the same way as the API: try file, fall back to literal
	const keyPath = process.env.SALARY_ENCRYPTION_KEY ?? './secrets/salary_encryption_key.txt';
	let encKey: string;
	try {
		const { readFileSync } = await import('node:fs');
		encKey = readFileSync(keyPath, 'utf-8').trim();
	} catch {
		encKey = keyPath; // fallback: use path as literal key (dev mode)
	}
	if (!encKey) {
		console.log('SKIP employees: no encryption key available');
		return;
	}

	// Delete existing employees for this version
	await prisma.$executeRawUnsafe('DELETE FROM employees WHERE version_id = $1', VERSION_ID);

	let count = 0;
	for (let r = 4; r < rows.length; r++) {
		const row = rows[r];
		if (!row || !row[0]) continue;

		const lastName = String(row[1] ?? '').trim();
		const firstName = String(row[2] ?? '').trim();
		const name = `${firstName} ${lastName}`.trim();
		const functionRole = String(row[3] ?? '').trim();
		const department = String(row[4] ?? '').trim();
		const status = String(row[5] ?? 'Existing').trim() === 'Existing' ? 'Existing' : 'New';

		// Joining date: Excel serial number
		let joiningDate: Date;
		const rawDate = row[6];
		if (typeof rawDate === 'number') {
			joiningDate = new Date(Math.round((rawDate - 25569) * 86400 * 1000));
		} else {
			joiningDate = new Date('2024-01-01');
		}

		const baseSalary = String(row[8] ?? '0');
		const housingAllowance = String(row[9] ?? '0');
		const transportAllowance = String(row[10] ?? '0');
		const responsibilityPremium = String(row[11] ?? '0');
		const hourlyPercentage = Number(row[14] ?? 1);
		const isAjeer = String(row[15] ?? '')
			.toLowerCase()
			.includes('ajeer');
		const isSaudi = String(row[15] ?? '')
			.toLowerCase()
			.includes('saudi');
		const paymentMethod = String(row[16] ?? 'Virement').trim();

		// Augmentation
		const augRaw = row[17];
		let augmentation = '0';
		if (typeof augRaw === 'number') {
			augmentation = String(augRaw);
		}

		// Determine if teaching based on department
		const teachingDepts = ['Maternelle', 'Élémentaire', 'Collège', 'Lycée', 'EPS', 'Arabe'];
		const isTeaching = teachingDepts.some((d) =>
			department.toLowerCase().includes(d.toLowerCase())
		);

		const empCode = `EMP-${String(r - 3).padStart(3, '0')}`;

		await prisma.$executeRawUnsafe(
			`INSERT INTO employees (
				version_id, employee_code, name, function_role, department,
				status, joining_date, payment_method, is_saudi, is_ajeer,
				is_teaching, hourly_percentage,
				base_salary, housing_allowance, transport_allowance,
				responsibility_premium, hsa_amount, augmentation,
				ajeer_annual_levy, ajeer_monthly_fee,
				record_type, cost_mode,
				created_by, created_at, updated_at
			) VALUES (
				$1, $2, $3, $4, $5,
				$6, $7, $8, $9, $10,
				$11, $12,
				pgp_sym_encrypt($13, $14), pgp_sym_encrypt($15, $14), pgp_sym_encrypt($16, $14),
				pgp_sym_encrypt($17, $14), pgp_sym_encrypt('0', $14), pgp_sym_encrypt($18, $14),
				$19, $20,
				'EMPLOYEE', 'LOCAL_PAYROLL',
				1, NOW(), NOW()
			)`,
			VERSION_ID,
			empCode,
			name,
			functionRole,
			department,
			status,
			joiningDate,
			paymentMethod,
			isSaudi,
			isAjeer,
			isTeaching,
			hourlyPercentage,
			baseSalary,
			encKey,
			housingAllowance,
			transportAllowance,
			responsibilityPremium,
			augmentation,
			isAjeer ? 9500 : 0,
			isAjeer ? 160 : 0
		);
		count++;
	}

	// Mark staffing stale
	await prisma.$executeRawUnsafe(
		`UPDATE budget_versions SET stale_modules = CASE
			WHEN NOT ('STAFFING' = ANY(stale_modules)) THEN array_append(stale_modules, 'STAFFING')
			ELSE stale_modules
		END WHERE id = $1`,
		VERSION_ID
	);

	console.log(`Seeded ${count} employees.`);
}

async function main() {
	try {
		await seedStaffingSettings();
		await seedCostAssumptions();
		await seedDhgRules();
		await seedEmployees();

		// Verify
		const empCount = await prisma.employee.count({ where: { versionId: VERSION_ID } });
		const ruleCount = await prisma.dhgRule.count();
		const costCount = await prisma.versionStaffingCostAssumption.count({
			where: { versionId: VERSION_ID },
		});
		console.log(
			`\nVerification: ${empCount} employees, ${ruleCount} DHG rules, ${costCount} cost assumptions`
		);
	} catch (err) {
		console.error('Seed error:', err);
		process.exit(1);
	} finally {
		await prisma.$disconnect();
	}
}

main();

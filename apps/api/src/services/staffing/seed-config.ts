/**
 * Staff cost system_config seed entries for Contrats Locaux and Residents.
 * Used by prisma/seed.ts and validated by seed-config.test.ts.
 */
export const staffCostConfigs = [
	{
		key: 'remplacements_rate',
		value: '0.02',
		dataType: 'decimal',
		description:
			'Contrats Locaux: remplacements rate as fraction of local staff salaries',
	},
	{
		key: 'formation_rate',
		value: '0.01',
		dataType: 'decimal',
		description: 'Contrats Locaux: 1% formation continue rate',
	},
	{
		key: 'resident_salary_annual',
		value: '0',
		dataType: 'decimal',
		description: 'Residents: total annual resident salaries (SAR)',
	},
	{
		key: 'resident_logement_annual',
		value: '0',
		dataType: 'decimal',
		description:
			'Residents: total annual logement & billets avion (SAR)',
	},
] as const;

export type StaffCostConfigKey = (typeof staffCostConfigs)[number]['key'];

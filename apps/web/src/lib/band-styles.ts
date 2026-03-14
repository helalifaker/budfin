export const BAND_STYLES: Record<string, { color: string; bg: string }> = {
	MATERNELLE: { color: 'var(--badge-maternelle)', bg: 'var(--badge-maternelle-bg)' },
	ELEMENTAIRE: { color: 'var(--badge-elementaire)', bg: 'var(--badge-elementaire-bg)' },
	COLLEGE: { color: 'var(--badge-college)', bg: 'var(--badge-college-bg)' },
	LYCEE: { color: 'var(--badge-lycee)', bg: 'var(--badge-lycee-bg)' },
};

export const NATIONALITY_STYLES: Record<string, { color: string; bg: string }> = {
	Francais: { color: 'var(--badge-maternelle)', bg: 'var(--badge-maternelle-bg)' },
	Nationaux: { color: 'var(--badge-college)', bg: 'var(--badge-college-bg)' },
	Autres: { color: 'var(--badge-lycee)', bg: 'var(--badge-lycee-bg)' },
};

export const TARIFF_STYLES: Record<string, { color: string; bg: string }> = {
	Plein: { color: 'var(--badge-elementaire)', bg: 'var(--badge-elementaire-bg)' },
	RP: { color: 'var(--badge-college)', bg: 'var(--badge-college-bg)' },
	'R3+': { color: 'var(--badge-lycee)', bg: 'var(--badge-lycee-bg)' },
};

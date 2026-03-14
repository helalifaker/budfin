export const BAND_STYLES: Record<string, { color: string; bg: string }> = {
	MATERNELLE: { color: 'var(--badge-maternelle)', bg: 'var(--badge-maternelle-bg)' },
	ELEMENTAIRE: { color: 'var(--badge-elementaire)', bg: 'var(--badge-elementaire-bg)' },
	COLLEGE: { color: 'var(--badge-college)', bg: 'var(--badge-college-bg)' },
	LYCEE: { color: 'var(--badge-lycee)', bg: 'var(--badge-lycee-bg)' },
};

export const BAND_LABELS: Record<string, string> = {
	MATERNELLE: 'Maternelle',
	ELEMENTAIRE: 'Elementaire',
	COLLEGE: 'College',
	LYCEE: 'Lycee',
};

export const BAND_DOT_COLORS: Record<string, string> = {
	MATERNELLE: 'var(--badge-maternelle)',
	ELEMENTAIRE: 'var(--badge-elementaire)',
	COLLEGE: 'var(--badge-college)',
	LYCEE: 'var(--badge-lycee)',
};

export const NATIONALITY_STYLES: Record<string, { color: string; bg: string }> = {
	Francais: { color: 'var(--badge-maternelle)', bg: 'var(--badge-maternelle-bg)' },
	Nationaux: { color: 'var(--badge-college)', bg: 'var(--badge-college-bg)' },
	Autres: { color: 'var(--badge-lycee)', bg: 'var(--badge-lycee-bg)' },
};

export const NATIONALITY_LABELS: Record<string, string> = {
	Francais: 'Francais',
	Nationaux: 'Nationaux',
	Autres: 'Autres',
};

export const TARIFF_STYLES: Record<string, { color: string; bg: string }> = {
	Plein: { color: 'var(--badge-elementaire)', bg: 'var(--badge-elementaire-bg)' },
	RP: { color: 'var(--badge-college)', bg: 'var(--badge-college-bg)' },
	'R3+': { color: 'var(--badge-lycee)', bg: 'var(--badge-lycee-bg)' },
};

export const TARIFF_LABELS: Record<string, string> = {
	Plein: 'Plein',
	RP: 'RP',
	'R3+': 'R3+',
};

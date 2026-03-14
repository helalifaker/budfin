export const BAND_STYLES = {
	MATERNELLE: { color: 'var(--badge-maternelle)', bg: 'var(--badge-maternelle-bg)' },
	ELEMENTAIRE: { color: 'var(--badge-elementaire)', bg: 'var(--badge-elementaire-bg)' },
	COLLEGE: { color: 'var(--badge-college)', bg: 'var(--badge-college-bg)' },
	LYCEE: { color: 'var(--badge-lycee)', bg: 'var(--badge-lycee-bg)' },
} as const;

export const BAND_LABELS: Record<string, string> = {
	MATERNELLE: 'Maternelle',
	ELEMENTAIRE: 'Elementaire',
	COLLEGE: 'College',
	LYCEE: 'Lycee',
};

export const BAND_DOT_COLORS: Record<string, string> = {
	MATERNELLE: 'bg-(--badge-maternelle)',
	ELEMENTAIRE: 'bg-(--badge-elementaire)',
	COLLEGE: 'bg-(--badge-college)',
	LYCEE: 'bg-(--badge-lycee)',
};

export const NATIONALITY_STYLES = {
	Francais: { color: 'var(--badge-maternelle)', bg: 'var(--badge-maternelle-bg)' },
	Nationaux: { color: 'var(--badge-college)', bg: 'var(--badge-college-bg)' },
	Autres: { color: 'var(--badge-lycee)', bg: 'var(--badge-lycee-bg)' },
} as const;

export const NATIONALITY_LABELS: Record<string, string> = {
	Francais: 'Francais',
	Nationaux: 'Nationaux',
	Autres: 'Autres',
};

export const TARIFF_STYLES = {
	Plein: { color: 'var(--badge-elementaire)', bg: 'var(--badge-elementaire-bg)' },
	RP: { color: 'var(--badge-college)', bg: 'var(--badge-college-bg)' },
	'R3+': { color: 'var(--badge-lycee)', bg: 'var(--badge-lycee-bg)' },
} as const;

export const TARIFF_LABELS: Record<string, string> = {
	Plein: 'Plein',
	RP: 'RP',
	'R3+': 'R3+',
};

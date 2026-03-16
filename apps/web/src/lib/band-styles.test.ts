import { describe, expect, it } from 'vitest';
import {
	BAND_STYLES,
	BAND_LABELS,
	BAND_DOT_COLORS,
	NATIONALITY_STYLES,
	NATIONALITY_LABELS,
	TARIFF_STYLES,
	TARIFF_LABELS,
} from './band-styles';

describe('band-styles', () => {
	it('exports BAND_STYLES with all four bands', () => {
		expect(BAND_STYLES.MATERNELLE).toBeDefined();
		expect(BAND_STYLES.ELEMENTAIRE).toBeDefined();
		expect(BAND_STYLES.COLLEGE).toBeDefined();
		expect(BAND_STYLES.LYCEE).toBeDefined();
	});

	it('each BAND_STYLES entry has color and bg properties', () => {
		for (const key of Object.keys(BAND_STYLES) as Array<keyof typeof BAND_STYLES>) {
			expect(BAND_STYLES[key]).toHaveProperty('color');
			expect(BAND_STYLES[key]).toHaveProperty('bg');
		}
	});

	it('exports BAND_LABELS with all four bands', () => {
		expect(BAND_LABELS['MATERNELLE']).toBe('Maternelle');
		expect(BAND_LABELS['ELEMENTAIRE']).toBe('Elementaire');
		expect(BAND_LABELS['COLLEGE']).toBe('College');
		expect(BAND_LABELS['LYCEE']).toBe('Lycee');
	});

	it('exports BAND_DOT_COLORS with all four bands', () => {
		expect(BAND_DOT_COLORS['MATERNELLE']).toBeDefined();
		expect(BAND_DOT_COLORS['ELEMENTAIRE']).toBeDefined();
		expect(BAND_DOT_COLORS['COLLEGE']).toBeDefined();
		expect(BAND_DOT_COLORS['LYCEE']).toBeDefined();
	});

	it('exports NATIONALITY_STYLES with all three nationalities', () => {
		expect(NATIONALITY_STYLES.Francais).toBeDefined();
		expect(NATIONALITY_STYLES.Nationaux).toBeDefined();
		expect(NATIONALITY_STYLES.Autres).toBeDefined();
	});

	it('each NATIONALITY_STYLES entry has color and bg properties', () => {
		for (const key of Object.keys(NATIONALITY_STYLES) as Array<keyof typeof NATIONALITY_STYLES>) {
			expect(NATIONALITY_STYLES[key]).toHaveProperty('color');
			expect(NATIONALITY_STYLES[key]).toHaveProperty('bg');
		}
	});

	it('exports NATIONALITY_LABELS with all three nationalities', () => {
		expect(NATIONALITY_LABELS['Francais']).toBe('Francais');
		expect(NATIONALITY_LABELS['Nationaux']).toBe('Nationaux');
		expect(NATIONALITY_LABELS['Autres']).toBe('Autres');
	});

	it('exports TARIFF_STYLES with all three tariffs', () => {
		expect(TARIFF_STYLES.Plein).toBeDefined();
		expect(TARIFF_STYLES.RP).toBeDefined();
		expect(TARIFF_STYLES['R3+']).toBeDefined();
	});

	it('each TARIFF_STYLES entry has color and bg properties', () => {
		for (const key of Object.keys(TARIFF_STYLES) as Array<keyof typeof TARIFF_STYLES>) {
			expect(TARIFF_STYLES[key]).toHaveProperty('color');
			expect(TARIFF_STYLES[key]).toHaveProperty('bg');
		}
	});

	it('exports TARIFF_LABELS with all three tariffs', () => {
		expect(TARIFF_LABELS['Plein']).toBe('Plein');
		expect(TARIFF_LABELS['RP']).toBe('RP');
		expect(TARIFF_LABELS['R3+']).toBe('R3+');
	});
});

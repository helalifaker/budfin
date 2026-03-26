import type { ReactNode } from 'react';

export interface CellCoord {
	rowIndex: number;
	colIndex: number;
	colId: string;
}

export interface GridSelection {
	anchor: CellCoord;
	focus: CellCoord;
	range: CellCoord[];
}

export type GridMode = 'navigation' | 'edit';

export interface FooterRow {
	label: string;
	type: 'subtotal' | 'grandtotal';
	values: Record<string, ReactNode>;
}

export interface BandGrouping<T> {
	getBand: (row: T) => string;
	bandLabels: Record<string, string>;
	bandStyles: Record<string, { color: string; bg: string }>;
	collapsible?: boolean;
	footerBuilder?: (rows: T[], band: string) => FooterRow | null;
}

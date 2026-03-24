import type { Employee } from '../hooks/use-staffing';

// ── Types ────────────────────────────────────────────────────────────────────

export interface RosterFilters {
	departments: string[];
	statuses: string[];
	costModes: string[];
	searchQuery: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

export const EMPTY_FILTERS: RosterFilters = {
	departments: [],
	statuses: [],
	costModes: [],
	searchQuery: '',
};

// ── Filter functions ─────────────────────────────────────────────────────────

export function applyRosterFilters(employees: Employee[], filters: RosterFilters): Employee[] {
	let result = employees;

	if (filters.departments.length > 0) {
		result = result.filter((e) => filters.departments.includes(e.department));
	}

	if (filters.statuses.length > 0) {
		result = result.filter((e) => filters.statuses.includes(e.status));
	}

	if (filters.costModes.length > 0) {
		result = result.filter((e) => filters.costModes.includes(e.costMode));
	}

	if (filters.searchQuery.trim()) {
		const q = filters.searchQuery.trim().toLowerCase();
		result = result.filter(
			(e) =>
				e.employeeCode.toLowerCase().includes(q) ||
				e.name.toLowerCase().includes(q) ||
				e.functionRole.toLowerCase().includes(q) ||
				e.department.toLowerCase().includes(q)
		);
	}

	return result;
}

export function countActiveFilters(filters: RosterFilters): number {
	let count = 0;
	if (filters.departments.length > 0) count++;
	if (filters.statuses.length > 0) count++;
	if (filters.costModes.length > 0) count++;
	if (filters.searchQuery.trim()) count++;
	return count;
}

export function extractDepartments(employees: Employee[]): string[] {
	const departments = new Set<string>();
	for (const e of employees) {
		if (e.department) departments.add(e.department);
	}
	return Array.from(departments).sort();
}

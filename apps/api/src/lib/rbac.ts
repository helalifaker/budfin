import { UserRole } from '@prisma/client';

export const PERMISSIONS = [
	'data:view',
	'data:edit',
	'salary:view',
	'salary:edit',
	'admin:users',
	'admin:audit',
	'admin:config',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<UserRole, Set<Permission>> = {
	Admin: new Set([
		'data:view', 'data:edit', 'salary:view', 'salary:edit',
		'admin:users', 'admin:audit', 'admin:config',
	]),
	BudgetOwner: new Set([
		'data:view', 'data:edit', 'salary:view', 'salary:edit',
	]),
	Editor: new Set([
		'data:view', 'data:edit',
	]),
	Viewer: new Set([
		'data:view',
	]),
};

export function getPermissionsForRole(role: UserRole): Permission[] {
	return [...(ROLE_PERMISSIONS[role] ?? [])];
}

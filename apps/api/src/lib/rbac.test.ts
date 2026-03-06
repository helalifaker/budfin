import { describe, it, expect } from 'vitest';
import { ROLE_PERMISSIONS, getPermissionsForRole } from './rbac.js';
import type { Permission } from './rbac.js';

describe('ROLE_PERMISSIONS', () => {
	it('Viewer can only view data', () => {
		expect(ROLE_PERMISSIONS.Viewer.has('data:view')).toBe(true);
		expect(ROLE_PERMISSIONS.Viewer.size).toBe(1);
	});

	it('Editor can view and edit data', () => {
		expect(ROLE_PERMISSIONS.Editor.has('data:view')).toBe(true);
		expect(ROLE_PERMISSIONS.Editor.has('data:edit')).toBe(true);
		expect(ROLE_PERMISSIONS.Editor.has('salary:view')).toBe(false);
	});

	it('BudgetOwner has salary access but no admin', () => {
		expect(ROLE_PERMISSIONS.BudgetOwner.has('salary:view')).toBe(true);
		expect(ROLE_PERMISSIONS.BudgetOwner.has('salary:edit')).toBe(true);
		expect(ROLE_PERMISSIONS.BudgetOwner.has('admin:users')).toBe(false);
	});

	it('Admin has all permissions', () => {
		const allPerms: Permission[] = [
			'data:view', 'data:edit', 'salary:view', 'salary:edit',
			'admin:users', 'admin:audit', 'admin:config',
		];
		for (const perm of allPerms) {
			expect(ROLE_PERMISSIONS.Admin.has(perm)).toBe(true);
		}
		expect(ROLE_PERMISSIONS.Admin.size).toBe(7);
	});
});

describe('getPermissionsForRole', () => {
	it('returns array of permissions for a role', () => {
		const perms = getPermissionsForRole('Editor');
		expect(perms).toContain('data:view');
		expect(perms).toContain('data:edit');
		expect(perms).toHaveLength(2);
	});

	it('returns all 7 permissions for Admin', () => {
		const perms = getPermissionsForRole('Admin');
		expect(perms).toHaveLength(7);
	});
});

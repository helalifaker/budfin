import { describe, it, expect } from 'vitest';
import { Prisma, UserRole } from '@prisma/client';

describe('Prisma schema — Auth models', () => {
	it('UserRole enum has exactly 4 values', () => {
		const roles = Object.values(UserRole);
		expect(roles).toEqual(['Admin', 'BudgetOwner', 'Editor', 'Viewer']);
	});

	it('User model fields include all auth-related columns', () => {
		const fields = Prisma.UserScalarFieldEnum;
		expect(fields).toHaveProperty('id');
		expect(fields).toHaveProperty('email');
		expect(fields).toHaveProperty('passwordHash');
		expect(fields).toHaveProperty('role');
		expect(fields).toHaveProperty('isActive');
		expect(fields).toHaveProperty('failedAttempts');
		expect(fields).toHaveProperty('lockedUntil');
		expect(fields).toHaveProperty('forcePasswordReset');
		expect(fields).toHaveProperty('lastLoginAt');
		expect(fields).toHaveProperty('createdAt');
		expect(fields).toHaveProperty('updatedAt');
	});

	it('RefreshToken model fields include family tracking', () => {
		const fields = Prisma.RefreshTokenScalarFieldEnum;
		expect(fields).toHaveProperty('id');
		expect(fields).toHaveProperty('userId');
		expect(fields).toHaveProperty('tokenHash');
		expect(fields).toHaveProperty('familyId');
		expect(fields).toHaveProperty('isRevoked');
		expect(fields).toHaveProperty('expiresAt');
		expect(fields).toHaveProperty('createdAt');
	});

	it('SystemConfig model uses key as primary field', () => {
		const fields = Prisma.SystemConfigScalarFieldEnum;
		expect(fields).toHaveProperty('key');
		expect(fields).toHaveProperty('value');
		expect(fields).toHaveProperty('dataType');
		expect(fields).toHaveProperty('description');
		expect(fields).toHaveProperty('updatedAt');
		expect(fields).toHaveProperty('updatedBy');
	});

	it('AuditEntry model fields include operation and JSONB columns', () => {
		const fields = Prisma.AuditEntryScalarFieldEnum;
		expect(fields).toHaveProperty('id');
		expect(fields).toHaveProperty('userId');
		expect(fields).toHaveProperty('operation');
		expect(fields).toHaveProperty('tableName');
		expect(fields).toHaveProperty('recordId');
		expect(fields).toHaveProperty('oldValues');
		expect(fields).toHaveProperty('newValues');
		expect(fields).toHaveProperty('ipAddress');
		expect(fields).toHaveProperty('createdAt');
	});

	it('Prisma.ModelName includes all auth models', () => {
		expect(Prisma.ModelName).toHaveProperty('User');
		expect(Prisma.ModelName).toHaveProperty('RefreshToken');
		expect(Prisma.ModelName).toHaveProperty('SystemConfig');
		expect(Prisma.ModelName).toHaveProperty('AuditEntry');
	});
});

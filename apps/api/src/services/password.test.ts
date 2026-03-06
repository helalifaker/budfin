import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from './password.js'

describe('password hashing service', () => {
	it('hashPassword produces a valid bcrypt string', async () => {
		const hash = await hashPassword('test-password')
		expect(hash).toMatch(/^\$2[ab]\$/)
	})

	it('verifyPassword returns true for correct password', async () => {
		const hash = await hashPassword('correct-password')
		const result = await verifyPassword('correct-password', hash)
		expect(result).toBe(true)
	})

	it('verifyPassword returns false for wrong password', async () => {
		const hash = await hashPassword('correct-password')
		const result = await verifyPassword('wrong-password', hash)
		expect(result).toBe(false)
	})

	it('uses cost factor 12', async () => {
		const hash = await hashPassword('cost-check')
		const cost = hash.split('$')[2]
		expect(cost).toBe('12')
	})

	it('produces different hashes for the same input (salt uniqueness)', async () => {
		const hash1 = await hashPassword('same-input')
		const hash2 = await hashPassword('same-input')
		expect(hash1).not.toBe(hash2)
	})
})

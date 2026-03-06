import bcrypt from 'bcryptjs'

const COST_FACTOR = 12

export async function hashPassword(plain: string): Promise<string> {
	const salt = await bcrypt.genSalt(COST_FACTOR)
	return bcrypt.hash(plain, salt)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
	return bcrypt.compare(plain, hash)
}

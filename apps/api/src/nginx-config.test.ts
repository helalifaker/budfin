import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

describe('Nginx configuration', () => {
	const rootDir = resolve(__dirname, '../../..')
	const nginxConfPath = resolve(rootDir, 'nginx/nginx.conf')

	it('nginx.conf exists', () => {
		expect(existsSync(nginxConfPath)).toBe(true)
	})

	it('has /metrics location block with IP restriction', () => {
		const content = readFileSync(nginxConfPath, 'utf-8')
		expect(content).toContain('location /metrics')
		expect(content).toContain('allow 127.0.0.1')
		expect(content).toContain('allow 172.16.0.0/12')
		expect(content).toContain('deny all')
	})

	it('has Content-Security-Policy header', () => {
		const content = readFileSync(nginxConfPath, 'utf-8')
		expect(content).toContain('Content-Security-Policy')
	})

	it('has HSTS header', () => {
		const content = readFileSync(nginxConfPath, 'utf-8')
		expect(content).toContain('Strict-Transport-Security')
	})

	it('redirects HTTP to HTTPS with 308', () => {
		const content = readFileSync(nginxConfPath, 'utf-8')
		expect(content).toContain('return 308')
	})

	it('uses TLS 1.2+', () => {
		const content = readFileSync(nginxConfPath, 'utf-8')
		expect(content).toContain('TLSv1.2')
		expect(content).toContain('TLSv1.3')
	})
})

describe('Docker Compose dev override', () => {
	const devComposePath = resolve(__dirname, '../../../docker-compose.dev.yml')

	it('docker-compose.dev.yml exists', () => {
		expect(existsSync(devComposePath)).toBe(true)
	})

	it('exposes db port 5432 for development', () => {
		const content = readFileSync(devComposePath, 'utf-8')
		expect(content).toContain("'5432:5432'")
	})
})

describe('mkcert setup script', () => {
	const scriptPath = resolve(__dirname, '../../../scripts/setup-mkcert.sh')

	it('exists and is executable', () => {
		expect(existsSync(scriptPath)).toBe(true)
		const stat = statSync(scriptPath)
		expect(stat.mode & 0o111).toBeGreaterThan(0)
	})

	it('generates certs for localhost', () => {
		const content = readFileSync(scriptPath, 'utf-8')
		expect(content).toContain('localhost')
		expect(content).toContain('mkcert')
	})
})

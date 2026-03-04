import js from '@eslint/js'

export default [
	{
		ignores: [
			'**/dist/**',
			'**/build/**',
			'**/coverage/**',
			'**/*.tsbuildinfo',
			'**/node_modules/**',
		],
	},
	js.configs.recommended,
	{
		files: ['**/*.{ts,tsx,js,jsx,mjs,cjs}'],
		rules: {
			'no-console': 'warn',
			'no-unused-vars': [
				'error',
				{ argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
			],
		},
	},
]

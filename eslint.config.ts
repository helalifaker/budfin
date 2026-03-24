import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
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
	...tseslint.configs.recommended,
	{
		files: ['**/*.{ts,tsx,js,jsx,mjs,cjs}'],
		languageOptions: {
			globals: {
				...globals.node,
			},
		},
		rules: {
			'no-console': 'error',
			'@typescript-eslint/no-unused-vars': [
				'error',
				{ argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
			],
		},
	},
	{
		files: ['**/prisma/seed.ts', '**/prisma/seed.*.ts', '**/prisma/seeds/**/*.ts'],
		rules: {
			'no-console': 'off',
		},
	},
	{
		// One-shot CLI migration scripts run via tsx — console output is intentional
		files: ['**/migration/scripts/**/*.ts', '**/scripts/**/*.ts'],
		rules: {
			'no-console': 'off',
		},
	},
	{
		files: ['apps/web/**/*.{ts,tsx}'],
		languageOptions: {
			globals: {
				...globals.browser,
			},
		},
		plugins: {
			'react-hooks': reactHooks,
			'react-refresh': reactRefresh,
		},
		rules: {
			...reactHooks.configs.recommended.rules,
			'react-hooks/incompatible-library': 'off',
			'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
		},
	}
);

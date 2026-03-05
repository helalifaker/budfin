import js from '@eslint/js';
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
			'no-console': 'warn',
			'@typescript-eslint/no-unused-vars': [
				'error',
				{ argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
			],
		},
	},
	{
		files: ['apps/web/**/*.{ts,tsx}'],
		languageOptions: {
			globals: {
				...globals.browser,
			},
		},
	},
);

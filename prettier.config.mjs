/** @type {import('prettier').Config} */
export default {
	useTabs: true,
	tabWidth: 2,
	printWidth: 100,
	singleQuote: true,
	trailingComma: 'es5',
	overrides: [
		{
			files: '**/*.md',
			options: { useTabs: false, tabWidth: 4 },
		},
	],
};

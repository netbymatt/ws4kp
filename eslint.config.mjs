import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({
});

export default [{
	ignores: [
		'*.min.*',
		'server/scripts/vendor/*',
		'dist/**/*',
	],
},
...compat.config({
	env: {
		browser: true,
		es6: true,
		node: true,
	},
	extends: [
		'airbnb-base',
	],
	globals: {
		TravelCities: 'readonly',
		RegionalCities: 'readonly',
		StationInfo: 'readonly',
		SunCalc: 'readonly',
		NoSleep: 'readonly',
		OVERRIDES: 'readonly',
	},
	parserOptions: {
		ecmaVersion: 'latest',
		sourceType: 'module',
	},
	plugins: [],
	rules: {
		indent: [
			'error',
			'tab',
			{
				SwitchCase: 1,
			},
		],
		'no-tabs': 0,
		'no-console': 0,
		'max-len': 0,
		'no-use-before-define': [
			'error',
			{
				variables: false,
			},
		],
		'no-param-reassign': [
			'error',
			{
				props: false,
			},
		],
		'no-mixed-operators': [
			'error',
			{
				groups: [
					[
						'&',
						'|',
						'^',
						'~',
						'<<',
						'>>',
						'>>>',
					],
					[
						'==',
						'!=',
						'===',
						'!==',
						'>',
						'>=',
						'<',
						'<=',
					],
					[
						'&&',
						'||',
					],
					[
						'in',
						'instanceof',
					],
				],
				allowSamePrecedence: true,
			},
		],
		'no-unused-vars': [
			'error',
			{
				argsIgnorePattern: '^_',
				varsIgnorePattern: '^_',
				caughtErrorsIgnorePattern: '^_',
			},
		],
		'import/extensions': [
			'error',
			{
				mjs: 'always',
				json: 'always',
			},
		],
		'import/no-extraneous-dependencies': [
			'error',
			{
				devDependencies: [
					'eslint.config.*',
					'**/*.config.*',
					'**/*.test.*',
					'**/*.spec.*',
					'gulpfile.*',
					'tests/**/*',
					'gulp/**/*',
					'datagenerators/**/*',
				],
			},
		],
	},
	ignorePatterns: [
		'*.min.js',
	],
}),
];

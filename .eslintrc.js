module.exports = {
	env: {
		browser: true,
		commonjs: true,
		es6: true,
		node: true,
		jquery: true,
	},
	extends: [
		'airbnb-base',
		'plugin:sonarjs/recommended',
	],
	globals: {
		Atomics: 'readonly',
		SharedArrayBuffer: 'readonly',
		StationInfo: 'readonly',
		RegionalCities: 'readonly',
		TravelCities: 'readonly',
		NoSleep: 'readonly',
		states: 'readonly',
		SunCalc: 'readonly',

	},
	parserOptions: {
		ecmaVersion: 2023,
	},
	plugins: [
		'unicorn',
		'sonarjs',
	],
	rules: {
		indent: [
			'error',
			'tab',
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
					['&', '|', '^', '~', '<<', '>>', '>>>'],
					['==', '!=', '===', '!==', '>', '>=', '<', '<='],
					['&&', '||'],
					['in', 'instanceof'],
				],
				allowSamePrecedence: true,
			},
		],
		'import/extensions': [
			'error',
			{
				mjs: 'always',
				json: 'always',
			},
		],
		// unicorn
		'unicorn/numeric-separators-style': 'error',
		'unicorn/prefer-query-selector': 'error',
		'unicorn/catch-error-name': 'error',
		'unicorn/no-negated-condition': 'error',
		'unicorn/better-regex': 'error',
		'unicorn/consistent-function-scoping': 'error',
		'unicorn/prefer-array-flat-map': 'error',
		'unicorn/prefer-array-find': 'error',
		'unicorn/prefer-regexp-test': 'error',
		'unicorn/consistent-destructuring': 'error',
		'unicorn/prefer-date-now': 'error',
		'unicorn/prefer-ternary': 'error',
		'unicorn/prefer-dom-node-append': 'error',
		'unicorn/explicit-length-check': 'error',
		'unicorn/prefer-at': 'error',
		// sonarjs
		'sonarjs/cognitive-complexity': 0,
	},
	ignorePatterns: [
		'*.min.js',
	],
};

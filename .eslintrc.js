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
	],
	rules: {
		indent: [
			'error',
			'tab',
			{ 
				SwitchCase: 1
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
	},
	ignorePatterns: [
		'*.min.js',
	],
};

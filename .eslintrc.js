module.exports = {
	env: {
		browser: true,
		commonjs: true,
		es6: true,
		node: true,
		jquery: true,
	},
	extends: 'airbnb-base',
	globals: {
		Atomics: 'readonly',
		SharedArrayBuffer: 'readonly',
	},
	parserOptions: {
		ecmaVersion: 2020,
	},
	rules: {
		indent: [
			'error',
			'tab',
		],
		'no-tabs': 0,
		'no-console': 0,
		'max-len': 0,
		'linebreak-style': 0,
		quotes: [
			'error',
			'single',
		],
		semi: [
			'error',
			'always',
		],
		'no-prototype-builtins': 0,
		'comma-dangle': ['error', 'always-multiline'],
		'block-scoped-var': ['error'],
		'default-case': ['error'],
		'default-param-last': ['error'],
		'dot-location': ['error', 'property'],
		eqeqeq: ['error'],
		'no-eval': ['error'],
		'no-eq-null': ['error'],
		'no-floating-decimal': ['error'],
		'no-trailing-spaces': ['error'],
		'brace-style': [2, '1tbs', { allowSingleLine: true }],
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
	},
	ignorePatterns: [
		'*.min.js',
	],
};

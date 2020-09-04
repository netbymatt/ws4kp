module.exports = {
	'env': {
		'browser': true,
		'commonjs': true,
		'es6': true,
		'node': true,
		'jquery': true,
	},
	'extends': 'eslint:recommended',
	'globals': {
		'Atomics': 'readonly',
		'SharedArrayBuffer': 'readonly'
	},
	'parserOptions': {
		'ecmaVersion': 2018
	},
	'rules': {
		'indent': [
			'error',
			'tab'
		],
		'linebreak-style': [
			'error',
			'unix'
		],
		'quotes': [
			'error',
			'single'
		],
		'semi': [
			'error',
			'always'
		],
		'no-prototype-builtins': 0,
		'comma-dangle': ['error', 'always-multiline'],
		'block-scoped-var': ['error'],
		'default-case': ['error'],
		'default-param-last': ['error'],
		'dot-location': ['error', 'property'],
		'eqeqeq': ['error'],
		'no-eval': ['error'],
		'no-eq-null': ['error'],
		'no-floating-decimal': ['error'],
		'no-trailing-spaces': ['error'],
		'brace-style': [2, '1tbs', { 'allowSingleLine': true }],
	},
	'ignorePatterns': [
		'*.min.js'
	],
};
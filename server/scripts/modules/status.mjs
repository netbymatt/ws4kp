const STATUS = {
	loading: Symbol('loading'),
	loaded: Symbol('loaded'),
	failed: Symbol('failed'),
	noData: Symbol('noData'),
	disabled: Symbol('disabled'),
	retrying: Symbol('retrying'),
};

const statusClassMappings = {
	[STATUS.loading]: 'loading',
	[STATUS.loaded]: 'press-here',
	[STATUS.failed]: 'failed',
	[STATUS.noData]: 'no-data',
	[STATUS.disabled]: 'disabled',
	[STATUS.retrying]: 'retrying',
};

const calcStatusClass = (statusCode) => statusClassMappings[statusCode] ?? '';

const statusClasses = ['loading', 'press-here', 'failed', 'no-data', 'disabled', 'retrying'];

export default STATUS;
export {
	calcStatusClass,
	statusClasses,
};

const STATUS = {
	loading: Symbol('loading'),
	loaded: Symbol('loaded'),
	failed: Symbol('failed'),
	noData: Symbol('noData'),
	disabled: Symbol('disabled'),
	retrying: Symbol('retrying'),
};

const calcStatusClass = (statusCode) => {
	switch (statusCode) {
		case STATUS.loading:
			return 'loading';
		case STATUS.loaded:
			return 'press-here';
		case STATUS.failed:
			return 'failed';
		case STATUS.noData:
			return 'no-data';
		case STATUS.disabled:
			return 'disabled';
		case STATUS.retrying:
			return 'retrying';
		default:
			return '';
	}
};

const statusClasses = ['loading', 'press-here', 'failed', 'no-data', 'disabled', 'retrying'];

export default STATUS;
export {
	calcStatusClass,
	statusClasses,
};

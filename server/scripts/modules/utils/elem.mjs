const elemForEach = (selector, callback) => {
	[...document.querySelectorAll(selector)].forEach(callback);
};

export {
	// eslint-disable-next-line import-x/prefer-default-export
	elemForEach,
};

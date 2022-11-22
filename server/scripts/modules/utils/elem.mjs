const elemForEach = (selector, callback) => {
	[...document.querySelectorAll(selector)].forEach(callback);
};

export {
	// eslint-disable-next-line import/prefer-default-export
	elemForEach,
};

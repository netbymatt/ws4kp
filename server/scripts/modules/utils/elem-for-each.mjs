const elemForEach = (selector, callback) => {
	[...document.querySelectorAll(selector)].forEach(callback);
};

export default elemForEach;

const locationCleanup = (input) => {
	// regexes to run
	const regexes = [
		// "Chicago / West Chicago", removes before slash
		/^[ A-Za-z]+ \/ /,
		// "Chicago/Waukegan" removes before slash
		/^[ A-Za-z]+\//,
		// "Chicago, Chicago O'hare" removes before comma
		/^[ A-Za-z]+, /,
	];

	// run all regexes
	return regexes.reduce((value, regex) => value.replace(regex, ''), input);
};

export {
	// eslint-disable-next-line import/prefer-default-export
	locationCleanup,
};

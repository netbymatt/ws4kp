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

// stations must be 4 alpha characters and not start with the provided list
const skipStations = ['U', 'C', 'H', 'W', 'Y', 'T', 'S', 'M', 'O', 'L', 'A', 'F', 'B', 'N', 'V', 'R', 'D', 'E', 'I', 'G', 'J'];
const stationFilter = (station) => station.properties.stationIdentifier.match(/^[A-Z]{4}$/) && !skipStations.includes(station.properties.stationIdentifier.slice(0, 1));

export {

	locationCleanup,
	stationFilter,
};

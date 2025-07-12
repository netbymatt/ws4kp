// wind direction
const directionToNSEW = (Direction) => {
	// Handle null, undefined, or invalid direction values
	if (Direction === null || Direction === undefined || typeof Direction !== 'number' || Number.isNaN(Direction)) {
		return 'VAR'; // Variable (or unknown) direction
	}
	const val = Math.floor((Direction / 22.5) + 0.5);
	const arr = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
	return arr[(val % 16)];
};

const distance = (x1, y1, x2, y2) => Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);

// wrap a number to 0-m
const wrap = (x, m) => ((x % m) + m) % m;

export {
	directionToNSEW,
	distance,
	wrap,
};

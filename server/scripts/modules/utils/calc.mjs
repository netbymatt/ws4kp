const relativeHumidity = (Temperature, DewPoint) => {
	const T = Temperature;
	const TD = DewPoint;
	return Math.round(100 * (Math.exp((17.625 * TD) / (243.04 + TD)) / Math.exp((17.625 * T) / (243.04 + T))));
};

const heatIndex = (Temperature, RelativeHumidity) => {
	const T = Temperature;
	const RH = RelativeHumidity;
	let HI = 0.5 * (T + 61.0 + ((T - 68.0) * 1.2) + (RH * 0.094));
	let ADJUSTMENT;

	if (T >= 80) {
		HI = -42.379 + 2.04901523 * T + 10.14333127 * RH - 0.22475541 * T * RH - 0.00683783 * T * T - 0.05481717 * RH * RH + 0.00122874 * T * T * RH + 0.00085282 * T * RH * RH - 0.00000199 * T * T * RH * RH;

		if (RH < 13 && (T > 80 && T < 112)) {
			ADJUSTMENT = ((13 - RH) / 4) * Math.sqrt((17 - Math.abs(T - 95)) / 17);
			HI -= ADJUSTMENT;
		} else if (RH > 85 && (T > 80 && T < 87)) {
			ADJUSTMENT = ((RH - 85) / 10) * ((87 - T) / 5);
			HI += ADJUSTMENT;
		}
	}

	if (HI < Temperature) {
		HI = Temperature;
	}

	return Math.round(HI);
};

const windChill = (Temperature, WindSpeed) => {
	if (WindSpeed === '0' || WindSpeed === 'Calm' || WindSpeed === 'NA') {
		return '';
	}

	const T = Temperature;
	const V = WindSpeed;

	return Math.round(35.74 + (0.6215 * T) - (35.75 * (V ** 0.16)) + (0.4275 * T * (V ** 0.16)));
};

// wind direction
const directionToNSEW = (Direction) => {
	const val = Math.floor((Direction / 22.5) + 0.5);
	const arr = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
	return arr[(val % 16)];
};

const distance = (x1, y1, x2, y2) => Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);

// wrap a number to 0-m
const wrap = (x, m) => ((x % m) + m) % m;

export {
	relativeHumidity,
	heatIndex,
	windChill,
	directionToNSEW,
	distance,
	wrap,
};

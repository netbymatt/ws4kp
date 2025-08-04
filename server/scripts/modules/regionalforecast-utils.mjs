import { getSmallIcon } from './icons.mjs';
import { preloadImg } from './utils/image.mjs';
import { safeJson } from './utils/fetch.mjs';
import { temperature as temperatureUnit } from './utils/units.mjs';
import augmentObservationWithMetar from './utils/metar.mjs';
import { debugFlag } from './utils/debug.mjs';
import { enhanceObservationWithMapClick } from './utils/mapclick.mjs';

const buildForecast = (forecast, city, cityXY) => {
	// get a unit converter
	const temperatureConverter = temperatureUnit('us');
	return {
		daytime: forecast.isDaytime,
		temperature: temperatureConverter(forecast.temperature || 0),
		name: formatCity(city.city),
		icon: forecast.icon,
		x: cityXY.x,
		y: cityXY.y,
		time: forecast.startTime,
	};
};

const getRegionalObservation = async (point, city) => {
	try {
		// get stations using centralized safe handling
		const stations = await safeJson(`https://api.weather.gov/gridpoints/${point.wfo}/${point.x},${point.y}/stations?limit=1`);

		if (!stations || !stations.features || stations.features.length === 0) {
			if (debugFlag('verbose-failures')) {
				console.warn(`Unable to get regional stations for ${city.city}`);
			}
			return false;
		}

		// get the first station
		const station = stations.features[0].id;
		const stationId = stations.features[0].properties.stationIdentifier;
		// get the observation data using centralized safe handling
		const observation = await safeJson(`${station}/observations/latest`);

		if (!observation) {
			if (debugFlag('verbose-failures')) {
				console.warn(`Unable to get regional observations for station ${stationId}`);
			}
			return false;
		}

		// Enhance observation data with METAR parsing for missing fields
		let augmentedObservation = augmentObservationWithMetar(observation.properties);

		// Define required fields for regional observations (more lenient than current weather)
		const requiredFields = [
			{ name: 'temperature', check: (props) => props.temperature?.value === null },
			{ name: 'textDescription', check: (props) => props.textDescription === null || props.textDescription === '' },
			{ name: 'icon', check: (props) => props.icon === null },
		];

		// Use enhanced observation with MapClick fallback
		const enhancedResult = await enhanceObservationWithMapClick(augmentedObservation, {
			requiredFields,
			stationId,
			debugContext: 'regionalforecast',
		});

		augmentedObservation = enhancedResult.data;
		const { missingFields } = enhancedResult;

		// Check final data quality
		if (missingFields.length > 0) {
			if (debugFlag('regionalforecast')) {
				console.log(`Regional Observations for station ${stationId} is missing fields: ${missingFields.join(', ')} (skipping)`);
			}
			return false;
		}

		// preload the image
		if (!augmentedObservation.icon) return false;
		const icon = getSmallIcon(augmentedObservation.icon, !augmentedObservation.daytime);
		if (!icon) return false;
		preloadImg(icon);
		// return the observation
		return augmentedObservation;
	} catch (error) {
		console.error(`Unexpected error getting Regional Observation for ${city.city}: ${error.message}`);
		return false;
	}
};

// utility latitude/pixel conversions
const getXYFromLatitudeLongitude = (Latitude, Longitude, OffsetX, OffsetY, state) => {
	if (state === 'AK') return getXYFromLatitudeLongitudeAK(Latitude, Longitude, OffsetX, OffsetY);
	if (state === 'HI') return getXYFromLatitudeLongitudeHI(Latitude, Longitude, OffsetX, OffsetY);
	let y = 0;
	let x = 0;
	const ImgHeight = 1600;
	const ImgWidth = 2550;

	y = (50.5 - Latitude) * 55.2;
	y -= OffsetY; // Centers map.
	// Do not allow the map to exceed the max/min coordinates.
	if (y > (ImgHeight - (OffsetY * 2))) {
		y = ImgHeight - (OffsetY * 2);
	} else if (y < 0) {
		y = 0;
	}

	x = ((-127.5 - Longitude) * 41.775) * -1;
	x -= OffsetX; // Centers map.
	// Do not allow the map to exceed the max/min coordinates.
	if (x > (ImgWidth - (OffsetX * 2))) {
		x = ImgWidth - (OffsetX * 2);
	} else if (x < 0) {
		x = 0;
	}

	return { x, y };
};

const getXYFromLatitudeLongitudeAK = (Latitude, Longitude, OffsetX, OffsetY) => {
	let y = 0;
	let x = 0;
	const ImgHeight = 1142;
	const ImgWidth = 1200;

	y = (73.0 - Latitude) * 56;
	y -= OffsetY; // Centers map.
	// Do not allow the map to exceed the max/min coordinates.
	if (y > (ImgHeight - (OffsetY * 2))) {
		y = ImgHeight - (OffsetY * 2);
	} else if (y < 0) {
		y = 0;
	}

	x = ((-175.0 - Longitude) * 25.0) * -1;
	x -= OffsetX; // Centers map.
	// Do not allow the map to exceed the max/min coordinates.
	if (x > (ImgWidth - (OffsetX * 2))) {
		x = ImgWidth - (OffsetX * 2);
	} else if (x < 0) {
		x = 0;
	}

	return { x, y };
};

const getXYFromLatitudeLongitudeHI = (Latitude, Longitude, OffsetX, OffsetY) => {
	let y = 0;
	let x = 0;
	const ImgHeight = 571;
	const ImgWidth = 600;

	y = (25 - Latitude) * 55.2;
	y -= OffsetY; // Centers map.
	// Do not allow the map to exceed the max/min coordinates.
	if (y > (ImgHeight - (OffsetY * 2))) {
		y = ImgHeight - (OffsetY * 2);
	} else if (y < 0) {
		y = 0;
	}

	x = ((-164.5 - Longitude) * 41.775) * -1;
	x -= OffsetX; // Centers map.
	// Do not allow the map to exceed the max/min coordinates.
	if (x > (ImgWidth - (OffsetX * 2))) {
		x = ImgWidth - (OffsetX * 2);
	} else if (x < 0) {
		x = 0;
	}

	return { x, y };
};

const getMinMaxLatitudeLongitude = (X, Y, OffsetX, OffsetY, state) => {
	if (state === 'AK') return getMinMaxLatitudeLongitudeAK(X, Y, OffsetX, OffsetY);
	if (state === 'HI') return getMinMaxLatitudeLongitudeHI(X, Y, OffsetX, OffsetY);
	const maxLat = ((Y / 55.2) - 50.5) * -1;
	const minLat = (((Y + (OffsetY * 2)) / 55.2) - 50.5) * -1;
	const minLon = (((X * -1) / 41.775) + 127.5) * -1;
	const maxLon = ((((X + (OffsetX * 2)) * -1) / 41.775) + 127.5) * -1;

	return {
		minLat, maxLat, minLon, maxLon,
	};
};

const getMinMaxLatitudeLongitudeAK = (X, Y, OffsetX, OffsetY) => {
	const maxLat = ((Y / 56) - 73.0) * -1;
	const minLat = (((Y + (OffsetY * 2)) / 56) - 73.0) * -1;
	const minLon = (((X * -1) / 25) + 175.0) * -1;
	const maxLon = ((((X + (OffsetX * 2)) * -1) / 25) + 175.0) * -1;

	return {
		minLat, maxLat, minLon, maxLon,
	};
};

const getMinMaxLatitudeLongitudeHI = (X, Y, OffsetX, OffsetY) => {
	const maxLat = ((Y / 55.2) - 25) * -1;
	const minLat = (((Y + (OffsetY * 2)) / 55.2) - 25) * -1;
	const minLon = (((X * -1) / 41.775) + 164.5) * -1;
	const maxLon = ((((X + (OffsetX * 2)) * -1) / 41.775) + 164.5) * -1;

	return {
		minLat, maxLat, minLon, maxLon,
	};
};

const getXYForCity = (City, MaxLatitude, MinLongitude, state) => {
	if (state === 'AK') getXYForCityAK(City, MaxLatitude, MinLongitude);
	if (state === 'HI') getXYForCityHI(City, MaxLatitude, MinLongitude);
	let x = (City.lon - MinLongitude) * 57;
	let y = (MaxLatitude - City.lat) * 70;

	if (y < 30) y = 30;
	if (y > 282) y = 282;

	if (x < 40) x = 40;
	if (x > 580) x = 580;

	return { x, y };
};

const getXYForCityAK = (City, MaxLatitude, MinLongitude) => {
	let x = (City.lon - MinLongitude) * 37;
	let y = (MaxLatitude - City.lat) * 70;

	if (y < 30) y = 30;
	if (y > 282) y = 282;

	if (x < 40) x = 40;
	if (x > 580) x = 580;
	return { x, y };
};

const getXYForCityHI = (City, MaxLatitude, MinLongitude) => {
	let x = (City.lon - MinLongitude) * 57;
	let y = (MaxLatitude - City.lat) * 70;

	if (y < 30) y = 30;
	if (y > 282) y = 282;

	if (x < 40) x = 40;
	if (x > 580) x = 580;

	return { x, y };
};

// to fit on the map, remove anything after punctuation and then limit to 15 characters
const formatCity = (city) => city.match(/[^,/;\\-]*/)[0].substr(0, 12);

export {
	buildForecast,
	getRegionalObservation,
	getXYFromLatitudeLongitude,
	getMinMaxLatitudeLongitude,
	getXYForCity,
	formatCity,
};

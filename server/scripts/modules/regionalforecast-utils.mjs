import smallIcon from './icons/small.mjs';
import preloadImg from './utils/preload-image.mjs';
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
		x: cityXY[0],
		y: cityXY[1],
		time: forecast.startTime,
	};
};

const getRegionalObservation = async (point, city) => {
	try {
		// get stations using centralized safe handling
		const stations = await safeJson(`https://api.weather.gov/gridpoints/${point.wfo}/${point.x},${point.y}/stations?limit=10`);

		if (!stations || !stations.features || stations.features.length === 0) {
			if (debugFlag('verbose-failures')) {
				console.warn(`Unable to get regional stations for ${city.city}`);
			}
			return false;
		}

		// get the first station with a 4-letter id (generally has appropriate data)
		const station4Letter = stations.features.find((station) => {
			if (station?.properties?.stationIdentifier?.length === 4) return station.properties;
			return false;
		});
		if (!station4Letter) return false;
		const station = station4Letter.id;
		const stationId = station4Letter.properties.stationIdentifier;
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
		const { missingRequired, missingOptional } = enhancedResult;

		// Check final data quality
		if ((missingRequired.length + missingOptional.length) > 0) {
			if (debugFlag('regionalforecast')) {
				console.log(`Regional Observations for station ${stationId} is missing fields: ${[...missingRequired, ...missingOptional].join(', ')} (skipping)`);
			}
			return false;
		}

		// preload the image
		if (!augmentedObservation.icon) return false;
		const icon = smallIcon(augmentedObservation.icon, !augmentedObservation.daytime);
		if (!icon) return false;
		preloadImg(icon);
		// return the observation
		return augmentedObservation;
	} catch (error) {
		console.error(`Unexpected error getting Regional Observation for ${city.city}: ${error.message}`);
		return false;
	}
};

// to fit on the map, remove anything after punctuation and then limit to 15 characters
const formatCity = (city) => city.match(/[^,/;\\-]*/)[0].substr(0, 12);

export {
	buildForecast,
	getRegionalObservation,
	formatCity,
};

// METAR parsing utilities using metar-taf-parser library
import { parseMetar } from '../../vendor/auto/metar-taf-parser.mjs';

/**
 * Augment observation data by parsing METAR when API fields are missing
 * @param {Object} observation - The observation object from the API
 * @returns {Object} - Augmented observation with parsed METAR data filled in
 */
const augmentObservationWithMetar = (observation) => {
	if (!observation?.rawMessage) {
		return observation;
	}

	const metar = { ...observation };

	try {
		const metarData = parseMetar(observation.rawMessage);

		if (observation.windSpeed?.value === null && metarData.wind?.speed !== undefined) {
			metar.windSpeed = {
				...observation.windSpeed,
				value: metarData.wind.speed * 1.852, // Convert knots to km/h (API uses km/h)
				qualityControl: 'M', // M for METAR-derived
			};
		}

		if (observation.windDirection?.value === null && metarData.wind?.degrees !== undefined) {
			metar.windDirection = {
				...observation.windDirection,
				value: metarData.wind.degrees,
				qualityControl: 'M',
			};
		}

		if (observation.windGust?.value === null && metarData.wind?.gust !== undefined) {
			metar.windGust = {
				...observation.windGust,
				value: metarData.wind.gust * 1.852, // Convert knots to km/h
				qualityControl: 'M',
			};
		}

		if (observation.temperature?.value === null && metarData.temperature !== undefined) {
			metar.temperature = {
				...observation.temperature,
				value: metarData.temperature,
				qualityControl: 'M',
			};
		}

		if (observation.dewpoint?.value === null && metarData.dewPoint !== undefined) {
			metar.dewpoint = {
				...observation.dewpoint,
				value: metarData.dewPoint,
				qualityControl: 'M',
			};
		}

		if (observation.barometricPressure?.value === null && metarData.altimeter !== undefined) {
			// Convert inHg to Pascals
			const pascals = Math.round(metarData.altimeter * 3386.39);
			metar.barometricPressure = {
				...observation.barometricPressure,
				value: pascals,
				qualityControl: 'M',
			};
		}

		// Calculate relative humidity if missing from API but we have temp and dewpoint
		if (observation.relativeHumidity?.value === null && metar.temperature?.value !== null && metar.dewpoint?.value !== null) {
			const humidity = calculateRelativeHumidity(metar.temperature.value, metar.dewpoint.value);
			metar.relativeHumidity = {
				...observation.relativeHumidity,
				value: humidity,
				qualityControl: 'M', // M for METAR-derived
			};
		}

		if (observation.visibility?.value === null && metarData.visibility?.value !== undefined) {
			let visibilityKm;
			if (metarData.visibility.unit === 'SM') {
				// Convert statute miles to kilometers
				visibilityKm = metarData.visibility.value * 1.609344;
			} else if (metarData.visibility.unit === 'm') {
				// Convert meters to kilometers
				visibilityKm = metarData.visibility.value / 1000;
			} else {
				// Assume it's already in the right unit
				visibilityKm = metarData.visibility.value;
			}

			metar.visibility = {
				...observation.visibility,
				value: Math.round(visibilityKm * 10) / 10, // Round to 1 decimal place
				qualityControl: 'M',
			};
		}

		if (observation.cloudLayers?.[0]?.base?.value === null && metarData.clouds?.length > 0) {
			// Find the lowest broken (BKN) or overcast (OVC) layer for ceiling
			const ceilingLayer = metarData.clouds
				.filter((cloud) => cloud.type === 'BKN' || cloud.type === 'OVC')
				.sort((a, b) => a.height - b.height)[0];

			if (ceilingLayer) {
				// Convert feet to meters
				const heightMeters = Math.round(ceilingLayer.height * 0.3048);

				// Create cloud layer structure if it doesn't exist
				if (!metar.cloudLayers || !metar.cloudLayers[0]) {
					metar.cloudLayers = [{
						base: {
							value: heightMeters,
							qualityControl: 'M',
						},
					}];
				} else {
					metar.cloudLayers[0].base = {
						...observation.cloudLayers[0].base,
						value: heightMeters,
						qualityControl: 'M',
					};
				}
			}
		}
	} catch (error) {
		// If METAR parsing fails, just return the original observation
		console.warn(`Failed to parse METAR: ${error.message}`);
		return observation;
	}

	return metar;
};

/**
 * Calculate relative humidity from temperature and dewpoint
 * @param {number} temperature - Temperature in Celsius
 * @param {number} dewpoint - Dewpoint in Celsius
 * @returns {number} Relative humidity as a percentage (0-100)
 */
const calculateRelativeHumidity = (temperature, dewpoint) => {
	// Using the Magnus formula approximation
	const a = 17.625;
	const b = 243.04;

	const alpha = Math.log(Math.exp((a * dewpoint) / (b + dewpoint)) / Math.exp((a * temperature) / (b + temperature)));
	const relativeHumidity = Math.exp(alpha) * 100;

	// Clamp between 0 and 100 and round to nearest integer
	return Math.round(Math.max(0, Math.min(100, relativeHumidity)));
};

export default augmentObservationWithMetar;

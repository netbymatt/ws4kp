/**
 * MapClick API Fallback Utility
 *
 * Provides fallback functionality to fetch weather data from forecast.weather.gov's MapClick API
 * when the primary api.weather.gov data is stale or incomplete.
 *
 * MapClick uses the SBN feed which typically has faster METAR (airport) station updates
 * but is limited to airport stations only. The primary API uses MADIS which is more
 * comprehensive but can have delayed ingestion.
 */

import { safeJson } from './fetch.mjs';
import { debugFlag } from './debug.mjs';

/**
 * Parse MapClick date format to JavaScript Date
 * @param {string} dateString - Format: "18 Jun 23:53 pm EDT"
 * @returns {Date|null} - Parsed date or null if invalid
 */
export const parseMapClickDate = (dateString) => {
	try {
		// Extract components using regex
		const match = dateString.match(/(\d{1,2})\s+(\w{3})\s+(\d{1,2}):(\d{2})\s+(am|pm)\s+(\w{3})/i);
		if (!match) return null;

		const [, day, month, hour, minute, ampm, timezone] = match;
		const currentYear = new Date().getFullYear();

		// Convert to 12-hour format since we have AM/PM
		let hour12 = parseInt(hour, 10);
		// If it's in 24-hour format but we have AM/PM, convert it
		if (hour12 > 12) {
			hour12 -= 12;
		}

		// Reconstruct in a format that Date.parse understands (12-hour format with AM/PM)
		const standardFormat = `${month} ${day}, ${currentYear} ${hour12}:${minute}:00 ${ampm.toUpperCase()} ${timezone}`;

		const parsedDate = new Date(standardFormat);

		// Check if the date is valid
		if (Number.isNaN(parsedDate.getTime())) {
			console.warn(`MapClick: Invalid date parsed from: ${dateString} -> ${standardFormat}`);
			return null;
		}

		return parsedDate;
	} catch (error) {
		console.warn(`MapClick: Failed to parse date: ${dateString}`, error);
		return null;
	}
};

/**
 * Normalize icon name to determine if it's night and get base name for mapping
 * @param {string} iconName - Icon name without extension
 * @returns {Object} - { isNightTime: boolean, baseIconName: string }
 */
const normalizeIconName = (iconName) => {
	// Handle special cases where 'n' is not a prefix (hi_nshwrs, hi_ntsra)
	const hiNightMatch = iconName.match(/^hi_n(.+)/);
	if (hiNightMatch) {
		return {
			isNightTime: true,
			baseIconName: `hi_${hiNightMatch[1]}`, // Reconstruct as hi_[condition]
		};
	}

	// Handle the general 'n' prefix rule (including nra, nwind_skc, etc.)
	if (iconName.startsWith('n')) {
		return {
			isNightTime: true,
			baseIconName: iconName.substring(1), // Strip the 'n' prefix
		};
	}

	// Not a night icon
	return {
		isNightTime: false,
		baseIconName: iconName,
	};
};

/**
 * Convert MapClick weather image filename to weather.gov API icon format
 * @param {string} weatherImage - MapClick weather image filename (e.g., 'bkn.png')
 * @returns {string|null} - Weather.gov API icon URL or null if invalid/missing
 */
const convertMapClickIcon = (weatherImage) => {
	// Return null for missing, invalid, or NULL values - let caller handle defaults
	if (!weatherImage || weatherImage === 'NULL' || weatherImage === 'NA') {
		return null;
	}

	// Remove .png extension if present
	const iconName = weatherImage.replace('.png', '');

	// Determine if this is a night icon and get the base name for mapping
	const { isNightTime, baseIconName } = normalizeIconName(iconName);
	const timeOfDay = isNightTime ? 'night' : 'day';

	// MapClick icon filename to weather.gov API condition mapping
	// This maps MapClick specific icon names to standard API icon names
	// Night variants are handled by stripping 'n' prefix before lookup
	// based on https://www.weather.gov/forecast-icons/
	const iconMapping = {
		// Clear/Fair conditions
		skc: 'skc', // Clear sky condition

		// Cloud coverage
		few: 'few', // A few clouds
		sct: 'sct', // Scattered clouds / Partly cloudy
		bkn: 'bkn', // Broken clouds / Mostly cloudy
		ovc: 'ovc', // Overcast

		// Light Rain + Drizzle
		minus_ra: 'rain', // Light rain -> rain
		ra: 'rain', // Rain
		// Note: nra.png is used for both light rain and rain at night
		// but normalizeIconName strips the 'n' to get 'ra' which maps to 'rain'

		// Snow variants
		sn: 'snow', // Snow

		// Rain + Snow combinations
		ra_sn: 'rain_snow', // Rain snow
		rasn: 'rain_snow', // Standard rain snow

		// Ice Pellets/Sleet
		raip: 'rain_sleet', // Rain ice pellets -> rain_sleet
		ip: 'sleet', // Ice pellets

		// Freezing Rain
		ra_fzra: 'rain_fzra', // Rain freezing rain -> rain_fzra
		fzra: 'fzra', // Freezing rain

		// Freezing Rain + Snow
		fzra_sn: 'snow_fzra', // Freezing rain snow -> snow_fzra

		// Snow + Ice Pellets
		snip: 'snow_sleet', // Snow ice pellets -> snow_sleet

		// Showers
		hi_shwrs: 'rain_showers_hi', // Isolated showers -> rain_showers_hi
		shra: 'rain_showers', // Showers -> rain_showers

		// Thunderstorms
		tsra: 'tsra', // Thunderstorm
		scttsra: 'tsra_sct', // Scattered thunderstorm -> tsra_sct
		hi_tsra: 'tsra_hi', // Isolated thunderstorm -> tsra_hi

		// Fog
		fg: 'fog', // Fog

		// Wind conditions
		wind_skc: 'wind_skc', // Clear and windy
		wind_few: 'wind_few', // Few clouds and windy
		wind_sct: 'wind_sct', // Scattered clouds and windy
		wind_bkn: 'wind_bkn', // Broken clouds and windy
		wind_ovc: 'wind_ovc', // Overcast and windy

		// Extreme weather
		blizzard: 'blizzard', // Blizzard
		cold: 'cold', // Cold
		hot: 'hot', // Hot
		du: 'dust', // Dust
		fu: 'smoke', // Smoke
		hz: 'haze', // Haze

		// Tornadoes
		fc: 'tornado', // Funnel cloud
		tor: 'tornado', // Tornado
	};

	// Get the mapped condition, return null if not found in the mapping
	const condition = iconMapping[baseIconName];
	if (!condition) {
		return null;
	}

	return `/icons/land/${timeOfDay}/${condition}?size=medium`;
};

/**
 * Convert MapClick observation data to match the standard API format
 *
 * This is NOT intended to be a full replacment process, but rather a minimal
 * fallback for the data used in WS4KP.
 *
 * @param {Object} mapClickObs - MapClick observation data
 * @returns {Object} - Data formatted to match api.weather.gov structure
 */
export const convertMapClickObservationsToApiFormat = (mapClickObs) => {
	// Convert temperature from Fahrenheit to Celsius (only if valid)
	const tempF = parseFloat(mapClickObs.Temp);
	const tempC = !Number.isNaN(tempF) ? (tempF - 32) * 5 / 9 : null;

	const dewpF = parseFloat(mapClickObs.Dewp);
	const dewpC = !Number.isNaN(dewpF) ? (dewpF - 32) * 5 / 9 : null;

	// Convert wind speed from mph to km/h (only if valid)
	const windMph = parseFloat(mapClickObs.Winds);
	const windKmh = !Number.isNaN(windMph) ? windMph * 1.60934 : null;

	// Convert wind gust from mph to km/h (only if valid and not "NA")
	const gustMph = mapClickObs.Gust !== 'NA' ? parseFloat(mapClickObs.Gust) : NaN;
	const windGust = !Number.isNaN(gustMph) ? gustMph * 1.60934 : null;

	// Convert wind direction (only if valid)
	const windDir = parseFloat(mapClickObs.Windd);
	const windDirection = !Number.isNaN(windDir) ? windDir : null;

	// Convert pressure from inHg to Pa (only if valid)
	const pressureInHg = parseFloat(mapClickObs.SLP);
	const pressurePa = !Number.isNaN(pressureInHg) ? pressureInHg * 3386.39 : null;

	// Convert visibility from miles to meters (only if valid)
	const visibilityMiles = parseFloat(mapClickObs.Visibility);
	const visibilityMeters = !Number.isNaN(visibilityMiles) ? visibilityMiles * 1609.34 : null;

	// Convert relative humidity (only if valid)
	const relh = parseFloat(mapClickObs.Relh);
	const relativeHumidity = !Number.isNaN(relh) ? relh : null;

	// Convert wind chill from Fahrenheit to Celsius (only if valid and not "NA")
	const windChillF = mapClickObs.WindChill !== 'NA' ? parseFloat(mapClickObs.WindChill) : NaN;
	const windChill = !Number.isNaN(windChillF) ? (windChillF - 32) * 5 / 9 : null;

	// Convert MapClick weather image to weather.gov API icon format
	const iconUrl = convertMapClickIcon(mapClickObs.Weatherimage);

	return {
		features: [
			{
				properties: {
					timestamp: parseMapClickDate(mapClickObs.Date)?.toISOString() || new Date().toISOString(),
					temperature: { value: tempC, unitCode: 'wmoUnit:degC' },
					dewpoint: { value: dewpC, unitCode: 'wmoUnit:degC' },
					windDirection: { value: windDirection, unitCode: 'wmoUnit:degree_(angle)' },
					windSpeed: { value: windKmh, unitCode: 'wmoUnit:km_h-1' },
					windGust: { value: windGust, unitCode: 'wmoUnit:km_h-1' },
					barometricPressure: { value: pressurePa, unitCode: 'wmoUnit:Pa' },
					visibility: { value: visibilityMeters, unitCode: 'wmoUnit:m' },
					relativeHumidity: { value: relativeHumidity, unitCode: 'wmoUnit:percent' },
					textDescription: mapClickObs.Weather || null,
					icon: iconUrl, // Can be null if no valid icon available
					heatIndex: { value: null },
					windChill: { value: windChill },
					cloudLayers: [], // no cloud layer data available from MapClick
				},
			},
		],
	};
};

/**
 * Convert MapClick forecast data to weather.gov API forecast format
 * @param {Object} mapClickData - Raw MapClick response data
 * @returns {Object|null} - Forecast data in API format or null if invalid
 */
export const convertMapClickForecastToApiFormat = (mapClickData) => {
	if (!mapClickData?.data || !mapClickData?.time) {
		return null;
	}

	const { data, time } = mapClickData;
	const {
		temperature, weather, iconLink, text, pop,
	} = data;

	if (!temperature || !weather || !iconLink || !text || !time.startValidTime || !time.startPeriodName) {
		return null;
	}

	// Convert each forecast period
	const periods = temperature.map((temp, index) => {
		if (index >= weather.length || index >= iconLink.length || index >= text.length || index >= time.startValidTime.length) {
			return null;
		}

		// Determine if this is a daytime period based on the period name
		const periodName = time.startPeriodName[index] || '';
		const isDaytime = !periodName.toLowerCase().includes('night');

		// Convert icon from MapClick format to API format
		let icon = iconLink[index];
		if (icon) {
			let filename = null;

			// Handle DualImage.php URLs: extract from 'i' parameter
			if (icon.includes('DualImage.php')) {
				const iMatch = icon.match(/[?&]i=([^&]+)/);
				if (iMatch) {
					[, filename] = iMatch;
				}
			} else {
				// Handle regular image URLs: extract filename from path, removing percentage numbers
				const pathMatch = icon.match(/\/([^/]+?)(?:\d+)?(?:\.png)?$/);
				if (pathMatch) {
					[, filename] = pathMatch;
				}
			}

			if (filename) {
				icon = convertMapClickIcon(filename);
			}
		}

		return {
			number: index + 1,
			name: periodName,
			startTime: time.startValidTime[index],
			endTime: index + 1 < time.startValidTime.length ? time.startValidTime[index + 1] : null,
			isDaytime,
			temperature: parseInt(temp, 10),
			temperatureUnit: 'F',
			temperatureTrend: null,
			probabilityOfPrecipitation: {
				unitCode: 'wmoUnit:percent',
				value: pop[index] ? parseInt(pop[index], 10) : null,
			},
			dewpoint: {
				unitCode: 'wmoUnit:degC',
				value: null, // MapClick doesn't provide dewpoint in forecast
			},
			relativeHumidity: {
				unitCode: 'wmoUnit:percent',
				value: null, // MapClick doesn't provide humidity in forecast
			},
			windSpeed: null, // MapClick doesn't provide wind speed in forecast
			windDirection: null, // MapClick doesn't provide wind direction in forecast
			icon,
			shortForecast: weather[index],
			detailedForecast: text[index],
		};
	}).filter((period) => period !== null);

	// Return in API forecast format
	return {
		type: 'Feature',
		geometry: {
			type: 'Point',
			coordinates: [mapClickData.location?.longitude, mapClickData.location?.latitude],
		},
		properties: {
			units: 'us',
			forecastGenerator: 'MapClick',
			generatedAt: new Date().toISOString(),
			updateTime: parseMapClickDate(mapClickData.creationDateLocal)?.toISOString() || new Date().toISOString(),
			validTimes: `${time.startValidTime[0]}/${time.startValidTime[time.startValidTime.length - 1]}`,
			elevation: {
				unitCode: 'wmoUnit:m',
				value: mapClickData.location?.elevation ? parseFloat(mapClickData.location.elevation) : null,
			},
			periods,
		},
	};
};

/**
 * Check if API data is stale and should trigger a MapClick fallback
 * @param {string|Date} timestamp - ISO timestamp string or Date object from API data
 * @param {number} maxAgeMinutes - Maximum age in minutes before considering stale (default: 60)
 * @returns {Object} - { isStale: boolean, ageInMinutes: number }
 */
export const isDataStale = (timestamp, maxAgeMinutes = 60) => {
	// Handle both Date objects and timestamp strings
	const observationTime = timestamp instanceof Date ? timestamp : new Date(timestamp);
	const now = new Date();
	const ageInMinutes = (now - observationTime) / (1000 * 60);

	return {
		isStale: ageInMinutes > maxAgeMinutes,
		ageInMinutes,
	};
};

/**
 * Fetch MapClick data from the MapClick API
 * @param {number} latitude - Latitude coordinate
 * @param {number} longitude - Longitude coordinate
 * @param {Object} options - Optional parameters
 * @param {string} stationId - Station identifier (used for URL logging)
 * @param {Function} options.stillWaiting - Callback for loading status
 * @param {number} options.retryCount - Number of retries (default: 3)
 * @returns {Object|null} - MapClick data or null if failed
 */
export const getMapClickData = async (latitude, longitude, stationId, options = {}) => {
	const { stillWaiting, retryCount = 3 } = options;

	// Round coordinates to 4 decimal places to match weather.gov API precision
	const lat = latitude.toFixed(4);
	const lon = longitude.toFixed(4);

	// &unit=0&lg=english are default parameters for MapClick API
	const mapClickUrl = `https://forecast.weather.gov/MapClick.php?FcstType=json&lat=${lat}&lon=${lon}&station=${stationId}`;

	try {
		const mapClickData = await safeJson(mapClickUrl, {
			retryCount,
			stillWaiting,
		});

		if (mapClickData) {
			return mapClickData;
		}

		if (debugFlag('verbose-failures')) {
			console.log(`MapClick: No data available for ${lat},${lon}`);
		}
		return null;
	} catch (error) {
		console.error(`Unexpected error fetching MapClick data for ${lat},${lon}: ${error.message}`);
		return null;
	}
};

/**
 * Get current observation from MapClick API in weather.gov API format
 * @param {number} latitude - Latitude coordinate
 * @param {number} longitude - Longitude coordinate
 * @param {string} stationId - Station identifier (used for URL logging)
 * @param {Object} options - Optional parameters
 * @param {Function} options.stillWaiting - Callback for loading status
 * @param {number} options.retryCount - Number of retries (default: 3)
 * @returns {Object|null} - Current observation in API format or null if failed
 */
export const getMapClickCurrentObservation = async (latitude, longitude, stationId, options = {}) => {
	const { stillWaiting, retryCount = 3 } = options;

	const mapClickData = await getMapClickData(latitude, longitude, stationId, { stillWaiting, retryCount });

	if (!mapClickData?.currentobservation) {
		return null;
	}

	// Convert to API format
	return convertMapClickObservationsToApiFormat(mapClickData.currentobservation);
};

/**
 * Get forecast data from MapClick API in weather.gov API format
 * @param {number} latitude - Latitude coordinate
 * @param {number} longitude - Longitude coordinate
 * @param {string} stationId - Station identifier (used for URL logging)
 * @param {Object} options - Optional parameters
 * @param {Function} options.stillWaiting - Callback for loading status
 * @param {number} options.retryCount - Number of retries (default: 3)
 * @returns {Object|null} - Forecast data in API format or null if failed
 */
export const getMapClickForecast = async (latitude, longitude, stationId, options = {}) => {
	const { stillWaiting, retryCount = 3 } = options;

	const mapClickData = await getMapClickData(latitude, longitude, stationId, { stillWaiting, retryCount });

	if (!mapClickData) {
		return null;
	}

	// Convert to API format
	return convertMapClickForecastToApiFormat(mapClickData);
};

/**
 * Enhanced observation fetcher with MapClick fallback
 * Centralized logic for checking data quality and falling back to MapClick when needed
 * @param {Object} observationData - Original API observation data
 * @param {Object} options - Configuration options
 * @param {Array} options.requiredFields - Array of field definitions with { name, check, required? }
 * @param {number} options.maxOptionalMissing - Max missing optional fields allowed (default: 0)
 * @param {string} options.stationId - Station identifier for looking up coordinates (e.g., 'KORD')
 * @param {Function} options.stillWaiting - Loading callback
 * @param {string} options.debugContext - Debug logging context name
 * @param {number} options.maxAgeMinutes - Max age before considering stale (default: 60)
 * @returns {Object} - { data, wasImproved, improvements, missingFields }
 */
export const enhanceObservationWithMapClick = async (observationData, options = {}) => {
	const {
		requiredFields = [],
		maxOptionalMissing = 0,
		stationId,
		stillWaiting,
		debugContext = 'mapclick',
		maxAgeMinutes = 80, // hourly observation plus 20 minute ingestion delay
	} = options;

	// Helper function to return original data with consistent logging
	const returnOriginalData = (reason, missingRequired = [], missingOptional = [], isStale = false, ageInMinutes = 0) => {
		if (debugFlag(debugContext)) {
			const issues = [];
			if (isStale) issues.push(`API data is stale: ${ageInMinutes.toFixed(0)} minutes old`);
			if (missingRequired.length > 0) issues.push(`API data missing required: ${missingRequired.join(', ')}`);
			if (missingOptional.length > maxOptionalMissing) issues.push(`API data missing optional: ${missingOptional.join(', ')}`);

			if (reason) {
				if (issues.length > 0) {
					console.log(`🚫 ${debugContext}: Station ${stationId} ${reason} (${issues.join(', ')})`);
				} else {
					console.log(`🚫 ${debugContext}: Station ${stationId} ${reason}`);
				}
			} else if (issues.length > 0) {
				console.log(`🚫 ${debugContext}: Station ${stationId} ${issues.join('; ')}`);
			}
		}
		return {
			data: observationData,
			wasImproved: false,
			improvements: [],
			missingFields: [...missingRequired, ...missingOptional],
		};
	};

	if (!observationData) {
		return returnOriginalData('no original observation data');
	}

	// Look up station coordinates from global StationInfo
	if (!stationId || typeof window === 'undefined' || !window.StationInfo) {
		return returnOriginalData('no station ID');
	}

	const stationLookup = Object.values(window.StationInfo).find((s) => s.id === stationId);
	if (!stationLookup) {
		let reason = null;
		if (stationId.length === 4) { // MapClick only supports 4-letter station IDs, so other failures are "expected"
			reason = `station ${stationId} not found in StationInfo`;
		}
		return returnOriginalData(reason);
	}

	// Check data staleness
	const observationTime = new Date(observationData.timestamp);
	const { isStale, ageInMinutes } = isDataStale(observationTime, maxAgeMinutes);

	// Categorize fields by required/optional
	const requiredFieldDefs = requiredFields.filter((field) => field.required !== false);
	const optionalFieldDefs = requiredFields.filter((field) => field.required === false);

	// Check current data quality
	const missingRequired = requiredFieldDefs.filter((field) => field.check(observationData)).map((field) => field.name);
	const missingOptional = optionalFieldDefs.filter((field) => field.check(observationData)).map((field) => field.name);
	const missingOptionalCount = missingOptional.length;

	// Determine if we should try MapClick
	const shouldTryMapClick = isStale || missingRequired.length > 0 || missingOptionalCount > maxOptionalMissing;

	if (!shouldTryMapClick) {
		return returnOriginalData(null, missingRequired, missingOptional, isStale, ageInMinutes);
	}

	// Try MapClick API
	const mapClickData = await getMapClickCurrentObservation(stationLookup.lat, stationLookup.lon, stationId, {
		stillWaiting,
		retryCount: 1,
	});

	if (!mapClickData) {
		return returnOriginalData('MapClick fetch failed', missingRequired, missingOptional, isStale, ageInMinutes);
	}

	// Evaluate MapClick data quality
	const mapClickProps = mapClickData.features[0].properties;
	const mapClickTimestamp = new Date(mapClickProps.timestamp);
	const isFresher = mapClickTimestamp > observationTime;

	const mapClickMissingRequired = requiredFieldDefs.filter((field) => field.check(mapClickProps)).map((field) => field.name);
	const mapClickMissingOptional = optionalFieldDefs.filter((field) => field.check(mapClickProps)).map((field) => field.name);
	const mapClickMissingOptionalCount = mapClickMissingOptional.length;

	// Determine if MapClick data is better
	let hasBetterQuality = false;
	if (optionalFieldDefs.length > 0) {
		// For modules with optional fields (like currentweather)
		hasBetterQuality = (mapClickMissingRequired.length < missingRequired.length)
			|| (missingOptionalCount > maxOptionalMissing && mapClickMissingOptionalCount <= maxOptionalMissing);
	} else {
		// For modules with only required fields (like latestobservations, regionalforecast)
		hasBetterQuality = mapClickMissingRequired.length < missingRequired.length;
	}

	// Only use MapClick if:
	// 1. It doesn't make required fields worse AND
	// 2. It's either fresher OR has better quality
	const doesNotWorsenRequired = mapClickMissingRequired.length <= missingRequired.length;
	const shouldUseMapClick = doesNotWorsenRequired && (isFresher || hasBetterQuality);
	if (!shouldUseMapClick) {
		// Build brief rejection reason only when debugging is enabled
		let rejectionReason = 'MapClick data rejected';
		if (debugFlag(debugContext)) {
			const rejectionDetails = [];

			if (!doesNotWorsenRequired) {
				rejectionDetails.push(`has ${mapClickMissingRequired.length - missingRequired.length} missing fields`);
				if (mapClickMissingRequired.length > 0) {
					rejectionDetails.push(`required: ${mapClickMissingRequired.join(', ')}`);
				}
			} else {
				// MapClick doesn't worsen required fields, but wasn't good enough
				if (!hasBetterQuality) {
					if (optionalFieldDefs.length > 0 && mapClickMissingOptional.length > missingOptional.length) {
						rejectionDetails.push(`optional: ${mapClickMissingOptional.length} vs ${missingOptional.length}`);
					}
				}
				if (!isFresher) {
					const mapClickAgeInMinutes = Math.round((Date.now() - mapClickTimestamp) / (1000 * 60));
					rejectionDetails.push(`older: ${mapClickAgeInMinutes}min`);
				}
			}

			if (rejectionDetails.length > 0) {
				rejectionReason += `: ${rejectionDetails.join('; ')}`;
			}
		}

		return returnOriginalData(rejectionReason, missingRequired, missingOptional, isStale, ageInMinutes);
	}

	// Build improvements list for logging
	const improvements = [];
	if (isFresher) {
		// NOTE: for the forecast version, we'd want to use the `updateTime` property instead of `timestamp`
		const mapClickAgeInMinutes = Math.round((Date.now() - mapClickTimestamp) / (1000 * 60));
		improvements.push(`${mapClickAgeInMinutes} minutes old vs. ${ageInMinutes.toFixed(0)} minutes old`);
	}

	if (hasBetterQuality) {
		const nowPresentRequired = missingRequired.filter((fieldName) => {
			const field = requiredFieldDefs.find((f) => f.name === fieldName);
			return field && !field.check(mapClickProps);
		});
		const nowPresentOptional = missingOptional.filter((fieldName) => {
			const field = optionalFieldDefs.find((f) => f.name === fieldName);
			return field && !field.check(mapClickProps);
		});

		if (nowPresentRequired.length > 0) {
			improvements.push(`provides missing required: ${nowPresentRequired.join(', ')}`);
		}
		if (nowPresentOptional.length > 0) {
			improvements.push(`provides missing optional: ${nowPresentOptional.join(', ')}`);
		}
		if (nowPresentRequired.length === 0 && nowPresentOptional.length === 0 && mapClickMissingRequired.length < missingRequired.length) {
			improvements.push('better data quality');
		}
	}

	// Log the improvements
	if (debugFlag(debugContext)) {
		console.log(`🗺️ ${debugContext}: preferring MapClick data for station ${stationId} (${improvements.join('; ')})`);
	}

	return {
		data: mapClickProps,
		wasImproved: true,
		improvements,
		missingFields: [...mapClickMissingRequired, ...mapClickMissingOptional],
	};
};

export default {
	parseMapClickDate,
	convertMapClickObservationsToApiFormat,
	convertMapClickForecastToApiFormat,
	isDataStale,
	getMapClickData,
	getMapClickCurrentObservation,
	getMapClickForecast,
	enhanceObservationWithMapClick,
};

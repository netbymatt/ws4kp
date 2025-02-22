import { json } from './fetch.mjs';

const openMeteoAdditionalForecastParameters = '&daily=temperature_2m_max,temperature_2m_min&hourly=temperature_2m,relative_humidity_2m,dew_point_2m,apparent_temperature,precipitation_probability,precipitation,rain,showers,snowfall,snow_depth,weather_code,pressure_msl,surface_pressure,cloud_cover,visibility,evapotranspiration,et0_fao_evapotranspiration,vapour_pressure_deficit,uv_index,uv_index_clear_sky,is_day,sunshine_duration,wet_bulb_temperature_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m&models=best_match';

const getPoint = async (lat, lon) => {
	try {
		return await json(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}${openMeteoAdditionalForecastParameters}`);
	} catch (error) {
		console.log(`Unable to get point ${lat}, ${lon}`);
		console.error(error);
		return false;
	}
};

const getGeocoding = async (name) => {
	try {
		return await json(`https://geocoding-api.open-meteo.com/v1/search?name=${name}&count=10&language=en&format=json`);
	} catch (error) {
		console.log(`Unable to get locality with value ${name}`);
		console.error(error);
		return false;
	}
};

const weatherConditions = [
	{ codes: [0], text: ['Clear sky'] },
	{ codes: [1, 2, 3], text: ['Mainly clear', 'Partly cloudy', 'Overcast'] },
	{ codes: [45, 48], text: ['Fog', 'Depositing rime fog'] },
	{ codes: [51, 53, 55], text: ['Light Drizzle', 'Moderate Drizzle', 'Dense Drizzle'] },
	{ codes: [56, 57], text: ['Light Freezing Drizzle', 'Dense Freezing Drizzle'] },
	{ codes: [61, 63, 65], text: ['Slight Rain', 'Moderate Rain', 'Heavy Rain'] },
	{ codes: [66, 67], text: ['Light Freezing Rain', 'Heavy Freezing Rain'] },
	{ codes: [71, 73, 75], text: ['Slight Snow fall', 'Moderate Snow fall', 'Heavy Snow fall'] },
	{ codes: [77], text: ['Snow grains'] },
	{ codes: [80, 81, 82], text: ['Slight Rain showers', 'Moderate Rain showers', 'Violent Rain showers'] },
	{ codes: [85, 86], text: ['Slight Snow showers', 'Heavy Snow Showers'] },
	{ codes: [95], text: ['Thunderstorm'] },
	{ codes: [96, 99], text: ['Thunderstorm with slight hail', 'Thunderstorm with heavy hail'] },
];

const getConditionText = (code) => {
	const conditionIndex = weatherConditions.findIndex((condition) => condition.codes.includes(code));
	const weatherConditionObject = weatherConditions[conditionIndex];

	const weatherTextIndex = weatherConditionObject.codes.findIndex((conditionCode) => conditionCode === code);
	const weatherText = weatherConditionObject.text[weatherTextIndex];

	if (conditionIndex !== -1) return weatherText;

	console.log('unable to determine weather condition from code: ', code);
	return `unknown weather condition with code: ${code}`;
};

/**
 *
 * @param {*} forecast expects the forecast object from open-meteo as the response from `getPoint`
 * @returns  A map indexed by date, with averaged values for each unit in "hourly_units" from the forecast object
 */
const aggregateWeatherForecastData = (getPointResponse) => {
	// We expect the response obhect to be structured hourly like this:
	// {
	// 	"latitude": 52.366,
	// 	"longitude": 4.901,
	// 	"generationtime_ms": 0.5203485488891602,
	// 	"utc_offset_seconds": 0,
	// 	"timezone": "GMT",
	// 	"timezone_abbreviation": "GMT",
	// 	"elevation": 6.0,
	// 	"hourly_units": {
	// 		"time": "iso8601",
	// 		"temperature_2m": "°C",
	// 		"relative_humidity_2m": "%",
	// 		"dew_point_2m": "°C",
	// 		"apparent_temperature": "°C",
	// 		"precipitation_probability": "%",
	// 		"precipitation": "mm",
	// 		"rain": "mm",
	// 		"showers": "mm",
	// 		"snowfall": "cm",
	// 		"snow_depth": "m",
	// 		"weather_code": "wmo code",
	// 		"pressure_msl": "hPa",
	// 		"surface_pressure": "hPa",
	// 		"cloud_cover": "%",
	// 		"visibility": "m",
	// 		"evapotranspiration": "mm",
	// 		"et0_fao_evapotranspiration": "mm",
	// 		"vapour_pressure_deficit": "kPa",
	// 		"uv_index": "",
	// 		"uv_index_clear_sky": "",
	// 		"is_day": "",
	// 		"sunshine_duration": "s",
	// 		"wet_bulb_temperature_2m": "°C"
	// 	},
	// 	"hourly": {
	// 		"time": [
	// 			"<timestamps by hour>"
	// 		],
	// 		"temperature_2m": [
	// 			"<temperature by hour>"
	// 		],
	// 		"relative_humidity_2m": [
	// 			"<relative humidity by hour>"
	// 		],
	// 		etc...
	// 	},
	// }

	const { hourly, daily } = getPointResponse;
	const keys = Object.keys(hourly).filter((key) => key !== 'time');

	const dailyData = {};

	hourly.time.forEach((timestamp, index) => {
		const date = timestamp.split('T')[0];

		if (!dailyData[date]) {
			dailyData[date] = { hours: [], weather_code_counts: {} };
			keys.forEach((key) => {
				dailyData[date][key] = { sum: 0, count: 0 };
			});
		}

		// Collect per-hour data
		const hourData = { time: timestamp };
		keys.forEach((key) => {
			hourData[key] = hourly[key][index];

			// Aggregate sums for daily averages
			dailyData[date][key].sum += hourly[key][index];
			dailyData[date][key].count += 1;
		});

		// Track weather code occurrences
		if (hourly.weather_code) {
			const weatherCode = hourly.weather_code[index];
			dailyData[date].weather_code_counts[weatherCode] = (dailyData[date].weather_code_counts[weatherCode] || 0) + 1;
		}

		// Append the hourly entry to the "hours" array
		dailyData[date].hours.push(hourData);
	});

	// Compute daily averages
	const dailyAverages = {};
	Object.entries(dailyData).forEach(([date, data]) => {
		dailyAverages[date] = { hours: data.hours };
		keys.forEach((key) => {
			dailyAverages[date][key] = data[key].sum / data[key].count;
		});

		// Determine most common weather code
		const weatherCodes = Object.entries(data.weather_code_counts);
		if (weatherCodes.length > 0) {
			[dailyAverages[date].weather_code] = weatherCodes.reduce((a, b) => (b[1] > a[1] ? b : a));
		}
	});

	// Add temperature_2m_max and temperature_2m_min from the daily section
	daily.time.forEach((date, index) => {
		if (!dailyData[date]) {
			dailyData[date] = { hours: [] };
		}
		dailyAverages[date].temperature_2m_max = daily.temperature_2m_max[index];
		dailyAverages[date].temperature_2m_min = daily.temperature_2m_min[index];
	});

	return dailyAverages;
};

export {
	// eslint-disable-next-line import/prefer-default-export
	getPoint,
	getGeocoding,
	aggregateWeatherForecastData,
	getConditionText,
};

import { json } from './fetch.mjs';

const openMeteoAdditionalForecastParameters = '&hourly=temperature_2m,relative_humidity_2m,dew_point_2m,apparent_temperature,precipitation_probability,precipitation,rain,showers,snowfall,snow_depth,weather_code,pressure_msl,surface_pressure,cloud_cover,visibility,evapotranspiration,et0_fao_evapotranspiration,vapour_pressure_deficit,uv_index,uv_index_clear_sky,is_day,sunshine_duration,wet_bulb_temperature_2m&models=best_match';

const getPoint = async (lat, lon) => {
	try {
		return await json(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`+ openMeteoAdditionalForecastParameters);
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

	const { hourly, hourly_units } = getPointResponse;
	const keys = Object.keys(hourly).filter(key => key !== "time");

	const dailyData = {};

	hourly.time.forEach((timestamp, index) => {
		const date = timestamp.split('T')[0];

		if (!dailyData[date]) {
			dailyData[date] = {};
			keys.forEach(key => {
				dailyData[date][key] = { sum: 0, count: 0 };
			});
		}

		keys.forEach(key => {
			dailyData[date][key].sum += hourly[key][index];
			dailyData[date][key].count += 1;
		});
	});

	const dailyAverages = {};

	Object.entries(dailyData).forEach(([date, data]) => {
		dailyAverages[date] = {};
		keys.forEach(key => {
			dailyAverages[date][key] = data[key].sum / data[key].count;
		});
	});

	return dailyAverages;
};

export {
	// eslint-disable-next-line import/prefer-default-export
	getPoint,
	getGeocoding,
	aggregateWeatherForecastData
};

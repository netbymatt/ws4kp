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

export {
	// eslint-disable-next-line import/prefer-default-export
	getPoint,
	getGeocoding,
};

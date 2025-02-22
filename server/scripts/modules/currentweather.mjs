// current weather conditions display
import STATUS from './status.mjs';
import { loadImg, preloadImg } from './utils/image.mjs';
import { json } from './utils/fetch.mjs';
import { directionToNSEW } from './utils/calc.mjs';
import { locationCleanup } from './utils/string.mjs';
import { getWeatherIconFromIconLink } from './icons.mjs';
import WeatherDisplay from './weatherdisplay.mjs';
import { registerDisplay } from './navigation.mjs';
import {
	celsiusToFahrenheit, kphToMph, pascalToInHg, metersToFeet, kilometersToMiles,
} from './utils/units.mjs';
import { getConditionText } from './utils/weather.mjs';

// some stations prefixed do not provide all the necessary data
const skipStations = ['U', 'C', 'H', 'W', 'Y', 'T', 'S', 'M', 'O', 'L', 'A', 'F', 'B', 'N', 'V', 'R', 'D', 'E', 'I', 'G', 'J'];

class CurrentWeather extends WeatherDisplay {
	constructor(navId, elemId) {
		super(navId, elemId, 'Current Conditions', true);
		// pre-load background image (returns promise)
		this.backgroundImage = loadImg('images/BackGround1_1.png');
	}

	async getData(_weatherParameters) {
		// always load the data for use in the lower scroll
		const superResult = super.getData(_weatherParameters);
		const weatherParameters = _weatherParameters ?? this.weatherParameters;
		
		// filter for 4-letter observation stations, only those contain sky conditions and thus an icon
		// const filteredStations = weatherParameters.stations.filter((station) => station?.properties?.stationIdentifier?.length === 4 && !skipStations.includes(station.properties.stationIdentifier.slice(0, 1)));

		// // Load the observations
		// let observations;
		// let station;

		// // station number counter
		// let stationNum = 0;
		// while (!observations && stationNum < filteredStations.length) {
		// 	// get the station
		// 	station = filteredStations[stationNum];
		// 	stationNum += 1;
		// 	try {
		// 		// station observations
		// 		// eslint-disable-next-line no-await-in-loop
		// 		observations = await json(`${station.id}/observations`, {
		// 			cors: true,
		// 			data: {
		// 				limit: 2,
		// 			},
		// 			retryCount: 3,
		// 			stillWaiting: () => this.stillWaiting(),
		// 		});

		// 		// test data quality
		// 		if (observations.features[0].properties.temperature.value === null
		// 			|| observations.features[0].properties.windSpeed.value === null
		// 			|| observations.features[0].properties.textDescription === null
		// 			|| observations.features[0].properties.textDescription === ''
		// 			|| observations.features[0].properties.icon === null
		// 			|| observations.features[0].properties.dewpoint.value === null
		// 			|| observations.features[0].properties.barometricPressure.value === null) {
		// 			observations = undefined;
		// 			throw new Error(`Unable to get observations: ${station.properties.stationIdentifier}, trying next station`);
		// 		}
		// 	} catch (error) {
		// 		console.error(error);
		// 	}
		// }
		// // test for data received
		// if (!observations) {
		// 	console.error('All current weather stations exhausted');
		// 	if (this.isEnabled) this.setStatus(STATUS.failed);
		// 	// send failed to subscribers
		// 	this.getDataCallback(undefined);
		// 	return;
		// }

		// we only get here if there was no error above
		this.data = parseData(weatherParameters);
		this.getDataCallback();

		// stop here if we're disabled
		if (!superResult) return;

		// preload the icon
		// preloadImg(getWeatherIconFromIconLink(observations.features[0].properties.icon));
		this.setStatus(STATUS.loaded);
	}

	async drawCanvas() {
		super.drawCanvas();

		let condition = getConditionText(this.data.TextConditions);
		if (condition.length > 15) {
			condition = shortConditions(condition);
		}

		const iconImage = getWeatherIconFromIconLink(condition, this.data.timeZone);

		const fill = {
			temp: this.data.Temperature + String.fromCharCode(176),
			condition,
			wind: this.data.WindDirection.padEnd(3, '') + this.data.WindSpeed.toString().padStart(3, ' '),
			location: this.data.city,
			humidity: `${this.data.Humidity}%`,
			dewpoint: this.data.DewPoint + String.fromCharCode(176),
			ceiling: (this.data.Ceiling === 0 ? 'Unlimited' : this.data.Ceiling + this.data.CeilingUnit),
			visibility: this.data.Visibility + this.data.VisibilityUnit,
			pressure: `${this.data.Pressure} ${this.data.PressureDirection}`,
			icon: { type: 'img', src: iconImage },
		};

		if (this.data.WindGust) fill['wind-gusts'] = `Gusts to ${this.data.WindGust}`;

		// @todo - figure out heat index
		// if (this.data.observations.heatIndex.value && this.data.HeatIndex !== this.data.Temperature) {
		// 	fill['heat-index-label'] = 'Heat Index:';
		// 	fill['heat-index'] = this.data.HeatIndex + String.fromCharCode(176);
		// } else if (this.data.observations.windChill.value && this.data.WindChill !== '' && this.data.WindChill < this.data.Temperature) {
		// 	fill['heat-index-label'] = 'Wind Chill:';
		// 	fill['heat-index'] = this.data.WindChill + String.fromCharCode(176);
		// }

		const area = this.elem.querySelector('.main');

		area.innerHTML = '';
		area.append(this.fillTemplate('weather', fill));

		this.finishDraw();
	}

	// make data available outside this class
	// promise allows for data to be requested before it is available
	async getCurrentWeather(stillWaiting) {
		if (stillWaiting) this.stillWaitingCallbacks.push(stillWaiting);
		return new Promise((resolve) => {
			if (this.data) resolve(this.data);
			// data not available, put it into the data callback queue
			this.getDataCallbacks.push(() => resolve(this.data));
		});
	}
}

const shortConditions = (_condition) => {
	let condition = _condition;
	condition = condition.replace(/Light/g, 'L');
	condition = condition.replace(/Heavy/g, 'H');
	condition = condition.replace(/Partly/g, 'P');
	condition = condition.replace(/Mostly/g, 'M');
	condition = condition.replace(/Few/g, 'F');
	condition = condition.replace(/Thunderstorm/g, 'T\'storm');
	condition = condition.replace(/ in /g, '');
	condition = condition.replace(/Vicinity/g, '');
	condition = condition.replace(/ and /g, ' ');
	condition = condition.replace(/Freezing Rain/g, 'Frz Rn');
	condition = condition.replace(/Freezing/g, 'Frz');
	condition = condition.replace(/Unknown Precip/g, '');
	condition = condition.replace(/L Snow Fog/g, 'L Snw/Fog');
	condition = condition.replace(/ with /g, '/');
	return condition;
};

const getCurrentWeatherByHourFromTime = (data) => {
	const currentTime = new Date();
	const onlyDate = currentTime.toISOString().split('T')[0]; // Extracts "YYYY-MM-DD"

	const availableTimes = data.forecast[onlyDate].hours;

	const closestTime = availableTimes.reduce((prev, curr) => {
		const prevDiff = Math.abs(new Date(prev.time) - currentTime);
		const currDiff = Math.abs(new Date(curr.time) - currentTime);
		return currDiff < prevDiff ? curr : prev;
	});

	return closestTime;
};

// format the received data
const parseData = (data) => {
	const currentForecast = getCurrentWeatherByHourFromTime(data);

	// values from api are provided in metric
	data.Temperature = currentForecast.temperature_2m;
	data.TemperatureUnit = 'C';
	data.DewPoint = currentForecast.dew_point_2m;
	data.Ceiling = currentForecast.cloud_cover;
	data.CeilingUnit = 'm.';
	data.Visibility = currentForecast.visibility;
	data.VisibilityUnit = 'm.';
	data.WindSpeed = currentForecast.wind_speed_10m;
	data.WindDirection = directionToNSEW(currentForecast.wind_direction_10m);
	data.Pressure = currentForecast.pressure_msl;
	// data.HeatIndex = Math.round(observations.heatIndex.value);
	// data.WindChill = Math.round(observations.windChill.value);
	data.WindGust = currentForecast.wind_gusts_10m;
	data.WindUnit = 'km/h';
	data.Humidity = currentForecast.relative_humidity_2m;
	data.PressureDirection = 'hPa';
	data.TextConditions = currentForecast.weather_code;

	// data.observations = observations;
	// data.Temperature = Math.round(observations.temperature.value);
	// data.TemperatureUnit = 'C';
	// data.DewPoint = Math.round(observations.dewpoint.value);
	// data.Ceiling = Math.round(observations.cloudLayers[0]?.base?.value ?? 0);
	// data.CeilingUnit = 'm.';
	// data.Visibility = Math.round(observations.visibility.value / 1000);
	// data.VisibilityUnit = ' km.';
	// data.WindSpeed = Math.round(observations.windSpeed.value);
	// data.WindDirection = directionToNSEW(observations.windDirection.value);
	// data.Pressure = Math.round(observations.barometricPressure.value);
	// data.HeatIndex = Math.round(observations.heatIndex.value);
	// data.WindChill = Math.round(observations.windChill.value);
	// data.WindGust = Math.round(observations.windGust.value);
	// data.WindUnit = 'KPH';
	// data.Humidity = Math.round(observations.relativeHumidity.value);
	// data.Icon = getWeatherIconFromIconLink(observations.icon);
	// data.PressureDirection = '';
	// data.TextConditions = observations.textDescription;

	// difference since last measurement (pascals, looking for difference of more than 150)
	// const pressureDiff = (observations.barometricPressure.value - data.features[1].properties.barometricPressure.value);
	// if (pressureDiff > 150) data.PressureDirection = 'R';
	// if (pressureDiff < -150) data.PressureDirection = 'F';

	// // convert to us units
	// data.Temperature = celsiusToFahrenheit(data.Temperature);
	// data.TemperatureUnit = 'F';
	// data.DewPoint = celsiusToFahrenheit(data.DewPoint);
	// data.Ceiling = Math.round(metersToFeet(data.Ceiling) / 100) * 100;
	// data.CeilingUnit = 'ft.';
	// data.Visibility = kilometersToMiles(observations.visibility.value / 1000);
	// data.VisibilityUnit = ' mi.';
	// data.WindSpeed = kphToMph(data.WindSpeed);
	// data.WindUnit = 'MPH';
	// data.Pressure = pascalToInHg(data.Pressure).toFixed(2);
	// data.HeatIndex = celsiusToFahrenheit(data.HeatIndex);
	// data.WindChill = celsiusToFahrenheit(data.WindChill);
	// data.WindGust = kphToMph(data.WindGust);
	return data;
};

const display = new CurrentWeather(1, 'current-weather');
registerDisplay(display);

export default display.getCurrentWeather.bind(display);

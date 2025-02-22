// current weather conditions display
import STATUS from './status.mjs';
import { loadImg } from './utils/image.mjs';
import { directionToNSEW } from './utils/calc.mjs';
import { getWeatherIconFromIconLink } from './icons.mjs';
import WeatherDisplay from './weatherdisplay.mjs';
import { registerDisplay } from './navigation.mjs';
import { getConditionText } from './utils/weather.mjs';

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

		// we only get here if there was no error above
		this.data = parseData(weatherParameters);
		this.getDataCallback();

		// stop here if we're disabled
		if (!superResult) return;

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

	return data;
};

const display = new CurrentWeather(1, 'current-weather');
registerDisplay(display);

export default display.getCurrentWeather.bind(display);

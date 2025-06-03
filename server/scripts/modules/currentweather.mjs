// current weather conditions display
import STATUS from './status.mjs';
import { preloadImg } from './utils/image.mjs';
import { json } from './utils/fetch.mjs';
import { directionToNSEW } from './utils/calc.mjs';
import { locationCleanup } from './utils/string.mjs';
import { getLargeIcon } from './icons.mjs';
import WeatherDisplay from './weatherdisplay.mjs';
import { registerDisplay } from './navigation.mjs';
import {
	temperature, windSpeed, pressure, distanceMeters, distanceKilometers,
} from './utils/units.mjs';

// some stations prefixed do not provide all the necessary data
const skipStations = ['U', 'C', 'H', 'W', 'Y', 'T', 'S', 'M', 'O', 'L', 'A', 'F', 'B', 'N', 'V', 'R', 'D', 'E', 'I', 'G', 'J'];

class CurrentWeather extends WeatherDisplay {
	constructor(navId, elemId) {
		super(navId, elemId, 'Current Conditions', true);
	}

	async getData(weatherParameters, refresh) {
		// always load the data for use in the lower scroll
		const superResult = super.getData(weatherParameters, refresh);
		// note: current weather does not use old data on a silent refresh
		// this is deliberate because it can pull data from more than one station in sequence

		// filter for 4-letter observation stations, only those contain sky conditions and thus an icon
		const filteredStations = this.weatherParameters.stations.filter((station) => station?.properties?.stationIdentifier?.length === 4 && !skipStations.includes(station.properties.stationIdentifier.slice(0, 1)));

		// Load the observations
		let observations;
		let station;

		// station number counter
		let stationNum = 0;
		while (!observations && stationNum < filteredStations.length) {
			// get the station
			station = filteredStations[stationNum];
			stationNum += 1;
			try {
				// station observations
				// eslint-disable-next-line no-await-in-loop
				observations = await json(`${station.id}/observations`, {
					data: {
						limit: 2,
					},
					retryCount: 3,
					stillWaiting: () => this.stillWaiting(),
				});

				if (observations.features.length === 0) throw new Error(`No features returned for station: ${station.properties.stationIdentifier}, trying next station`);

				// test data quality
				if (observations.features[0].properties.temperature.value === null
					|| observations.features[0].properties.windSpeed.value === null
					|| observations.features[0].properties.textDescription === null
					|| observations.features[0].properties.textDescription === ''
					|| observations.features[0].properties.icon === null
					|| observations.features[0].properties.dewpoint.value === null
					|| observations.features[0].properties.barometricPressure.value === null) {
					observations = undefined;
					throw new Error(`Incomplete data set for: ${station.properties.stationIdentifier}, trying next station`);
				}
			} catch (error) {
				console.error(error);
				observations = undefined;
			}
		}
		// test for data received
		if (!observations) {
			console.error('All current weather stations exhausted');
			if (this.isEnabled) this.setStatus(STATUS.failed);
			// send failed to subscribers
			this.getDataCallback(undefined);
			return;
		}

		// we only get here if there was no error above
		this.data = parseData({ ...observations, station });
		this.getDataCallback();

		// stop here if we're disabled
		if (!superResult) return;

		// preload the icon
		preloadImg(getLargeIcon(observations.features[0].properties.icon));
		this.setStatus(STATUS.loaded);
	}

	async drawCanvas() {
		super.drawCanvas();

		let condition = this.data.observations.textDescription;
		if (condition.length > 15) {
			condition = shortConditions(condition);
		}

		const fill = {
			temp: this.data.Temperature + String.fromCharCode(176),
			condition,
			wind: this.data.WindDirection.padEnd(3, '') + this.data.WindSpeed.toString().padStart(3, ' '),
			location: locationCleanup(this.data.station.properties.name).substr(0, 20),
			humidity: `${this.data.Humidity}%`,
			dewpoint: this.data.DewPoint + String.fromCharCode(176),
			ceiling: (this.data.Ceiling === 0 ? 'Unlimited' : this.data.Ceiling + this.data.CeilingUnit),
			visibility: this.data.Visibility + this.data.VisibilityUnit,
			pressure: `${this.data.Pressure} ${this.data.PressureDirection}`,
			icon: { type: 'img', src: this.data.Icon },
		};

		if (this.data.WindGust) fill['wind-gusts'] = `Gusts to ${this.data.WindGust}`;

		if (this.data.observations.heatIndex.value && this.data.HeatIndex !== this.data.Temperature) {
			fill['heat-index-label'] = 'Heat Index:';
			fill['heat-index'] = this.data.HeatIndex + String.fromCharCode(176);
		} else if (this.data.observations.windChill.value && this.data.WindChill !== '' && this.data.WindChill < this.data.Temperature) {
			fill['heat-index-label'] = 'Wind Chill:';
			fill['heat-index'] = this.data.WindChill + String.fromCharCode(176);
		}

		const area = this.elem.querySelector('.main');

		area.innerHTML = '';
		area.append(this.fillTemplate('weather', fill));

		this.finishDraw();
	}

	// make data available outside this class
	// promise allows for data to be requested before it is available
	async getCurrentWeather(stillWaiting) {
		// an external caller has requested data, set up auto reload
		this.setAutoReload();
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

// format the received data
const parseData = (data) => {
	// get the unit converter
	const windConverter = windSpeed();
	const temperatureConverter = temperature();
	const metersConverter = distanceMeters();
	const kilometersConverter = distanceKilometers();
	const pressureConverter = pressure();

	const observations = data.features[0].properties;
	// values from api are provided in metric
	data.observations = observations;
	data.Temperature = temperatureConverter(observations.temperature.value);
	data.TemperatureUnit = temperatureConverter.units;
	data.DewPoint = temperatureConverter(observations.dewpoint.value);
	data.Ceiling = metersConverter(observations.cloudLayers[0]?.base?.value ?? 0);
	data.CeilingUnit = metersConverter.units;
	data.Visibility = kilometersConverter(observations.visibility.value);
	data.VisibilityUnit = kilometersConverter.units;
	data.Pressure = pressureConverter(observations.barometricPressure.value);
	data.PressureUnit = pressureConverter.units;
	data.HeatIndex = temperatureConverter(observations.heatIndex.value);
	data.WindChill = temperatureConverter(observations.windChill.value);
	data.WindSpeed = windConverter(observations.windSpeed.value);
	data.WindDirection = directionToNSEW(observations.windDirection.value);
	data.WindGust = windConverter(observations.windGust.value);
	data.WindSpeed = windConverter(data.WindSpeed);
	data.WindUnit = windConverter.units;
	data.Humidity = Math.round(observations.relativeHumidity.value);
	data.Icon = getLargeIcon(observations.icon);
	data.PressureDirection = '';
	data.TextConditions = observations.textDescription;

	// difference since last measurement (pascals, looking for difference of more than 150)
	const pressureDiff = (observations.barometricPressure.value - data.features[1].properties.barometricPressure.value);
	if (pressureDiff > 150) data.PressureDirection = 'R';
	if (pressureDiff < -150) data.PressureDirection = 'F';

	return data;
};

const display = new CurrentWeather(1, 'current-weather');
registerDisplay(display);

export default display.getCurrentWeather.bind(display);

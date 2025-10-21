// current weather conditions display
import STATUS from './status.mjs';
import { safeJson } from './utils/fetch.mjs';
import { directionToNSEW } from './utils/calc.mjs';
import { locationCleanup } from './utils/string.mjs';
import WeatherDisplay from './weatherdisplay.mjs';
import { registerDisplay } from './navigation.mjs';
import {
	temperature, windSpeed, pressure, distanceMeters, distanceKilometers,
} from './utils/units.mjs';
import { debugFlag } from './utils/debug.mjs';
import Setting from './utils/setting.mjs';

class PersonalWeather extends WeatherDisplay {
	constructor(navId, elemId) {
		super(navId, elemId, 'Personal Weather Station', true);
	}

	async getData(weatherParameters, refresh) {
		// always load the data for use in the lower scroll
		const superResult = super.getData(weatherParameters, refresh);

		const dataUrl = '/ambient-relay/api/latest';

		let personalData;
		try {
			personalData = await safeJson(dataUrl, {
				retryCount: 3,
				stillWaiting: () => this.stillWaiting(),
			});
		} catch (e) {
			console.error(`Unexpected error getting personal weather station data from: ${dataUrl}: ${error.message}`);
		}
		// test for data received
		if (!personalData) {
			if (this.isEnabled) this.setStatus(STATUS.failed);
			// send failed to subscribers
			this.getDataCallback(undefined);
			return;
		}

		// we only get here if there was no error above
		this.data = parseData(personalData);
		this.getDataCallback();

		// stop here if we're disabled
		if (!superResult) return;

		// Data is available, ensure we're enabled for display
		this.timing.totalScreens = 1;
		this.setStatus(STATUS.loaded);
	}

	async drawCanvas() {
		super.drawCanvas();

		const wind = (typeof this.data.WindSpeed === 'number') ? this.data.WindDirection.padEnd(3, '') + this.data.WindSpeed.toString().padStart(3, ' ') : this.data.WindSpeed;

		// get location (city name) from StationInfo if available (allows for overrides)
		const location = (StationInfo[this.data.station.properties.stationIdentifier]?.city ?? locationCleanup(this.data.station.properties.name)).substr(0, 20);

		const fill = {
			temp: this.data.Temperature + String.fromCharCode(176),
			condition,
			wind,
			location,
			humidity: `${this.data.Humidity}%`,
			dewpoint: this.data.DewPoint + String.fromCharCode(176),
			ceiling: (this.data.Ceiling === 0 ? 'Unlimited' : this.data.Ceiling + this.data.CeilingUnit),
			visibility: this.data.Visibility + this.data.VisibilityUnit,
			pressure: `${this.data.Pressure} ${this.data.PressureDirection}`,
			icon: { type: 'img', src: this.data.Icon },
		};

		if (this.data.WindGust !== '-') fill['wind-gusts'] = `Gusts to ${this.data.WindGust}`;

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

// format the received data
const parseData = (data) => {
	// get the unit converter
	const windConverter = windSpeed('us');
	const temperatureConverter = temperature('us');
	const metersConverter = distanceMeters('us');
	const kilometersConverter = distanceKilometers('us');
	const pressureConverter = pressure('us');

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
	data.WindUnit = windConverter.units;
	data.Humidity = Math.round(observations.relativeHumidity.value);

	// Get the large icon, but provide a fallback if it returns false
	const iconResult = getLargeIcon(observations.icon);
	data.Icon = iconResult || observations.icon; // Use original icon if getLargeIcon returns false

	data.PressureDirection = '';
	data.TextConditions = observations.textDescription;

	// set wind speed of 0 as calm
	if (data.WindSpeed === 0) data.WindSpeed = 'Calm';

	// if two measurements are available, use the difference (in pascals) to determine pressure trend
	if (data.features.length > 1 && data.features[1].properties.barometricPressure?.value) {
		const pressureDiff = (observations.barometricPressure.value - data.features[1].properties.barometricPressure.value);
		if (pressureDiff > 150) data.PressureDirection = 'R';
		if (pressureDiff < -150) data.PressureDirection = 'F';
	}

	return data;
};

const display = new PersonalWeather(2, 'personal-weather');
registerDisplay(display);

// export default display.getPersonalWeather.bind(display);

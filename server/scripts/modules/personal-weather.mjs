// current weather conditions display
import STATUS from './status.mjs';
import { safeJson } from './utils/fetch.mjs';
import WeatherDisplay from './weatherdisplay.mjs';
import { registerDisplay } from './navigation.mjs';
import {
	temperature, pressure, distanceMm, windSpeed,
} from './utils/units.mjs';

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
		} catch (error) {
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

		const fill = {
			temp: this.data.Temperature + String.fromCharCode(176),
			wind: `${this.data.WindSpeed} ${this.data.WindUnit}`,
			deviceName: this.data.device_name,
			deviceLocation: this.data.device_location,
			humidity: `${this.data.Humidity}%`,
			pressure: `${this.data.Pressure} ${this.data.PressureUnit}`,
		};

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
	// get the unit converters
	const temperatureConverter = temperature('us');
	const pressureConverter = pressure('us');
	const inConverter = distanceMm('us');
	const windConverter = windSpeed('us');

	data.Pressure = pressureConverter(data.baromrelin * 10000) / 100;
	data.PressureUnit = pressureConverter.units;
	data.Humidity = data.humidity;
	data.Temperature = temperatureConverter(data.tempf);
	data.WindSpeed = windConverter(data.windspeedmph);
	data.WindUnit = windConverter.units;
	data.DailyRain = inConverter(data.dailyrainin);
	data.DailyRainUnit = inConverter.units;

	// set wind speed of 0 as calm
	if (data.WindSpeed === 0) data.WindSpeed = 'Calm';

	return data;
};

const display = new PersonalWeather(2, 'personal-weather');
registerDisplay(display);

// export default display.getPersonalWeather.bind(display);

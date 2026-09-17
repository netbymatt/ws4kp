// hourly forecast list

import STATUS from './status.mjs';
import { DateTime, Interval, Duration } from '../vendor/auto/luxon.mjs';
import { safeJson } from './utils/fetch.mjs';
import { temperature as temperatureUnit, windSpeed as windUnit } from './utils/units.mjs';
import hourlyIcon from './icons/hourly.mjs';
import { directionToNSEW } from './utils/calc.mjs';
import ScrollWeatherDisplay from './scroll-weather-display.mjs';
import { registerDisplay, timeZone } from './navigation.mjs';
import getSun from './almanac.mjs';
import { debugFlag } from './utils/debug.mjs';

// A cheap, stable signature of the content about to be rendered. The hour is included per row
// because the row labels are derived from the current time, so an hour rollover changes the
// display even when every forecast value is unchanged.
const rowsSignature = (rows) => [
	...rows.map((row) => `${row.hour.toISO()}|${row.temperature}|${row.apparentTemperature}|${row.windSpeed}|${row.windDirection}|${row.icon}`),
].join('\u0000');

class Hourly extends ScrollWeatherDisplay {
	constructor(navId, elemId, defaultActive) {
		// special height and width for scrolling
		super(navId, elemId, 'Hourly Forecast', defaultActive, {
			linesSelector: '.hourly-lines',
		});
	}

	async getData(weatherParameters, refresh) {
		// super checks for enabled
		const superResponse = super.getData(weatherParameters, refresh);

		try {
			const forecast = await safeJson(this.weatherParameters.forecastGridData, { retryCount: 3, stillWaiting: () => this.stillWaiting() });

			if (forecast) {
				try {
					// parse the forecast
					this.data = await parseForecast(forecast.properties);
				} catch (error) {
					console.error(`Hourly forecast parsing failed: ${error.message}`);
				}
			} else if (debugFlag('verbose-failures')) {
				console.warn(`Using previous hourly forecast for ${this.weatherParameters.forecastGridData}`);
			}

			// use old data if available, fail if no data at all
			if (!this.data) {
				if (this.isEnabled) this.setStatus(STATUS.failed);
				// return undefined to other subscribers
				this.getDataCallback(undefined);
				return;
			}

			this.getDataCallback();
			if (!superResponse) return;

			this.setStatus(STATUS.loaded);
			this.drawLongCanvas();
		} catch (error) {
			console.error(`Unexpected error getting hourly forecast: ${error.message}`);
			if (this.isEnabled) this.setStatus(STATUS.failed);
			this.getDataCallback(undefined);
		}
	}

	// shorten to 24 hours, and attach the hour each row represents so the label and the
	// signature stay in agreement. truncating to the hour keeps the signature stable between
	// refreshes within the same hour; the label only renders the weekday and hour anyway.
	scrollRows() {
		const startingHour = DateTime.local().setZone(timeZone()).startOf('hour');
		return this.data.slice(0, 24).map((data, index) => ({
			...data,
			hour: startingHour.plus({ hours: index }),
		}));
	}

	// eslint-disable-next-line class-methods-use-this
	contentSignature(rows) {
		return rowsSignature(rows);
	}

	buildRow(data) {
		const fillValues = {};
		// hour
		fillValues.hour = data.hour.toLocaleString({ weekday: 'short', hour: 'numeric' });

		// temperatures, convert to strings with no decimal
		const temperature = data.temperature.toString().padStart(3);
		const feelsLike = data.apparentTemperature.toString().padStart(3);
		fillValues.temp = temperature;

		// apparent temperature is color coded if different from actual temperature (after fill is applied)
		fillValues.like = feelsLike;

		// wind
		fillValues.wind = 'Calm';
		if (data.windSpeed > 0) {
			const windSpeed = Math.round(data.windSpeed).toString();
			fillValues.wind = data.windDirection.padEnd(3, ' ') + windSpeed.padStart(3, ' ');
		}

		// image
		fillValues.icon = { type: 'img', src: data.icon };

		const filledRow = this.fillTemplate('hourly-row', fillValues);

		// alter the color of the feels like column to reflect wind chill or heat index
		if (data.apparentTemperature < data.temperature) {
			filledRow.querySelector('.like').classList.add('wind-chill');
		} else if (data.apparentTemperature > data.temperature) {
			filledRow.querySelector('.like').classList.add('heat-index');
		}

		return filledRow;
	}

	// make data available outside this class
	// promise allows for data to be requested before it is available
	async getHourlyData(stillWaiting) {
		if (stillWaiting) this.stillWaitingCallbacks.push(stillWaiting);
		// an external caller has requested data, set up auto reload
		this.setAutoReload();
		return new Promise((resolve) => {
			if (this.data) resolve(this.data);
			// data not available, put it into the data callback queue
			this.getDataCallbacks.push(() => resolve(this.data));
		});
	}
}

// extract specific values from forecast and format as an array
const parseForecast = async (data) => {
	// get unit converters
	const temperatureConverter = temperatureUnit();
	const windConverter = windUnit();

	// parse data
	const temperature = expand(data.temperature.values);
	const apparentTemperature = expand(data.apparentTemperature.values);
	const windSpeed = expand(data.windSpeed.values);
	const windDirection = expand(data.windDirection.values);
	const skyCover = expand(data.skyCover.values);	// cloud icon
	const weather = expand(data.weather.values);	// fog icon
	const iceAccumulation = expand(data.iceAccumulation.values); // ice icon
	const probabilityOfPrecipitation = expand(data.probabilityOfPrecipitation.values);	// rain icon
	const snowfallAmount = expand(data.snowfallAmount.values);	// snow icon
	const dewpoint = expand(data.dewpoint.values);

	const icons = await determineIcon(skyCover, weather, iceAccumulation, probabilityOfPrecipitation, snowfallAmount, windSpeed);

	return temperature.map((val, idx) => ({
		temperature: temperatureConverter(temperature[idx]),
		temperatureUnit: temperatureConverter.units,
		apparentTemperature: temperatureConverter(apparentTemperature[idx]),
		windSpeed: windConverter(windSpeed[idx]),
		windUnit: windConverter.units,
		windDirection: directionToNSEW(windDirection[idx]),
		probabilityOfPrecipitation: probabilityOfPrecipitation[idx],
		skyCover: skyCover[idx],
		icon: icons[idx],
		dewpoint: temperatureConverter(dewpoint[idx]),
	}));
};

// given forecast paramaters determine a suitable icon
const determineIcon = async (skyCover, weather, iceAccumulation, probabilityOfPrecipitation, snowfallAmount, windSpeed) => {
	const startOfHour = DateTime.local().setZone(timeZone()).startOf('hour');
	const sunTimes = (await getSun()).sun;
	const overnight = Interval.fromDateTimes(DateTime.fromJSDate(sunTimes[0].sunset), DateTime.fromJSDate(sunTimes[1].sunrise));
	const tomorrowOvernight = DateTime.fromJSDate(sunTimes[1].sunset);
	return skyCover.map((val, idx) => {
		const hour = startOfHour.plus({ hours: idx });
		const isNight = overnight.contains(hour) || (hour > tomorrowOvernight);
		return hourlyIcon(skyCover[idx], weather[idx], iceAccumulation[idx], probabilityOfPrecipitation[idx], snowfallAmount[idx], windSpeed[idx], isNight);
	});
};

// expand a set of values with durations to an hour-by-hour array
const expand = (data, maxHours = 48) => {
	const startOfHour = DateTime.utc().startOf('hour').toMillis();
	const result = []; // resulting expanded values
	data.forEach((item) => {
		let startTime = Date.parse(item.validTime.substr(0, item.validTime.indexOf('/')));
		const duration = Duration.fromISO(item.validTime.substr(item.validTime.indexOf('/') + 1)).shiftTo('milliseconds').values.milliseconds;
		const endTime = startTime + duration;
		// loop through duration at one hour intervals
		do {
			// test for timestamp greater than now
			if (startTime >= startOfHour && result.length < maxHours) {
				result.push(item.value); // push data array
			} // timestamp is after now
			// increment start time by 1 hour
			startTime += 3_600_000;
		} while (startTime < endTime && result.length < maxHours);
	}); // for each value

	return result;
};

// register display
const display = new Hourly(3, 'hourly', false);
registerDisplay(display);

const getHourlyData = display.getHourlyData.bind(display);

export default getHourlyData;

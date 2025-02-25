// hourly forecast list

import STATUS from './status.mjs';
import { DateTime, Interval, Duration } from '../vendor/auto/luxon.mjs';
import { json } from './utils/fetch.mjs';
import { temperature as temperatureUnit, distanceKilometers } from './utils/units.mjs';
import { getHourlyIcon } from './icons.mjs';
import { directionToNSEW } from './utils/calc.mjs';
import WeatherDisplay from './weatherdisplay.mjs';
import { registerDisplay, timeZone } from './navigation.mjs';
import getSun from './almanac.mjs';

class Hourly extends WeatherDisplay {
	constructor(navId, elemId, defaultActive) {
		// special height and width for scrolling
		super(navId, elemId, 'Hourly Forecast', defaultActive);

		// set up the timing
		this.timing.baseDelay = 20;
		// 24 hours = 6 pages
		const pages = 4; // first page is already displayed, last page doesn't happen
		const timingStep = 75 * 4;
		this.timing.delay = [150 + timingStep];
		// add additional pages
		for (let i = 0; i < pages; i += 1) this.timing.delay.push(timingStep);
		// add the final 3 second delay
		this.timing.delay.push(150);
	}

	async getData(weatherParameters) {
		// super checks for enabled
		const superResponse = super.getData(weatherParameters);
		let forecast;
		try {
			// get the forecast
			forecast = await json(weatherParameters.forecastGridData, { retryCount: 3, stillWaiting: () => this.stillWaiting() });
		} catch (error) {
			console.error('Get hourly forecast failed');
			console.error(error.status, error.responseJSON);
			if (this.isEnabled) this.setStatus(STATUS.failed);
			// return undefined to other subscribers
			this.getDataCallback(undefined);
			return;
		}

		this.data = await parseForecast(forecast.properties);
		this.getDataCallback();
		if (!superResponse) return;

		this.setStatus(STATUS.loaded);
		this.drawLongCanvas();
	}

	async drawLongCanvas() {
		// get the list element and populate
		const list = this.elem.querySelector('.hourly-lines');
		list.innerHTML = '';

		const startingHour = DateTime.local().setZone(timeZone());

		const lines = this.data.map((data, index) => {
			const fillValues = {};
			// hour
			const hour = startingHour.plus({ hours: index });
			const formattedHour = hour.toLocaleString({ weekday: 'short', hour: 'numeric' });
			fillValues.hour = formattedHour;

			// temperatures, convert to strings with no decimal
			const temperature = data.temperature.toString().padStart(3);
			const feelsLike = data.apparentTemperature.toString().padStart(3);
			fillValues.temp = temperature;
			// only plot apparent temperature if there is a difference
			// if (temperature !== feelsLike) line.querySelector('.like').innerHTML = feelsLike;
			if (temperature !== feelsLike) fillValues.like = feelsLike;

			// wind
			let wind = 'Calm';
			if (data.windSpeed > 0) {
				const windSpeed = Math.round(data.windSpeed).toString();
				wind = data.windDirection + (Array(6 - data.windDirection.length - windSpeed.length).join(' ')) + windSpeed;
			}
			fillValues.wind = wind;

			// image
			fillValues.icon = { type: 'img', src: data.icon };

			return this.fillTemplate('hourly-row', fillValues);
		});

		list.append(...lines);
	}

	drawCanvas() {
		super.drawCanvas();
		this.finishDraw();
	}

	showCanvas() {
		// special to hourly to draw the remainder of the canvas
		this.drawCanvas();
		super.showCanvas();
	}

	// screen index change callback just runs the base count callback
	screenIndexChange() {
		this.baseCountChange(this.navBaseCount);
	}

	// base count change callback
	baseCountChange(count) {
		// calculate scroll offset and don't go past end
		let offsetY = Math.min(this.elem.querySelector('.hourly-lines').offsetHeight - 289, (count - 150));

		// don't let offset go negative
		if (offsetY < 0) offsetY = 0;

		// copy the scrolled portion of the canvas
		this.elem.querySelector('.main').scrollTo(0, offsetY);
	}

	// make data available outside this class
	// promise allows for data to be requested before it is available
	async getCurrentData(stillWaiting) {
		if (stillWaiting) this.stillWaitingCallbacks.push(stillWaiting);
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
	const distanceConverter = distanceKilometers();

	// parse data
	const temperature = expand(data.temperature.values);
	const apparentTemperature = expand(data.apparentTemperature.values);
	const windSpeed = expand(data.windSpeed.values);
	const windDirection = expand(data.windDirection.values);
	const skyCover = expand(data.skyCover.values);	// cloud icon
	const weather = expand(data.weather.values);	// fog icon
	const iceAccumulation = expand(data.iceAccumulation.values); 	// ice icon
	const probabilityOfPrecipitation = expand(data.probabilityOfPrecipitation.values);	// rain icon
	const snowfallAmount = expand(data.snowfallAmount.values);	// snow icon

	const icons = await determineIcon(skyCover, weather, iceAccumulation, probabilityOfPrecipitation, snowfallAmount, windSpeed);

	return temperature.map((val, idx) => ({
		temperature: temperatureConverter(temperature[idx]),
		temperatureUnit: temperatureConverter.units,
		apparentTemperature: temperatureConverter(apparentTemperature[idx]),
		windSpeed: distanceConverter(windSpeed[idx]),
		windUnit: distanceConverter.units,
		windDirection: directionToNSEW(windDirection[idx]),
		probabilityOfPrecipitation: probabilityOfPrecipitation[idx],
		skyCover: skyCover[idx],
		icon: icons[idx],
	}));
};

// given forecast paramaters determine a suitable icon
const determineIcon = async (skyCover, weather, iceAccumulation, probabilityOfPrecipitation, snowfallAmount, windSpeed) => {
	const startOfHour = DateTime.local().startOf('hour');
	const sunTimes = (await getSun()).sun;
	const overnight = Interval.fromDateTimes(DateTime.fromJSDate(sunTimes[0].sunset), DateTime.fromJSDate(sunTimes[1].sunrise));
	const tomorrowOvernight = DateTime.fromJSDate(sunTimes[1].sunset);
	return skyCover.map((val, idx) => {
		const hour = startOfHour.plus({ hours: idx });
		const isNight = overnight.contains(hour) || (hour > tomorrowOvernight);
		return getHourlyIcon(skyCover[idx], weather[idx], iceAccumulation[idx], probabilityOfPrecipitation[idx], snowfallAmount[idx], windSpeed[idx], isNight);
	});
};

// expand a set of values with durations to an hour-by-hour array
const expand = (data) => {
	const startOfHour = DateTime.utc().startOf('hour').toMillis();
	const result = []; // resulting expanded values
	data.forEach((item) => {
		let startTime = Date.parse(item.validTime.substr(0, item.validTime.indexOf('/')));
		const duration = Duration.fromISO(item.validTime.substr(item.validTime.indexOf('/') + 1)).shiftTo('milliseconds').values.milliseconds;
		const endTime = startTime + duration;
		// loop through duration at one hour intervals
		do {
			// test for timestamp greater than now
			if (startTime >= startOfHour && result.length < 24) {
				result.push(item.value); // push data array
			} // timestamp is after now
			// increment start time by 1 hour
			startTime += 3_600_000;
		} while (startTime < endTime && result.length < 24);
	}); // for each value

	return result;
};

// register display
const display = new Hourly(3, 'hourly', false);
registerDisplay(display);

export default display.getCurrentData.bind(display);

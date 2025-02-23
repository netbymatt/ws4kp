// hourly forecast list

import STATUS from './status.mjs';
import { DateTime } from '../vendor/auto/luxon.mjs';
import { getWeatherRegionalIconFromIconLink } from './icons.mjs';
import { directionToNSEW } from './utils/calc.mjs';
import WeatherDisplay from './weatherdisplay.mjs';
import { registerDisplay } from './navigation.mjs';
import { getConditionText } from './utils/weather.mjs';

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
		this.data = await parseForecast(weatherParameters);
		this.getDataCallback();

		this.setStatus(STATUS.loaded);
		this.drawLongCanvas();
	}

	async drawLongCanvas() {
		// get the list element and populate
		const list = this.elem.querySelector('.hourly-lines');
		list.innerHTML = '';

		const startingHour = DateTime.local();

		const lines = this.data.map((data, index) => {
			const fillValues = {};

			// hour
			const hour = startingHour.plus({ hours: index });
			const formattedHour = hour.toLocaleString({ weekday: 'short', hour: 'numeric' });
			fillValues.hour = formattedHour;

			// temperatures, convert to strings with no decimal
			const temperature = Math.round(data.temperature).toString().padStart(3);
			const feelsLike = Math.round(data.apparentTemperature).toString().padStart(3);
			fillValues.temp = temperature;
			// only plot apparent temperature if there is a difference
			// if (temperature !== feelsLike) line.querySelector('.like').innerHTML = feelsLike;
			if (temperature !== feelsLike) fillValues.like = feelsLike;

			// wind
			let wind = 'Calm';
			if (data.windSpeed > 0) {
				const windSpeed = Math.round(data.windSpeed).toString();
				const windDirection = directionToNSEW(data.windDirection);
				wind = windDirection + (Array(6 - windDirection.length - windSpeed.length).join(' ')) + windSpeed;
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

const getCurrentWeatherByHourFromTime = (data) => {
	const currentTime = new Date();
	const onlyDate = currentTime.toISOString().split('T')[0]; // Extracts "YYYY-MM-DD"

	const availableTimes = data.forecast[onlyDate].hours;
	const nextDate = DateTime.fromISO(onlyDate).plus({ days: 1 }).toISODate();

	const availableTimesNextDay = data.forecast[nextDate]?.hours || [];
	const allAvailableTimes = [...availableTimes, ...availableTimesNextDay];

	let closestIndex = 0;
	let closestTime = availableTimes[0];
	let minDiff = Math.abs(new Date(closestTime.time) - currentTime);

	availableTimes.forEach((entry, index) => {
		const diff = Math.abs(new Date(entry.time) - currentTime);
		if (diff < minDiff) {
			minDiff = diff;
			closestTime = entry;
			closestIndex = index;
		}
	});

	return { closestTime, index: closestIndex, todayAndTomorrow: allAvailableTimes };
};

// extract specific values from forecast and format as an array
const parseForecast = async (data) => {
	const currentForecast = getCurrentWeatherByHourFromTime(data);

	// Split today's date at the returned hourly index and iterate through 'todayAndTomorrow' from currentForecast to create hourly rows
	const iterableHourlyData = currentForecast.todayAndTomorrow.slice(currentForecast.index).map((hour) => ({
		temperature: hour.temperature_2m,
		apparentTemperature: hour.apparent_temperature,
		windSpeed: hour.wind_speed_10m,
		windDirection: hour.wind_direction_10m,
		probabilityOfPrecipitation: hour.precipitation_probability,
		skyCover: hour.cloud_cover,
		icon: getWeatherRegionalIconFromIconLink(getConditionText(hour.weather_code), hour.is_day),
		// is_day appears to be "buggy," in that it uses the calling application's IP/location to
		// determine whether is_day is day or night relative to the calling machine's timezone....
		isDay: hour.is_day,
	}));

	return iterableHourlyData;
};

// register display
const display = new Hourly(3, 'hourly', false);
registerDisplay(display);

export default display.getCurrentData.bind(display);

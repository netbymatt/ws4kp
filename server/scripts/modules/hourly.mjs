// hourly forecast list

import STATUS from './status.mjs';
import { DateTime, Interval, Duration } from '../vendor/auto/luxon.mjs';
import { safeJson } from './utils/fetch.mjs';
import { temperature as temperatureUnit, windSpeed as windUnit } from './utils/units.mjs';
import { getHourlyIcon } from './icons.mjs';
import { directionToNSEW } from './utils/calc.mjs';
import WeatherDisplay from './weatherdisplay.mjs';
import { registerDisplay, timeZone } from './navigation.mjs';
import getSun from './almanac.mjs';
import calculateScrollTiming from './utils/scroll-timing.mjs';
import { debugFlag } from './utils/debug.mjs';

class Hourly extends WeatherDisplay {
	constructor(navId, elemId, defaultActive) {
		// special height and width for scrolling
		super(navId, elemId, 'Hourly Forecast', defaultActive);

		// cache for scroll calculations
		// This cache is essential because baseCountChange() is called 25 times per second (every 40ms)
		// during scrolling. Without caching, we'd perform hundreds of expensive DOM layout queries during
		// the full scroll cycle. The cache reduces this to one calculation when content changes, then
		// reuses cached values to try and get smoother scrolling.
		this.scrollCache = {
			displayHeight: 0,
			contentHeight: 0,
			maxOffset: 0,
			hourlyLines: null,
		};
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

	async drawLongCanvas() {
		// get the list element and populate
		const list = this.elem.querySelector('.hourly-lines');
		list.innerHTML = '';

		const startingHour = DateTime.local().setZone(timeZone());

		// shorten to 24 hours
		const shortData = this.data.slice(0, 24);

		const lines = shortData.map((data, index) => {
			const fillValues = {};
			// hour
			const hour = startingHour.plus({ hours: index });
			fillValues.hour = hour.toLocaleString({ weekday: 'short', hour: 'numeric' });

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
				fillValues.wind = data.windDirection + (Array(6 - data.windDirection.length - windSpeed.length).join(' ')) + windSpeed;
			}

			// image
			fillValues.icon = { type: 'img', src: data.icon };

			const filledRow = this.fillTemplate('hourly-row', fillValues);

			// alter the color of the feels like column to reflect wind chill or heat index
			if (data.apparentTemperature < data.temperature) {
				filledRow.querySelector('.like').classList.add('wind-chill');
			} else if (feelsLike > temperature) {
				filledRow.querySelector('.like').classList.add('heat-index');
			}

			return filledRow;
		});

		list.append(...lines);

		// update timing based on actual content
		this.setTiming(list);
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
		// get the hourly lines element and cache measurements if needed
		const hourlyLines = this.elem.querySelector('.hourly-lines');
		if (!hourlyLines) return;

		// update cache if needed (when content changes or first run)
		if (this.scrollCache.hourlyLines !== hourlyLines || this.scrollCache.displayHeight === 0) {
			this.scrollCache.displayHeight = this.elem.querySelector('.main').offsetHeight;
			this.scrollCache.contentHeight = hourlyLines.offsetHeight;
			this.scrollCache.maxOffset = Math.max(0, this.scrollCache.contentHeight - this.scrollCache.displayHeight);
			this.scrollCache.hourlyLines = hourlyLines;

			// Set up hardware acceleration on the hourly lines element
			hourlyLines.style.willChange = 'transform';
			hourlyLines.style.backfaceVisibility = 'hidden';
		}

		// calculate scroll offset and don't go past end
		let offsetY = Math.min(this.scrollCache.maxOffset, (count - this.scrollTiming.initialCounts) * this.scrollTiming.pixelsPerCount);

		// don't let offset go negative
		if (offsetY < 0) offsetY = 0;

		// use transform instead of scrollTo for hardware acceleration
		hourlyLines.style.transform = `translateY(-${Math.round(offsetY)}px)`;
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

	setTiming(list) {
		const container = this.elem.querySelector('.main');
		const timingConfig = calculateScrollTiming(list, container);

		// Apply the calculated timing
		this.timing.baseDelay = timingConfig.baseDelay;
		this.timing.delay = timingConfig.delay;
		this.scrollTiming = timingConfig.scrollTiming;

		this.calcNavTiming();
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
	const iceAccumulation = expand(data.iceAccumulation.values); 	// ice icon
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
const expand = (data, maxHours = 36) => {
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

export default display.getHourlyData.bind(display);

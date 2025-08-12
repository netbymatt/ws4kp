// display extended forecast graphically
// (technically this uses the same data as the local forecast, but we'll let the cache deal with that)

import STATUS from './status.mjs';
import { safeJson } from './utils/fetch.mjs';
import { DateTime } from '../vendor/auto/luxon.mjs';
import { getLargeIcon } from './icons.mjs';
import { preloadImg } from './utils/image.mjs';
import WeatherDisplay from './weatherdisplay.mjs';
import { registerDisplay } from './navigation.mjs';
import settings from './settings.mjs';
import filterExpiredPeriods from './utils/forecast-utils.mjs';
import { debugFlag } from './utils/debug.mjs';

class ExtendedForecast extends WeatherDisplay {
	constructor(navId, elemId) {
		super(navId, elemId, 'Extended Forecast', true);

		// set timings
		this.timing.totalScreens = 2;
	}

	async getData(weatherParameters, refresh) {
		if (!super.getData(weatherParameters, refresh)) return;

		try {
			// request us or si units using centralized safe handling
			this.data = await safeJson(this.weatherParameters.forecast, {
				data: {
					units: settings.units.value,
				},
				retryCount: 3,
				stillWaiting: () => this.stillWaiting(),
			});

			// if there's no new data and no previous data, fail
			if (!this.data) {
				// console.warn(`Unable to get extended forecast for ${this.weatherParameters.latitude},${this.weatherParameters.longitude} in ${this.weatherParameters.state}`);
				if (this.isEnabled) this.setStatus(STATUS.failed);
				return;
			}

			// we only get here if there was data (new or existing)
			this.screenIndex = 0;
			this.setStatus(STATUS.loaded);
		} catch (error) {
			console.error(`Unexpected error getting Extended Forecast: ${error.message}`);
			if (this.isEnabled) this.setStatus(STATUS.failed);
		}
	}

	async drawCanvas() {
		super.drawCanvas();

		// determine bounds
		// grab the first three or second set of three array elements
		const forecast = parse(this.data.properties.periods, this.weatherParameters.forecast).slice(0 + 3 * this.screenIndex, 3 + this.screenIndex * 3);

		// create each day template
		const days = forecast.map((Day) => {
			const fill = {
				icon: { type: 'img', src: Day.icon },
				condition: Day.text,
				date: Day.dayName,
			};

			const { low, high } = Day;
			if (low !== undefined) {
				fill['value-lo'] = Math.round(low);
			}
			fill['value-hi'] = Math.round(high);

			// return the filled template
			return this.fillTemplate('day', fill);
		});

		// empty and update the container
		const dayContainer = this.elem.querySelector('.day-container');
		dayContainer.innerHTML = '';
		dayContainer.append(...days);
		this.finishDraw();
	}
}

// the api provides the forecast in 12 hour increments, flatten to day increments with high and low temperatures
const parse = (fullForecast, forecastUrl) => {
	// filter out expired periods first
	const activePeriods = filterExpiredPeriods(fullForecast, forecastUrl);

	if (debugFlag('extendedforecast')) {
		console.log('ExtendedForecast: First few active periods:');
		activePeriods.slice(0, 4).forEach((period, index) => {
			console.log(`  [${index}] ${period.name}: ${period.startTime} to ${period.endTime} (isDaytime: ${period.isDaytime})`);
		});
	}

	// Skip the first period if it's nighttime (like "Tonight") since extended forecast
	// should focus on upcoming full days, not the end of the current day
	let startIndex = 0;
	let dateOffset = 0; // offset for date labels when we skip periods

	if (activePeriods.length > 0 && !activePeriods[0].isDaytime) {
		startIndex = 1;
		dateOffset = 1; // start date labels from tomorrow since we're skipping tonight
		if (debugFlag('extendedforecast')) {
			console.log(`ExtendedForecast: Skipping first period "${activePeriods[0].name}" because it's nighttime`);
		}
	} else if (activePeriods.length > 0) {
		if (debugFlag('extendedforecast')) {
			console.log(`ExtendedForecast: Starting with first period "${activePeriods[0].name}" because it's daytime`);
		}
	}

	// create a list of days starting with the appropriate day
	const Days = [0, 1, 2, 3, 4, 5, 6];
	const dates = Days.map((shift) => {
		const date = DateTime.local().startOf('day').plus({ days: shift + dateOffset });
		return date.toLocaleString({ weekday: 'short' });
	});

	if (debugFlag('extendedforecast')) {
		console.log(`ExtendedForecast: Generated date labels: [${dates.join(', ')}]`);
	}

	// track the destination forecast index
	let destIndex = 0;
	const forecast = [];

	for (let i = startIndex; i < activePeriods.length; i += 1) {
		const period = activePeriods[i];

		// create the destination object if necessary
		if (!forecast[destIndex]) {
			forecast.push({
				dayName: '', low: undefined, high: undefined, text: undefined, icon: undefined,
			});
		}
		// get the object to modify/populate
		const fDay = forecast[destIndex];

		// preload the icon
		preloadImg(fDay.icon);

		if (period.isDaytime) {
			// day time is the high temperature
			fDay.high = period.temperature;
			fDay.icon = getLargeIcon(period.icon);
			fDay.text = shortenExtendedForecastText(period.shortForecast);
			fDay.dayName = dates[destIndex];
			// Wait for the corresponding night period to increment
		} else {
			// low temperature
			fDay.low = period.temperature;
			// Increment after processing night period
			destIndex += 1;
		}
	}

	if (debugFlag('extendedforecast')) {
		console.log('ExtendedForecast: Final forecast array:');
		forecast.forEach((day, index) => {
			console.log(`  [${index}] ${day.dayName}: High=${day.high}°, Low=${day.low}°, Text="${day.text}"`);
		});
	}

	return forecast;
};

const regexList = [
	[/ and /gi, ' '],
	[/slight /gi, ''],
	[/chance /gi, ''],
	[/very /gi, ''],
	[/patchy /gi, ''],
	[/Areas Of /gi, ''],
	[/areas /gi, ''],
	[/dense /gi, ''],
	[/Thunderstorm/g, 'T\'Storm'],
];
const shortenExtendedForecastText = (long) => {
	// run all regexes
	const short = regexList.reduce((working, [regex, replace]) => working.replace(regex, replace), long);

	let conditions = short.split(' ');
	if (short.indexOf('then') !== -1) {
		conditions = short.split(' then ');
		conditions = conditions[1].split(' ');
	}

	let short1 = conditions[0].substr(0, 10);
	let short2 = '';
	if (conditions[1]) {
		if (short1.endsWith('.')) {
			short1 = short1.replace(/\./, '');
		} else {
			short2 = conditions[1].substr(0, 10);
		}

		if (short2 === 'Blowing') {
			short2 = '';
		}
	}
	let result = short1;
	if (short2 !== '') {
		result += ` ${short2}`;
	}

	return result;
};

// register display
registerDisplay(new ExtendedForecast(8, 'extended-forecast'));

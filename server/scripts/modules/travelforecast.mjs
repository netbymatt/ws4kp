// travel forecast display
import STATUS from './status.mjs';
import { safeJson, safePromiseAll } from './utils/fetch.mjs';
import { getSmallIcon } from './icons.mjs';
import { DateTime } from '../vendor/auto/luxon.mjs';
import WeatherDisplay from './weatherdisplay.mjs';
import { registerDisplay } from './navigation.mjs';
import settings from './settings.mjs';
import calculateScrollTiming from './utils/scroll-timing.mjs';
import { debugFlag } from './utils/debug.mjs';

// A cheap, stable signature of the content about to be rendered. Only the fields that reach the DOM
// are included. Rows for cities whose forecast failed are dropped from the rendered list, so the row
// count - and therefore the rendered height - changes as individual cities come and go.
const contentSignature = (cities) => cities.map((city) => (city.error
	? `${city.name}|error`
	: `${city.name}|${city.high}|${city.low}|${city.icon}`)).join('\u0000');

class TravelForecast extends WeatherDisplay {
	constructor(navId, elemId, defaultActive) {
		// special height and width for scrolling
		super(navId, elemId, 'Travel Forecast', defaultActive);

		// add previous data cache
		this.previousData = [];

		// signature of the content currently rendered into the DOM, so a refresh that returns
		// identical cities can skip the rebuild entirely
		this.lastContentSignature = null;
	}

	async getData(weatherParameters, refresh) {
		// super checks for enabled
		if (!super.getData(weatherParameters, refresh)) return;

		// clear stored data if not refresh
		if (!refresh) {
			this.previousData = [];
		}

		const forecastPromises = TravelCities.map(async (city, index) => {
			try {
				// get point then forecast
				if (!city.point) throw new Error('No pre-loaded point');
				let forecast = await safeJson(`https://api.weather.gov/gridpoints/${city.point.wfo}/${city.point.x},${city.point.y}/forecast`, {
					data: {
						units: settings.units.value,
					},
				});

				if (forecast) {
					// store for the next run
					this.previousData[index] = forecast;
				} else if (this.previousData?.[index]) {
					// if there's previous data use it
					if (debugFlag('travelforecast')) {
						console.warn(`Using previous forecast data for ${city.Name} travel forecast`);
					}
					forecast = this.previousData?.[index];
				} else {
					// no current data and no previous data available
					if (debugFlag('verbose-failures')) {
						console.warn(`No travel forecast for ${city.Name} available`);
					}
					return { name: city.Name, error: true };
				}
				// determine today or tomorrow (shift periods by 1 if tomorrow)
				const todayShift = forecast.properties.periods[0].isDaytime ? 0 : 1;
				// return a pared-down forecast
				return {
					today: todayShift === 0,
					high: forecast.properties.periods[todayShift].temperature,
					low: forecast.properties.periods[todayShift + 1].temperature,
					name: city.Name,
					icon: getSmallIcon(forecast.properties.periods[todayShift].icon),
				};
			} catch (error) {
				console.error(`Unexpected error getting Travel Forecast for ${city.Name}: ${error.message}`);
				return { name: city.Name, error: true };
			}
		});

		// wait for all forecasts using centralized safe Promise handling
		const forecasts = await safePromiseAll(forecastPromises);
		this.data = forecasts;

		// test for some data available in at least one forecast
		const hasData = this.data.some((forecast) => !forecast.error);
		if (!hasData) {
			this.setStatus(STATUS.noData);
			return;
		}

		this.setStatus(STATUS.loaded);
		this.drawLongCanvas();
	}

	async drawLongCanvas() {
		// get the element and populate
		const list = this.elem.querySelector('.travel-lines');

		// set up variables
		const cities = this.data;

		// if the content is identical to what is already rendered, leave the DOM and the scroll
		// position alone rather than rebuilding and restarting an in-progress scroll
		const signature = contentSignature(cities);
		if (signature === this.lastContentSignature && list.children.length > 0) return;
		this.lastContentSignature = signature;

		list.innerHTML = '';

		const lines = cities.map((city) => {
			if (city.error) return false;
			const fillValues = {};

			// fill forecast data
			fillValues.city = city.name;
			// get temperatures and convert if necessary
			const { low, high } = city;

			// convert to strings with no decimal
			const lowString = Math.round(low).toString();
			const highString = Math.round(high).toString();

			fillValues.low = lowString;
			fillValues.high = highString;
			const { icon } = city;

			fillValues.icon = { type: 'img', src: icon };

			return this.fillTemplate('travel-row', fillValues);
		}).filter((d) => d);
		list.append(...lines);

		// new content scrolls from the top
		this.navBaseCount = 0;

		// update timing based on actual content
		this.setTiming(list);
	}

	async drawCanvas() {
		// there are technically 2 canvases: the standard canvas and the extra-long canvas that contains the complete
		// list of cities. The second canvas is copied into the standard canvas to create the scroll
		super.drawCanvas();

		// set up variables
		const cities = this.data;
		const dayName = getTravelCitiesDayName(cities);
		this.elem.querySelector('.header .title.dual .bottom').innerHTML = `For ${dayName}`;

		this.finishDraw();
	}

	async showCanvas() {
		// special to travel forecast to draw the remainder of the canvas
		await this.drawCanvas();
		super.showCanvas();
	}

	// screen index change callback just runs the base count callback
	screenIndexChange() {
		this.baseCountChange(this.navBaseCount);
	}

	// base count change callback
	baseCountChange(count) {
		// get the travel lines element
		const travelLines = this.elem.querySelector('.travel-lines');
		if (!travelLines) return;

		const offsetY = Math.max(0, Math.min(
			this.scrollTiming.maxOffset,
			(count - this.scrollTiming.initialCounts) * this.scrollTiming.pixelsPerCount,
		));

		// use transform instead of scrollTo for hardware acceleration
		travelLines.style.transform = `translateY(-${Math.round(offsetY)}px)`;
	}

	setTiming(list) {
		const container = this.elem.querySelector('.main');
		const timingConfig = calculateScrollTiming(list, container, {
			staticDisplay: 5.0, // special static display time for travel forecast
		});

		// Apply the calculated timing
		this.timing.baseDelay = timingConfig.baseDelay;
		this.timing.delay = timingConfig.delay;
		this.scrollTiming = timingConfig.scrollTiming;

		this.calcNavTiming();
	}
}

// returns early on the first found date
const getTravelCitiesDayName = (cities) => {
	const firstCity = cities.find((city) => city && !city.error);
	if (firstCity) {
		// today or tomorrow
		const day = DateTime.local().plus({ days: (firstCity.today) ? 0 : 1 });
		// return the day
		return day.toLocaleString({ weekday: 'long' });
	}

	return '';
};

// register display, not active by default
registerDisplay(new TravelForecast(5, 'travel', false));

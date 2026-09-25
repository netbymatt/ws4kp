// travel forecast display
import STATUS from './status.mjs';
import { safeJson, safePromiseAll } from './utils/fetch.mjs';
import smallIcon from './icons/small.mjs';
import { DateTime } from '../vendor/auto/luxon.mjs';
import ScrollWeatherDisplay from './scroll-weather-display.mjs';
import { registerDisplay } from './navigation.mjs';
import settings from './settings.mjs';
import { debugFlag } from './utils/debug.mjs';
import { TravelCities } from './utils/data-loader.mjs';

// A cheap, stable signature of the content about to be rendered. Only the fields that reach the DOM
// are included. Rows for cities whose forecast failed are dropped from the rendered list, so the row
// count - and therefore the rendered height - changes as individual cities come and go.
const rowsSignature = (cities) => cities.map((city) => (city.error
	? `${city.name}|error`
	: `${city.name}|${city.high}|${city.low}|${city.icon}`)).join('\u0000');

class TravelForecast extends ScrollWeatherDisplay {
	constructor(navId, elemId, defaultActive) {
		// special height and width for scrolling
		super(navId, elemId, 'Travel Forecast', defaultActive, {
			linesSelector: '.travel-lines',
			scrollTiming: {
				staticDisplay: 5.0, // special static display time for travel forecast
			},
		});

		// add previous data cache
		this.previousData = [];
	}

	async getData(weatherParameters, refresh) {
		// super checks for enabled
		if (!super.getData(weatherParameters, refresh)) return;

		// clear stored data if not refresh
		if (!refresh) {
			this.previousData = [];
		}

		const forecastPromises = (await TravelCities).map(async (city, index) => {
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
					icon: smallIcon(forecast.properties.periods[todayShift].icon),
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

	scrollRows() {
		return this.data;
	}

	// eslint-disable-next-line class-methods-use-this
	contentSignature(cities) {
		return rowsSignature(cities);
	}

	buildRow(city) {
		// cities whose forecast failed are dropped from the rendered list
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
	}

	// the header carries the day the forecast is for
	drawScreenContent() {
		const dayName = getTravelCitiesDayName(this.data);
		this.elem.querySelector('.header .title.dual .bottom').innerHTML = `For ${dayName}`;
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

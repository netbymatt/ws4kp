// travel forecast display
import STATUS from './status.mjs';
import { json } from './utils/fetch.mjs';
import { getWeatherRegionalIconFromIconLink } from './icons.mjs';
import { DateTime } from '../vendor/auto/luxon.mjs';
import WeatherDisplay from './weatherdisplay.mjs';
import { registerDisplay } from './navigation.mjs';

class TravelForecast extends WeatherDisplay {
	constructor(navId, elemId, defaultActive) {
		// special height and width for scrolling
		super(navId, elemId, 'Travel Forecast', defaultActive);

		// set up the timing
		this.timing.baseDelay = 20;
		// page sizes are 4 cities, calculate the number of pages necessary plus overflow
		const pagesFloat = TravelCities.length / 4;
		const pages = Math.floor(pagesFloat) - 2; // first page is already displayed, last page doesn't happen
		const extra = pages % 1;
		const timingStep = 75 * 4;
		this.timing.delay = [150 + timingStep];
		// add additional pages
		for (let i = 0; i < pages; i += 1) this.timing.delay.push(timingStep);
		// add the extra (not exactly 4 pages portion)
		if (extra !== 0) this.timing.delay.push(Math.round(this.extra * this.cityHeight));
		// add the final 3 second delay
		this.timing.delay.push(150);
	}

	async getData() {
		// super checks for enabled
		if (!super.getData()) return;
		const forecastPromises = TravelCities.map(async (city) => {
			try {
				// get point then forecast
				if (!city.point) throw new Error('No pre-loaded point');
				const forecast = await json(`https://api.weather.gov/gridpoints/${city.point.wfo}/${city.point.x},${city.point.y}/forecast`);
				// determine today or tomorrow (shift periods by 1 if tomorrow)
				const todayShift = forecast.properties.periods[0].isDaytime ? 0 : 1;
				// return a pared-down forecast
				return {
					today: todayShift === 0,
					high: forecast.properties.periods[todayShift].temperature,
					low: forecast.properties.periods[todayShift + 1].temperature,
					name: city.Name,
					icon: getWeatherRegionalIconFromIconLink(forecast.properties.periods[todayShift].icon),
				};
			} catch (error) {
				console.error(`GetTravelWeather for ${city.Name} failed`);
				console.error(error.status, error.responseJSON);
				return { name: city.Name, error: true };
			}
		});

		// wait for all forecasts
		const forecasts = await Promise.all(forecastPromises);
		this.data = forecasts;

		// test for some data available in at least one forecast
		const hasData = this.data.some((forecast) => forecast.high);
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
		list.innerHTML = '';

		// set up variables
		const cities = this.data;

		const lines = cities.map((city) => {
			if (city.error) return false;
			const fillValues = {
				city,
			};

			// check for forecast data
			if (city.icon) {
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
			} else {
				fillValues.error = 'NO TRAVEL DATA AVAILABLE';
			}
			return this.fillTemplate('travel-row', fillValues);
		}).filter((d) => d);
		list.append(...lines);
	}

	async drawCanvas() {
		// there are technically 2 canvases: the standard canvas and the extra-long canvas that contains the complete
		// list of cities. The second canvas is copied into the standard canvas to create the scroll
		super.drawCanvas();

		// set up variables
		const cities = this.data;

		this.elem.querySelector('.header .title.dual .bottom').innerHTML = `For ${getTravelCitiesDayName(cities)}`;

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
		// calculate scroll offset and don't go past end
		let offsetY = Math.min(this.elem.querySelector('.travel-lines').offsetHeight - 289, (count - 150));

		// don't let offset go negative
		if (offsetY < 0) offsetY = 0;

		// copy the scrolled portion of the canvas
		this.elem.querySelector('.main').scrollTo(0, offsetY);
	}

	// necessary to get the lastest long canvas when scrolling
	getLongCanvas() {
		return this.longCanvas;
	}
}

// effectively returns early on the first found date
const getTravelCitiesDayName = (cities) => cities.reduce((dayName, city) => {
	if (city && dayName === '') {
		// today or tomorrow
		const day = DateTime.local().plus({ days: (city.today) ? 0 : 1 });
		// return the day
		return day.toLocaleString({ weekday: 'long' });
	}
	return dayName;
}, '');

// register display, not active by default
registerDisplay(new TravelForecast(5, 'travel', false));

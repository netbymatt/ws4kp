// regional forecast and observations
// type 0 = observations, 1 = first forecast, 2 = second forecast

import STATUS from './status.mjs';
import { distance as calcDistance } from './utils/calc.mjs';
import { safeJson, safePromiseAll } from './utils/fetch.mjs';
import { temperature as temperatureUnit } from './utils/units.mjs';
import { getSmallIcon } from './icons.mjs';
import { preloadImg } from './utils/image.mjs';
import { DateTime } from '../vendor/auto/luxon.mjs';
import WeatherDisplay from './weatherdisplay.mjs';
import { registerDisplay } from './navigation.mjs';
import * as utils from './regionalforecast-utils.mjs';
import { getPoint } from './utils/weather.mjs';
import { debugFlag } from './utils/debug.mjs';
import filterExpiredPeriods from './utils/forecast-utils.mjs';
import settings from './settings.mjs';

// set up spacing and scales
const scaling = () => {
	// available space
	const available = {
		x: 640,
		y: 282,
	};

	// map offset
	const mapOffsetXY = {
		x: 240,
		y: 117,
	};

	if (settings.enhanced?.value) {
		if (settings.wide?.value) {
			mapOffsetXY.x = 320;
			available.x = 854;
		}

		if (settings.portrait?.value) {
			mapOffsetXY.y = 400;
			available.y = 970;
		}
	}
	return {
		mapOffsetXY,
		available,
	};
};

// AABB overlap test algorithm
// x1 < x2, and y1 < y2 must be observed in input data
const boxOverlaps = (a, b) => {
	const separated = a.x2 < b.x1 // a is left of b
		|| a.x1 > b.x2 // a is right of b
		|| a.y2 < b.y1 // a is above b
		|| a.y1 > b.y2; // a is below b
	return !separated;
};

// helper function to create city "boxes", factor is used to increase the size of the box (used with stations to de-emphasize them)
const makeCityBox = (city, factor = 1.0) => ({
	x1: city.xy.x,
	y1: city.xy.y,
	x2: city.xy.x + 105 * factor,
	y2: city.xy.y + 50 * factor,
});

const cityLatLonBoundingBox = (city, minMaxLatLon) => (
	city.lat > minMaxLatLon.minLat
	&& city.lat < minMaxLatLon.maxLat
	&& city.lon > minMaxLatLon.minLon
	&& city.lon < minMaxLatLon.maxLon
);

class RegionalForecast extends WeatherDisplay {
	constructor(navId, elemId) {
		super(navId, elemId, 'Regional Forecast', true);

		// timings
		this.timing.totalScreens = 3;
	}

	async getData(weatherParameters, refresh) {
		if (!super.getData(weatherParameters, refresh)) return;
		// regional forecast implements a silent reload
		// but it will not fall back to previously loaded data if data can not be loaded
		// there are enough other cities available to populate the map sufficiently even if some do not load

		// pre-load the base map
		let baseMap = 'images/maps/basemap.webp';
		if (weatherParameters.state === 'HI') {
			baseMap = 'images/maps/radar-hawaii.png';
		} else if (weatherParameters.state === 'AK') {
			baseMap = 'images/maps/radar-alaska.png';
		}
		this.elem.querySelector('.map img').src = baseMap;

		// get user's location in x/y
		const { available, mapOffsetXY } = scaling();
		const sourceXY = utils.getXYFromLatitudeLongitude(this.weatherParameters.latitude, this.weatherParameters.longitude, mapOffsetXY.x, mapOffsetXY.y, weatherParameters.state);

		// get latitude and longitude limits
		const minMaxLatLon = utils.getMinMaxLatitudeLongitude(sourceXY.x, sourceXY.y, mapOffsetXY.x, mapOffsetXY.y, this.weatherParameters.state);

		const regionalCitiesNearby = RegionalCities.filter((city) => cityLatLonBoundingBox(city, minMaxLatLon));

		const regionalCitiesDistance = regionalCitiesNearby.map((city) => {
			const xy = utils.getXYForCity(city, minMaxLatLon.maxLat, minMaxLatLon.minLon, this.weatherParameters.state, available.x - 60, available.y);
			if (!xy) return undefined;
			return {
				...city,
				distance: calcDistance(city.lon, city.lat, this.weatherParameters.longitude, this.weatherParameters.latitude),
				xy,
			};
		}).filter((d) => d);

		const sortedRegionalCities = regionalCitiesDistance.sort((a, b) => a.distance - b.distance);

		const regionalCities = [];

		// Determine which cities do not overlap each other, starting with the closest city
		sortedRegionalCities.forEach((city) => {
			const cityBox = makeCityBox(city);
			const overlaps = regionalCities.reduce((prev, cur) => prev || boxOverlaps(cityBox, cur.box), false);
			if (!overlaps) {
				regionalCities.push({
					...city,
					box: cityBox,
				});
			}
		});

		// now do the same for the list of stations (back fills empty areas on the map)
		const stationsNearby = Object.values(StationInfo).filter((city) => cityLatLonBoundingBox(city, minMaxLatLon));

		const stationsDistance = stationsNearby.map((city) => {
			const xy = utils.getXYForCity(city, minMaxLatLon.maxLat, minMaxLatLon.minLon, this.weatherParameters.state, available.x - 60, available.y);
			if (!xy) return undefined;
			return {
				...city,
				distance: calcDistance(city.lon, city.lat, this.weatherParameters.longitude, this.weatherParameters.latitude),
				xy,
			};
		}).filter((d) => d);
		const sortedStations = stationsDistance.sort((a, b) => a.distance - b.distance);

		// Determine which stations do not overlap each other, starting with the closest city
		sortedStations.forEach((city) => {
			const cityBox = makeCityBox(city, 1.7);
			const overlaps = regionalCities.reduce((prev, cur) => prev || boxOverlaps(cityBox, cur.box), false);
			if (!overlaps) {
				regionalCities.push({
					...city,
					box: cityBox,
				});
			}
		});

		// get a unit converter
		const temperatureConverter = temperatureUnit();

		// get regional forecasts and observations using centralized safe Promise handling
		const regionalDataAll = await safePromiseAll(regionalCities.map(async (city) => {
			try {
				const point = city?.point ?? (await getAndFormatPoint(city.lat, city.lon));
				if (!point) {
					if (debugFlag('verbose-failures')) {
						console.warn(`Unable to get Points for '${city.Name ?? city.city}'`);
					}
					return false;
				}

				// start off the observation task
				const observationPromise = utils.getRegionalObservation(point, city);

				const forecast = await safeJson(`https://api.weather.gov/gridpoints/${point.wfo}/${point.x},${point.y}/forecast`);
				if (!forecast) {
					if (debugFlag('verbose-failures')) {
						console.warn(`Regional Forecast request for ${city.Name ?? city.city} failed`);
					}
					return false;
				}

				// wait for the regional observation if it's not done yet
				const observation = await observationPromise;

				if (!observation) return false;

				// format the observation the same as the forecast
				const regionalObservation = {
					daytime: !!/\/day\//.test(observation.icon),
					temperature: temperatureConverter(observation.temperature.value),
					name: utils.formatCity(city.city),
					icon: observation.icon,
					x: city.xy.x,
					y: city.xy.y,
				};

				// preload the icon
				preloadImg(getSmallIcon(regionalObservation.icon, !regionalObservation.daytime));

				// filter out expired periods first, then use the next two periods for forecast
				const activePeriods = filterExpiredPeriods(forecast.properties.periods);

				// ensure we have enough periods for forecast
				if (activePeriods.length < 3) {
					console.warn(`Insufficient active periods for ${city.Name ?? city.city}: only ${activePeriods.length} periods available`);
					return false;
				}

				// group together the current observation and next two periods
				return [
					regionalObservation,
					utils.buildForecast(activePeriods[1], city, city.xy),
					utils.buildForecast(activePeriods[2], city, city.xy),
				];
			} catch (error) {
				console.error(`Unexpected error getting Regional Forecast data for '${city.name ?? city.city}': ${error.message}`);
				return false;
			}
		}));

		// filter out any false (unavailable data)
		const regionalData = regionalDataAll.filter((data) => data);

		// test for data present
		if (regionalData.length === 0) {
			this.setStatus(STATUS.noData);
			return;
		}

		// return the weather data and offsets
		this.data = {
			regionalData,
			mapOffsetXY,
			sourceXY,
		};

		this.setStatus(STATUS.loaded);
	}

	drawCanvas() {
		super.drawCanvas();
		// break up data into useful values
		const { regionalData: data, sourceXY } = this.data;

		// draw the header graphics

		// draw the appropriate title
		const titleTop = this.elem.querySelector('.title.dual .top');
		const titleBottom = this.elem.querySelector('.title.dual .bottom');
		if (this.screenIndex === 0) {
			titleTop.innerHTML = 'Regional';
			titleBottom.innerHTML = 'Observations';
		} else {
			const forecastDate = DateTime.fromISO(data[0][this.screenIndex].time);

			// get the name of the day
			const dayName = forecastDate.toLocaleString({ weekday: 'long' });
			titleTop.innerHTML = 'Forecast for';
			// draw the title
			titleBottom.innerHTML = data[0][this.screenIndex].daytime
				? dayName
				: `${dayName} Night`;
		}

		// draw the map
		const { available, mapOffsetXY } = scaling();
		const scale = available.x / (mapOffsetXY.x * 2);
		const map = this.elem.querySelector('.map');
		map.style.transform = `scale(${scale}) translate(-${sourceXY.x}px, -${sourceXY.y}px)`;

		const cities = data.map((city) => {
			const fill = {};
			const period = city[this.screenIndex];

			fill.icon = { type: 'img', src: getSmallIcon(period.icon, !period.daytime) };
			fill.city = period.name;
			const { temperature } = period;
			fill.temp = temperature;

			const { x, y } = period;

			const elem = this.fillTemplate('location', fill);
			elem.style.left = `${x}px`;
			elem.style.top = `${y}px`;

			return elem;
		});

		const locationContainer = this.elem.querySelector('.location-container');
		locationContainer.innerHTML = '';
		locationContainer.append(...cities);

		this.finishDraw();
	}
}

const getAndFormatPoint = async (lat, lon) => {
	try {
		const point = await getPoint(lat, lon);
		if (!point) {
			return null;
		}
		const { gridX, gridY, gridId } = point.properties ?? {};
		// api.weather.gov returns 200 with gridId/gridX/gridY all null for offshore
		// marine stations (forecastOffice NH2), which have no land grid. Returning the
		// object anyway is truthy, so the caller's `if (!point)` check passes and the
		// request becomes gridpoints/null/null,null/forecast, which 404s. Treat a
		// missing grid the same as a missing point so the city is skipped.
		if (gridX === null || gridX === undefined
			|| gridY === null || gridY === undefined
			|| gridId === null || gridId === undefined) {
			return null;
		}
		return {
			x: gridX,
			y: gridY,
			wfo: gridId,
		};
	} catch (error) {
		throw new Error(`Unexpected error getting point for ${lat},${lon}: ${error.message}`);
	}
};

// register display
registerDisplay(new RegionalForecast(6, 'regional-forecast'));

// regional forecast and observations
// type 0 = observations, 1 = first forecast, 2 = second forecast

import STATUS from './status.mjs';
import { coerce, distance as calcDistance } from './utils/calc.mjs';
import { safeJson, safePromiseAll } from './utils/fetch.mjs';
import { temperature as temperatureUnit } from './utils/units.mjs';
import preloadImg from './utils/preload-image.mjs';
import { DateTime } from '../vendor/auto/luxon.mjs';
import WeatherDisplay from './weatherdisplay.mjs';
import { registerDisplay } from './navigation.mjs';
import getPoint from './utils/get-point.mjs';
import { debugFlag } from './utils/debug.mjs';
import filterExpiredPeriods from './utils/forecast-utils.mjs';
import settings from './settings.mjs';
import createProjection, { OUTPUTSIZES } from './utils/map-projection.mjs';
import { getRegionalObservation, formatCity, buildForecast } from './regionalforecast-utils.mjs';
import { RegionalCities, StationInfo } from './utils/data-loader.mjs';

// array indices for reference
const PX = 0;
const PY = 1;
const LAT = 1;
const LON = 0;

// draw a few less stations in portrait mode to be nice to the api
const PORTRAIT_ROW_PADDING = 26;

// set up spacing and scales
const scaling = (mapName) => {
	// available space
	const available = {
		width: 640,
		height: 282,
	};

	if (settings.enhanced?.value) {
		if (settings.wide?.value) {
			available.width = 854;
		}

		if (settings.portrait?.value) {
			available.height = 970;
		}
	}

	// create a projection for the associated map
	const projection = createProjection(mapName);

	// get the full size of the map
	const mapSize = OUTPUTSIZES[mapName];

	const boxPadY = (settings.enhanced?.value && settings.portrait?.value) ? PORTRAIT_ROW_PADDING : 0;

	return {
		available,
		projection,
		mapSize,
		boxPadY,
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

const CITYBOX = [
	136,
	60,
];

// calculate the box offset
const boxOffset = [
	// deliberate "fudge factor" in x to center more on number + icon instead of the longest possible city name
	CITYBOX[PX] / 2 - 25,
	CITYBOX[PY] / 2,
];

// helper function to create city "boxes", factor is used to increase the size of the box (used with stations to de-emphasize them)
const makeCityBox = (city, padY = 0) => ({
	x1: city.pxy[PX] - boxOffset[PX],
	y1: city.pxy[PY] - boxOffset[PY],
	// x2 is the max of 100 (max icon width) and the computed text width
	// note: icon is not measured deliberately as it could change cities displayed for the same user location as the conditions/forecast changes
	x2: city.pxy[PX] - boxOffset[PX] + Math.max(city.textWidth, 100),
	y2: city.pxy[PY] - boxOffset[PY] + CITYBOX[PY] + padY,
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

		// set while a change of display mode is choosing and loading a new set of cities, it
		// leaves the map empty instead of showing the previous selection
		this.reloadingForMode = false;
	}

	async getData(weatherParameters, refresh) {
		if (!super.getData(weatherParameters, refresh)) return;
		// regional forecast implements a silent reload
		// but it will not fall back to previously loaded data if data can not be loaded
		// there are enough other cities available to populate the map sufficiently even if some do not load

		// pre-load the base map
		let baseMap = 'images/maps/forecast-conus.webp';
		if (weatherParameters.state === 'HI') {
			baseMap = 'images/maps/radar-hawaii.png';
		} else if (weatherParameters.state === 'AK') {
			baseMap = 'images/maps/radar-alaska.png';
		}
		this.elem.querySelector('.map img').src = baseMap;

		// get user's location in x/y
		this.layout = this.calcLayout();
		const {
			user, projection, available, boxPadY,
		} = this.layout;

		const minLatLon = projection.inverse([
			user[PX] - (available.width / 2),
			user[PY] + (available.height / 2),
		]);
		const maxLatLon = projection.inverse([
			user[PX] + (available.width / 2),
			user[PY] - (available.height / 2),
		]);
		// regional cities can be coerced into the available area slightly
		const minMaxLatLonRegional = {
			minLat: minLatLon[LAT],
			maxLat: maxLatLon[LAT],
			minLon: minLatLon[LON],
			maxLon: maxLatLon[LON],
		};

		// stations must fit within the exact area
		const MAX_TEXT_WIDTH = 12 * 10; // formatCity caps names at 12 chars, 10px each
		const minLatLonStation = projection.inverse([
			user[PX] - (available.width / 2) + boxOffset[PX],
			user[PY] + (available.height / 2) - (CITYBOX[PY] - boxOffset[PY]),
		]);
		const maxLatLonStation = projection.inverse([
			user[PX] + (available.width / 2) - (MAX_TEXT_WIDTH - boxOffset[PX]),
			user[PY] - (available.height / 2) + boxOffset[PY],
		]);
		const minMaxLatLonStations = {
			minLat: minLatLonStation[LAT],
			maxLat: maxLatLonStation[LAT],
			minLon: minLatLonStation[LON],
			maxLon: maxLatLonStation[LON],
		};

		const regionalCitiesNearby = (await RegionalCities).filter((city) => cityLatLonBoundingBox(city, minMaxLatLonRegional));

		// bring the cities within the actual available space (left sloppy above to favor regional cities over stations)
		// and copy the city so we don't mutate the original RegionalCities array
		const regionalCitiesNearbyCoerced = regionalCitiesNearby.map((city) => {
			const lon = coerce(parseFloat(city.lon), minMaxLatLonStations.minLon, minMaxLatLonStations.maxLon);
			// were interested if a city is coerced at the right edge of the map
			// this creates an ugly column of stations and can be adjusted by right-aligning this station's box
			const coercedRight = parseFloat(city.lon) !== lon && Math.abs(lon - minMaxLatLonStations.maxLon) < 0.00001;
			return {
				...city,
				lat: coerce(parseFloat(city.lat), minMaxLatLonStations.minLat, minMaxLatLonStations.maxLat),
				lon,
				coercedRight,
			};
		});
		const regionalCitiesDistance = regionalCitiesNearbyCoerced.map((city) => calcDistPxyBBox(city, projection, user));

		const sortedRegionalCities = regionalCitiesDistance.sort((a, b) => a.distance - b.distance);

		const regionalCities = [];

		// Determine which cities do not overlap each other, starting with the closest city
		sortedRegionalCities.forEach((city) => {
			const cityBox = makeCityBox(city, boxPadY);
			const overlaps = regionalCities.some((test) => boxOverlaps(cityBox, test.box), false);
			if (!overlaps) {
				regionalCities.push({
					...city,
					box: cityBox,
				});
			}
		});

		// now do the same for the list of stations (back fills empty areas on the map)
		const stationsNearby = Object.values(await StationInfo).filter((city) => cityLatLonBoundingBox(city, minMaxLatLonStations));

		const stationsDistance = stationsNearby.map((city) => calcDistPxyBBox(city, projection, user));
		const sortedStations = stationsDistance.sort((a, b) => a.distance - b.distance);

		// Determine which stations do not overlap each other, starting with the closest city
		sortedStations.forEach((city) => {
			const cityBox = makeCityBox(city, boxPadY);
			const overlaps = regionalCities.some((test) => boxOverlaps(cityBox, test.box));
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
						console.warn(`Unable to get Points for '${city.city}'`);
					}
					return false;
				}

				// start off the observation task
				const observationPromise = getRegionalObservation(city);

				const forecast = await safeJson(`https://api.weather.gov/gridpoints/${point.wfo}/${point.x},${point.y}/forecast`, { retryCount: 1, timeout: 5000 });
				if (!forecast) {
					if (debugFlag('verbose-failures')) {
						console.warn(`Regional Forecast request for ${city.city} failed`);
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
					name: formatCity(city.city),
					icon: observation.ws4icon,
					x: city.pxy[PX],
					y: city.pxy[PY],
					coercedRight: city.coercedRight,
				};

				// preload the icon
				preloadImg(regionalObservation.icon);

				// filter out expired periods first, then use the next two periods for forecast
				const activePeriods = filterExpiredPeriods(forecast.properties.periods);

				// ensure we have enough periods for forecast
				if (activePeriods.length < 3) {
					console.warn(`Insufficient active periods for ${city.city}: only ${activePeriods.length} periods available`);
					return false;
				}

				// group together the current observation and next two periods
				return [
					regionalObservation,
					buildForecast(activePeriods[1], city),
					buildForecast(activePeriods[2], city),
				];
			} catch (error) {
				console.error(`Unexpected error getting Regional Forecast data for '${city.city}': ${error.message}`);
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

		// return the weather data
		// the offsets used to draw it come from this.layout, which is recalculated whenever the
		// display mode changes
		this.data = {
			regionalData,
		};

		this.setStatus(STATUS.loaded);
	}

	// arithmetic only: one projection build, a coerce and a subtraction.
	// called from getData() and from modeChanged(), never from drawCanvas()
	calcLayout() {
		const {
			available, mapSize, projection, boxPadY,
		} = scaling('forecast-conus');
		const user = projection.forward([this.weatherParameters.longitude, this.weatherParameters.latitude]);
		user[PX] = coerce(user[PX], available.width / 2, mapSize.width - (available.width / 2));
		user[PY] = coerce(user[PY], available.height / 2, mapSize.height - (available.height / 2));
		return {
			available,
			projection,
			boxPadY,
			user,
			offset: [user[PX] - (available.width / 2), user[PY] - (available.height / 2)],
		};
	}

	// the cities shown are chosen to fit the available space, so a change of display mode has to
	// pick them again. the map re-centres immediately and is left empty while the new selection
	// is chosen and loaded
	async modeChanged() {
		if (this.status !== STATUS.loaded) return;

		const previous = this.layout;
		this.layout = this.calcLayout();

		// widescreen only adds space when enhanced is also on, so a switch between standard and
		// widescreen leaves the available area, and the cities that fit in it, unchanged
		if (previous
			&& previous.available.width === this.layout.available.width
			&& previous.available.height === this.layout.available.height) return;

		// the cities that fit the new area have not been chosen yet, so empty the map rather than
		// leave the previous selection sitting in places that no longer match it. the map itself
		// re-centres right away, which is arithmetic only
		this.reloadingForMode = true;
		if (this.active) this.drawCanvas();

		// choose and load the cities for the new area through the normal data path
		try {
			await this.getData(this.weatherParameters, true);
		} finally {
			this.reloadingForMode = false;
		}
		if (this.active) this.drawCanvas();
	}

	drawCanvas() {
		super.drawCanvas();
		// break up data into useful values
		const { regionalData: data } = this.data;

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

		// calculate the overall offset (top/left corner)
		const { offset } = this.layout;

		// draw the map
		const map = this.elem.querySelector('.map');
		map.style.transform = `translate(-${offset[PX]}px, -${offset[PY]}px)`;

		// a change of display mode leaves the map empty until the new selection has loaded
		const cities = this.reloadingForMode ? [] : data.map((city) => {
			const fill = {};
			const period = city[this.screenIndex];

			fill.icon = { type: 'img', src: period.icon };
			fill.city = period.name;
			const { temperature } = period;
			fill.temp = temperature;

			const { x, y, coercedRight } = period;

			const elem = this.fillTemplate('location', fill);
			elem.style.top = `${y - offset[PY] - boxOffset[PY]}px`;
			// stations coerced on the right edge get placed at the right edge
			if (!coercedRight) {
				elem.style.left = `${x - offset[PX] - boxOffset[PX]}px`;
			} else {
				elem.style.right = 0;
			}

			if (coercedRight) {
				elem.classList.add('coerced-right');
			}

			return elem;
		});

		const locationContainer = this.elem.querySelector('.location-container');
		locationContainer.innerHTML = '';
		locationContainer.append(...cities);

		this.finishDraw();
	}
}

const calcDistPxyBBox = (city, projection, user) => {
	// pixel z and y locations
	const pxy = projection.forward([parseFloat(city.lon), parseFloat(city.lat)]);

	// render the city's text for bounding box calculation
	// Star4000 is a fixed width font
	// 973 units wide on a 2048 units-per-em grid
	// at font-size: 20px this is 973/2048x20 = 9.5 px/letter
	// rounded to 10px for some minor rendering consistencies across platforms
	const textWidth = formatCity(city.city).length * 10;

	return {
		...city,
		// calculate distance from user
		distance: calcDistance(user[PX], user[PY], pxy[PX], pxy[PY]),
		pxy,
		textWidth,
	};
};

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
		throw new Error(`Unexpected error getting point for ${lat}, ${lon}: ${error.message} `);
	}
};

// register display
registerDisplay(new RegionalForecast(6, 'regional-forecast'));

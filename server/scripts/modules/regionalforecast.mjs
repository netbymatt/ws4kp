// regional forecast and observations
// type 0 = observations, 1 = first forecast, 2 = second forecast

import STATUS from './status.mjs';
import { distance as calcDistance } from './utils/calc.mjs';
import { safeJson, safePromiseAll } from './utils/fetch.mjs';
import { temperature as temperatureUnit } from './utils/units.mjs';
import smallIcon from './icons/small.mjs';
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

// array indices for reference
const PX = 0;
const PY = 1;
const LAT = 1;
const LON = 0;

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
	const projection = createProjection(mapName, available);

	// get the full size of the map
	const mapSize = OUTPUTSIZES[mapName];

	return {
		available,
		projection,
		mapSize,
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

// helper function to create city "boxes", factor is used to increase the size of the box (used with stations to de-emphasize them)
const makeCityBox = (city) => ({
	x1: city.pxy[PX],
	y1: city.pxy[PY],
	// x2 is the max of 100 (max icon width) and the measured text width
	// note: icon is not measured deliberately as it could change cities displayed for the same user location as the conditions/forecast changes
	x2: city.pxy[PX] + Math.max(city.textWidth, 100),
	y2: city.pxy[PY] + CITYBOX[PY],
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

		// test rendering area
		this.renderTest = this.elem.querySelector('.render-test .city');

		// pre-load the base map
		let baseMap = 'images/maps/forecast-conus.webp';
		if (weatherParameters.state === 'HI') {
			baseMap = 'images/maps/radar-hawaii.png';
		} else if (weatherParameters.state === 'AK') {
			baseMap = 'images/maps/radar-alaska.png';
		}
		this.elem.querySelector('.map img').src = baseMap;

		// get user's location in x/y
		const { available, mapSize, projection } = scaling('forecast-conus');
		const user = projection.forward([this.weatherParameters.longitude, this.weatherParameters.latitude]);

		// adjust the user's location to not run off the map
		if (user[PX] < (available.width / 2)) {
			user[PX] = available.width / 2;
		}
		if (user[PX] > (mapSize.width - (available.width / 2))) {
			user[PX] = mapSize.width - (available.width / 2);
		}
		if (user[PY] < (available.height / 2)) {
			user[PY] = available.height / 2;
		}
		if (user[PY] > (mapSize.height - (available.height / 2))) {
			user[PY] = mapSize.height - (available.height / 2);
		}

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
		const minLatLonStation = projection.inverse([
			user[PX] - (available.width / 2) + CITYBOX[PX] / 1.5,
			user[PY] + (available.height / 2) - CITYBOX[PY] / 1.5,
		]);
		const maxLatLonStation = projection.inverse([
			user[PX] + (available.width / 2) - CITYBOX[PX] / 1.5,
			user[PY] - (available.height / 2) + CITYBOX[PY] / 1.5,
		]);
		const minMaxLatLonStations = {
			minLat: minLatLonStation[LAT],
			maxLat: maxLatLonStation[LAT],
			minLon: minLatLonStation[LON],
			maxLon: maxLatLonStation[LON],
		};

		const regionalCitiesNearby = RegionalCities.filter((city) => cityLatLonBoundingBox(city, minMaxLatLonRegional));

		// bring the cities within the actual available space (left sloppy above to favor regional cities over stations)
		const regionalCitiesNearbyCoerced = regionalCitiesNearby.map((city) => {
			if (parseFloat(city.lat) > minMaxLatLonStations.maxLat) city.lat = minMaxLatLonStations.maxLat;
			if (parseFloat(city.lat) < minMaxLatLonStations.minLat) city.lat = minMaxLatLonStations.minLat;
			if (parseFloat(city.lon) > minMaxLatLonStations.maxLon) city.lon = minMaxLatLonStations.maxLon;
			if (parseFloat(city.lon) < minMaxLatLonStations.minLon) city.lon = minMaxLatLonStations.minLon;
			return city;
		});

		const regionalCitiesDistance = regionalCitiesNearbyCoerced.map((city) => this.calcDistPxyBBox(city, projection, user)).filter((d) => d);

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
		const stationsNearby = Object.values(StationInfo).filter((city) => cityLatLonBoundingBox(city, minMaxLatLonStations));

		const stationsDistance = stationsNearby.map((city) => this.calcDistPxyBBox(city, projection, user)).filter((d) => d);
		const sortedStations = stationsDistance.sort((a, b) => a.distance - b.distance);

		// Determine which stations do not overlap each other, starting with the closest city
		sortedStations.forEach((city) => {
			const cityBox = makeCityBox(city);
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
				const observationPromise = getRegionalObservation(point, city);

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
					name: formatCity(city.city),
					icon: observation.icon,
					x: city.pxy[PX],
					y: city.pxy[PY],
				};

				// preload the icon
				preloadImg(smallIcon(regionalObservation.icon, !regionalObservation.daytime));

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
					buildForecast(activePeriods[1], city, city.pxy),
					buildForecast(activePeriods[2], city, city.pxy),
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
			user,
			available,
		};

		this.setStatus(STATUS.loaded);
	}

	calcDistPxyBBox(city, projection, user) {
		// pixel z and y locations
		const pxy = projection.forward([parseFloat(city.lon), parseFloat(city.lat)]);

		// render the city's text for bounding box calculation
		this.renderTest.innerHTML = city.city;
		const textWidth = this.renderTest.getBoundingClientRect().width;

		return {
			...city,
			// calculate distance from user
			distance: calcDistance(user[PX], user[PY], pxy[PX], pxy[PY]),
			pxy,
			textWidth,
		};
	}

	drawCanvas() {
		super.drawCanvas();
		// break up data into useful values
		const { regionalData: data, user, available } = this.data;

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
		const offset = [
			user[PX] - (available.width / 2),
			user[PY] - (available.height / 2),
		];

		// calculate the box offset
		const boxOffset = [
			// deliberate "fudge factor" in x to center more on number + icon instead of the longest possible city name
			CITYBOX[PX] / 2 - 25,
			CITYBOX[PY] / 2,
		];

		// draw the map
		const map = this.elem.querySelector('.map');
		map.style.transform = `translate(-${offset[PX]}px, -${offset[PY]}px)`;

		const cities = data.map((city) => {
			const fill = {};
			const period = city[this.screenIndex];

			fill.icon = { type: 'img', src: smallIcon(period.icon, !period.daytime) };
			fill.city = period.name;
			const { temperature } = period;
			fill.temp = temperature;

			const { x, y } = period;

			const elem = this.fillTemplate('location', fill);
			elem.style.left = `${x - offset[PX] - boxOffset[PX]}px`;
			elem.style.top = `${y - offset[PY] - boxOffset[PX]}px`;

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
		throw new Error(`Unexpected error getting point for ${lat}, ${lon}: ${error.message} `);
	}
};

// register display
registerDisplay(new RegionalForecast(6, 'regional-forecast'));

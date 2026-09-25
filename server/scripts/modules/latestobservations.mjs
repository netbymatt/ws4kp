// latest nearby observations display
import { distance as calcDistance, directionToNSEW } from './utils/calc.mjs';
import { safeJson, safePromiseAll } from './utils/fetch.mjs';
import STATUS from './status.mjs';
import { locationCleanup } from './utils/string.mjs';
import { temperature, windSpeed } from './utils/units.mjs';
import WeatherDisplay from './weatherdisplay.mjs';
import { registerDisplay } from './navigation.mjs';
import augmentObservationWithMetar from './utils/metar.mjs';
import settings from './settings.mjs';
import { debugFlag } from './utils/debug.mjs';
import { enhanceObservationWithMapClick } from './utils/mapclick.mjs';
import { StationInfo } from './utils/data-loader.mjs';

const MAX_REGIONAL_STATIONS = 7;

class LatestObservations extends WeatherDisplay {
	constructor(navId, elemId) {
		super(navId, elemId, 'Latest Observations', true);
	}

	async getData(weatherParameters, refresh) {
		if (!super.getData(weatherParameters, refresh)) return;
		// latest observations does a silent refresh but will not fall back to previously fetched data
		// this is intentional because up to 30 stations are available to pull data from

		// calculate distance to each station
		const stationsByDistance = Object.values(await StationInfo).map((station) => {
			const distance = calcDistance(station.lat, station.lon, this.weatherParameters.latitude, this.weatherParameters.longitude);
			return { ...station, distance };
		});

		// sort the stations by distance
		const sortedStations = stationsByDistance.sort((a, b) => a.distance - b.distance);

		// try up to 30 regional stations
		// store the stations to be processed by the recursive loop
		const queue = { stations: sortedStations.slice(0, 30), index: 0 };
		// helper to grab the next station in line
		// eslint-disable-next-line no-plusplus
		const nextStation = () => queue.stations[queue.index++];

		// get stations via the recurrent getStation function and the length of queue.stations
		const workerCount = Math.min(queue.stations.length, this.stationLimit());

		// run the loop (and filter out empty responses)
		const actualConditions = (await safePromiseAll(Array.from({ length: workerCount }).map(() => this.getStation(nextStation)))).filter((d) => d);

		// sort by distance is added in case a mid-station fails and a further one is inserted in its place
		this.data = actualConditions.sort((a, b) => a.distance - b.distance);

		// test for at least one station
		if (this.data.length === 0) {
			this.setStatus(STATUS.noData);
			return;
		}
		this.setStatus(STATUS.loaded);
	}

	// self recurring station data get function to ensure a call to it returns some data before the end-of-bound check
	async getStation(nextStation) {
		// see if there are any stations available
		const station = nextStation();
		if (!station) return false;
		// fire up a station worker
		const stationData = await this.getStationWorker(station);

		// if data was returned use this, otherwise recur
		if (stationData) return stationData;
		// recur (loop is ended when nextStation is exhausted with the length of regional stations)
		return this.getStation(nextStation);
	}

	// eslint-disable-next-line class-methods-use-this
	stationLimit() {
		return MAX_REGIONAL_STATIONS * (settings.portrait?.value ? 2 : 1);
	}

	async modeChanged() {
		// get additional data if needed for the mode change
		if (this.status === STATUS.loaded && this.data.length < this.stationLimit()) await this.getData(this.weatherParameters, true);
		// draw a second time to side-step the potential race condition beteween loading data and the higher-level call to
		// drawCanvas
		if (this.active) this.drawCanvas();
	}

	// This is a class method because it needs access to the instance's `stillWaiting` method
	async getStationWorker(station) {
		try {
			const data = await safeJson(`https://api.weather.gov/stations/${station.id}/observations/latest`, {
				retryCount: 0, // there are other stations in the list that can take this place
				stillWaiting: () => this.stillWaiting(),
			});

			if (!data) {
				if (debugFlag('verbose-failures')) {
					console.log(`Failed to get Latest Observations for station ${station.id}`);
				}
				return false;
			}

			// Enhance observation data with METAR parsing for missing fields
			const originalData = { ...data.properties };
			data.properties = augmentObservationWithMetar(data.properties);

			const augmentedData = data.properties;
			const metarReplacements = metarFields.filter((field) => field.check(originalData, augmentedData)).map((field) => field.name);
			if (debugFlag('latestobservations') && metarReplacements.length > 0) {
				console.log(`Latest Observations for station ${station.id} were augmented with METAR data for ${metarReplacements.join(', ')}`);
			}

			// Use enhanced observation with MapClick fallback
			const enhancedResult = await enhanceObservationWithMapClick(data.properties, {
				requiredFields,
				stationId: station.id,
				stillWaiting: () => this.stillWaiting(),
				debugContext: 'latestobservations',
			});

			data.properties = enhancedResult.data;
			const { missingRequired, missingOptional } = enhancedResult;

			// Check final data quality
			if ((missingRequired.length + missingOptional.length) > 0) {
				if (debugFlag('latestobservations')) {
					console.log(`Latest Observations for station ${station.id} is missing fields: ${[...missingRequired, ...missingOptional].join(', ')}`);
				}
				return false;
			}

			// format the return values
			return {
				...data.properties,
				StationId: station.id,
				city: station.city,
				distance: station.distance,
			};
		} catch (error) {
			console.error(`Unexpected error getting latest observations for station ${station.id}: ${error.message}`);
			return false;
		}
	}

	async drawCanvas() {
		super.drawCanvas();
		const conditions = this.data;

		if (settings.units.value === 'us') {
			this.elem.querySelector('.column-headers .temp.english').classList.add('show');
			this.elem.querySelector('.column-headers .temp.metric').classList.remove('show');
		} else {
			this.elem.querySelector('.column-headers .temp.english').classList.remove('show');
			this.elem.querySelector('.column-headers .temp.metric').classList.add('show');
		}
		// get unit converters
		const windConverter = windSpeed();
		const temperatureConverter = temperature();

		// shorten conditions to number to display based on portrait/landscape orientation

		const lines = conditions.slice(0, this.stationLimit()).map((condition) => {
			const windDirection = directionToNSEW(condition.windDirection.value);

			const Temperature = temperatureConverter(condition.temperature.value);
			const Like = likeTemperature(condition.heatIndex?.value, condition.windChill?.value, Temperature, temperatureConverter);
			const WindSpeed = windConverter(condition.windSpeed.value);

			const locationLimit = (settings.wide?.value && settings.enhanced?.value) ? 20 : 14;
			const weatherLimit = (settings.wide?.value && settings.enhanced?.value) ? 10 : 9;

			const fill = {
				location: locationCleanup(condition.city).substring(0, locationLimit),
				temp: Temperature,
				like: Like.value,
				weather: shortenCurrentConditions(condition.textDescription).substring(0, weatherLimit),
			};

			if (WindSpeed > 0) {
				fill.wind = windDirection.padEnd(3, ' ') + WindSpeed.toString().padStart(2, ' ');
			} else if (WindSpeed === '-') {
				fill.wind = 'NA';
			} else {
				fill.wind = 'Calm';
			}

			const filledRow = this.fillTemplate('observation-row', fill);

			// add the feels like class
			if (Like.cssClass) filledRow.querySelector('.like').classList.add(Like.cssClass);

			return filledRow;
		});

		const linesContainer = this.elem.querySelector('.observation-lines');
		linesContainer.innerHTML = '';
		linesContainer.append(...lines);

		this.finishDraw();
	}
}

// generate a "feels like" temperature from heat index and wind chill.
const likeTemperature = (heat, wind, actual, converter) => {
	// figure out the feels like value
	// wind chill wins, not that both can happen at the same time
	let value = '';
	if (wind !== null && wind !== undefined) {
		value = converter(wind);
	} else if (heat !== null && heat !== undefined) {
		value = converter(heat);
	}

	// determine if there's a red/blue color class to add
	let cssClass;
	if (value !== '') {
		if (value > actual) cssClass = 'heat-index';
		if (value < actual) cssClass = 'wind-chill';
	}
	return {
		value,
		cssClass,
	};
};

// test data quality
const requiredFields = [
	{ name: 'temperature', check: (props) => props.temperature?.value === null },
	{ name: 'windSpeed', check: (props) => props.windSpeed?.value === null },
	{ name: 'windDirection', check: (props) => props.windDirection?.value === null },
	{ name: 'textDescription', check: (props) => props.textDescription === null || props.textDescription === '' },
];
const metarFields = [
	{ name: 'temperature', check: (orig, metar) => orig.temperature.value === null && metar.temperature.value !== null },
	{ name: 'windSpeed', check: (orig, metar) => orig.windSpeed.value === null && metar.windSpeed.value !== null },
	{ name: 'windDirection', check: (orig, metar) => orig.windDirection.value === null && metar.windDirection.value !== null },
];

const shortenCurrentConditions = (_condition) => {
	let condition = _condition;
	condition = condition.replace(/Light/g, 'L');
	condition = condition.replace(/Heavy/g, 'H');
	condition = condition.replace(/Partly/g, 'P');
	condition = condition.replace(/Mostly/g, 'M');
	condition = condition.replace(/Few/g, 'F');
	condition = condition.replace(/Thunderstorm/g, 'T\'storm');
	condition = condition.replace(/ in /g, '');
	condition = condition.replace(/Vicinity/g, '');
	condition = condition.replace(/ and /g, ' ');
	condition = condition.replace(/Freezing Rain/g, 'Frz Rn');
	condition = condition.replace(/Freezing/g, 'Frz');
	condition = condition.replace(/Unknown Precip/g, '');
	condition = condition.replace(/L Snow Fog/g, 'L Snw/Fog');
	condition = condition.replace(/ with /g, '/');
	return condition;
};
// register display
registerDisplay(new LatestObservations(2, 'latest-observations'));

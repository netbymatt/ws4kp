// current weather conditions display
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

class LatestObservations extends WeatherDisplay {
	constructor(navId, elemId) {
		super(navId, elemId, 'Latest Observations', true);

		// constants
		this.MaximumRegionalStations = 7;
	}

	async getData(weatherParameters, refresh) {
		if (!super.getData(weatherParameters, refresh)) return;
		// latest observations does a silent refresh but will not fall back to previously fetched data
		// this is intentional because up to 30 stations are available to pull data from

		// calculate distance to each station
		const stationsByDistance = Object.values(StationInfo).map((station) => {
			const distance = calcDistance(station.lat, station.lon, this.weatherParameters.latitude, this.weatherParameters.longitude);
			return { ...station, distance };
		});

		// sort the stations by distance
		const sortedStations = stationsByDistance.sort((a, b) => a.distance - b.distance);
		// try up to 30 regional stations
		const regionalStations = sortedStations.slice(0, 30);

		// Fetch stations sequentially in batches to avoid unnecessary API calls.
		// We start with the 7 closest stations and only fetch more if some fail,
		// stopping as soon as we have 7 valid stations with data.
		const actualConditions = [];
		let lastStation = Math.min(regionalStations.length, 7);
		let firstStation = 0;
		while (actualConditions.length < 7 && (lastStation) <= regionalStations.length) {
			// Sequential fetching is intentional here - we want to try closest stations first
			// and only fetch additional batches if needed, rather than hitting all 30 stations at once
			// eslint-disable-next-line no-await-in-loop
			const someStations = await this.getStations(regionalStations.slice(firstStation, lastStation));

			actualConditions.push(...someStations);
			// update counters
			firstStation += lastStation;
			lastStation = Math.min(regionalStations.length + 1, firstStation + 7 - actualConditions.length);
		}

		// cut down to the maximum of 7
		this.data = actualConditions.slice(0, this.MaximumRegionalStations);

		// test for at least one station
		if (this.data.length === 0) {
			this.setStatus(STATUS.noData);
			return;
		}
		this.setStatus(STATUS.loaded);
	}

	// This is a class method because it needs access to the instance's `stillWaiting` method
	async getStations(stations) {
		// Use centralized safe Promise handling to avoid unhandled AbortError rejections
		const stationData = await safePromiseAll(stations.map(async (station) => {
			try {
				const data = await safeJson(`https://api.weather.gov/stations/${station.id}/observations/latest`, {
					retryCount: 1,
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
				const metarFields = [
					{ name: 'temperature', check: (orig, metar) => orig.temperature.value === null && metar.temperature.value !== null },
					{ name: 'windSpeed', check: (orig, metar) => orig.windSpeed.value === null && metar.windSpeed.value !== null },
					{ name: 'windDirection', check: (orig, metar) => orig.windDirection.value === null && metar.windDirection.value !== null },
				];
				const augmentedData = data.properties;
				const metarReplacements = metarFields.filter((field) => field.check(originalData, augmentedData)).map((field) => field.name);
				if (debugFlag('latestobservations') && metarReplacements.length > 0) {
					console.log(`Latest Observations for station ${station.id} were augmented with METAR data for ${metarReplacements.join(', ')}`);
				}

				// test data quality
				const requiredFields = [
					{ name: 'temperature', check: (props) => props.temperature?.value === null },
					{ name: 'windSpeed', check: (props) => props.windSpeed?.value === null },
					{ name: 'windDirection', check: (props) => props.windDirection?.value === null },
					{ name: 'textDescription', check: (props) => props.textDescription === null || props.textDescription === '' },
				];

				// Use enhanced observation with MapClick fallback
				const enhancedResult = await enhanceObservationWithMapClick(data.properties, {
					requiredFields,
					stationId: station.id,
					stillWaiting: () => this.stillWaiting(),
					debugContext: 'latestobservations',
				});

				data.properties = enhancedResult.data;
				const { missingFields } = enhancedResult;

				// Check final data quality
				if (missingFields.length > 0) {
					if (debugFlag('latestobservations')) {
						console.log(`Latest Observations for station ${station.id} is missing fields: ${missingFields.join(', ')}`);
					}
					return false;
				}

				// format the return values
				return {
					...data.properties,
					StationId: station.id,
					city: station.city,
				};
			} catch (error) {
				console.error(`Unexpected error getting latest observations for station ${station.id}: ${error.message}`);
				return false;
			}
		}));
		// filter false (no data or other error)
		return stationData.filter((d) => d);
	}

	async drawCanvas() {
		super.drawCanvas();
		const conditions = this.data;

		// sort array by station name
		const sortedConditions = conditions.sort((a, b) => ((a.Name < b.Name) ? -1 : 1));

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

		const lines = sortedConditions.map((condition) => {
			const windDirection = directionToNSEW(condition.windDirection.value);

			const Temperature = temperatureConverter(condition.temperature.value);
			const WindSpeed = windConverter(condition.windSpeed.value);

			const fill = {
				location: locationCleanup(condition.city).substr(0, 14),
				temp: Temperature,
				weather: shortenCurrentConditions(condition.textDescription).substr(0, 9),
			};

			if (WindSpeed > 0) {
				fill.wind = windDirection + (Array(6 - windDirection.length - WindSpeed.toString().length).join(' ')) + WindSpeed.toString();
			} else if (WindSpeed === 'NA') {
				fill.wind = 'NA';
			} else {
				fill.wind = 'Calm';
			}

			return this.fillTemplate('observation-row', fill);
		});

		const linesContainer = this.elem.querySelector('.observation-lines');
		linesContainer.innerHTML = '';
		linesContainer.append(...lines);

		this.finishDraw();
	}
}

const shortenCurrentConditions = (_condition) => {
	let condition = _condition;
	condition = condition.replace(/Light/, 'L');
	condition = condition.replace(/Heavy/, 'H');
	condition = condition.replace(/Partly/, 'P');
	condition = condition.replace(/Mostly/, 'M');
	condition = condition.replace(/Few/, 'F');
	condition = condition.replace(/Thunderstorm/, 'T\'storm');
	condition = condition.replace(/ in /, '');
	condition = condition.replace(/Vicinity/, '');
	condition = condition.replace(/ and /, ' ');
	condition = condition.replace(/Freezing Rain/, 'Frz Rn');
	condition = condition.replace(/Freezing/, 'Frz');
	condition = condition.replace(/Unknown Precip/, '');
	condition = condition.replace(/L Snow Fog/, 'L Snw/Fog');
	condition = condition.replace(/ with /, '/');
	return condition;
};
// register display
registerDisplay(new LatestObservations(2, 'latest-observations'));

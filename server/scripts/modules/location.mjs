import { safeJson } from './utils/fetch.mjs';
import { lookupPoint } from './utils/get-point.mjs';
import { stationFilter } from './utils/string.mjs';
import setHeadend from './headend.mjs';
import { startDisplays } from './navigation.mjs';
import { StationInfo } from './utils/data-loader.mjs';

const weatherParameters = {};

// each lookup gets a number, so a slow earlier lookup can't overwrite a newer location
let weatherRequest = 0;
let retryTimeout = null;
// wait longer after each failure, then keep trying every 10 minutes
const RETRY_DELAYS = [60_000, 120_000, 300_000, 600_000];

// one message in two places: the loading screen (first load and kiosk)
// and under the location box (when an earlier forecast is still showing)
const setLocationStatus = (text = '') => {
	document.querySelectorAll('.location-status').forEach((elem) => {
		elem.textContent = text;
	});
};

const getWeather = async (latLon, haveDataCallback, attempt = 0) => {
	weatherRequest += 1;
	const request = weatherRequest;
	clearTimeout(retryTimeout);
	setLocationStatus();
	const isCurrent = () => request === weatherRequest;

	// temporary problems (NWS down or slow) are retried, so a kiosk recovers without a reload
	const retryLater = (reason) => {
		if (!isCurrent()) return;
		const delay = RETRY_DELAYS[Math.min(attempt, RETRY_DELAYS.length - 1)];
		const at = new Date(Date.now() + delay).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
		setLocationStatus(`${reason} Trying again at ${at}.`);
		retryTimeout = setTimeout(() => getWeather(latLon, haveDataCallback, attempt + 1), delay);
	};
	// permanent problems for this location are only reported
	const fail = (text) => {
		if (isCurrent()) setLocationStatus(text);
	};

	const { point, reason } = await lookupPoint(latLon.lat, latLon.lon);
	if (!isCurrent()) return;
	if (!point) {
		if (reason === 'outside') {
			fail('No National Weather Service forecast is available for this location. WeatherStar only covers the United States.');
		} else {
			retryLater('The National Weather Service isn\'t responding.');
		}
		return;
	}

	if (typeof haveDataCallback === 'function') haveDataCallback(point);

	try {
		const stations = await safeJson(point.properties.observationStations);
		if (!isCurrent()) return;

		if (!stations) {
			retryLater('Couldn\'t load nearby weather stations.');
			return;
		}

		const stationsFiltered = (stations.features ?? []).filter(stationFilter);
		if (stationsFiltered.length === 0) {
			fail('No weather stations report near this location. Try a nearby city.');
			return;
		}

		const StationId = stationsFiltered[0].properties.stationIdentifier;

		let { city } = point.properties.relativeLocation.properties;
		const { state } = point.properties.relativeLocation.properties;
		const stationInfo = await StationInfo;

		if (StationId in stationInfo) {
			city = stationInfo[StationId].city;
			[city] = city.split('/');
			city = city.replace(/\s+$/, '');
		}

		// populate the weather parameters
		weatherParameters.latitude = latLon.lat;
		weatherParameters.longitude = latLon.lon;
		weatherParameters.zoneId = point.properties.forecastZone.substr(-6);
		weatherParameters.radarId = point.properties.radarStation.substr(-3);
		weatherParameters.stationId = StationId;
		weatherParameters.weatherOffice = point.properties.cwa;
		weatherParameters.city = city;
		weatherParameters.state = state;
		weatherParameters.timeZone = point.properties.timeZone;
		weatherParameters.forecast = point.properties.forecast;
		weatherParameters.forecastGridData = point.properties.forecastGridData;
		weatherParameters.stations = stationsFiltered;
		weatherParameters.relativeLocation = point.properties.relativeLocation.properties;

		// update the main process for display purposes
		populateWeatherParameters(weatherParameters, point.properties);

		// reset the scroll
		window.dispatchEvent(new CustomEvent('current-weather-scroll', { detail: 'reload' }));

		// show progress and start loading every display
		await startDisplays(weatherParameters);
	} catch (error) {
		console.error(`Failed to get weather data: ${error.message}`);
		retryLater('Something went wrong loading this location.');
	}
};

const populateWeatherParameters = (params, point) => {
	setHeadend('location', `${params.city}, ${params.state}`);
	setHeadend('radar', params.radarId);
	setHeadend('zone', params.zoneId);
	setHeadend('office', point.cwa);
	setHeadend('grid', `${point.gridX},${point.gridY}`);
};

const latLonReceived = (data, haveDataCallback) => {
	getWeather(data, haveDataCallback);
};

const timeZone = () => weatherParameters.timeZone;

export {
	timeZone,
	latLonReceived,
};

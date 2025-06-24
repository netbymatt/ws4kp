// current weather conditions display
import STATUS from './status.mjs';
import { preloadImg } from './utils/image.mjs';
import { safeJson } from './utils/fetch.mjs';
import { directionToNSEW } from './utils/calc.mjs';
import { locationCleanup } from './utils/string.mjs';
import { getLargeIcon } from './icons.mjs';
import WeatherDisplay from './weatherdisplay.mjs';
import { registerDisplay } from './navigation.mjs';
import augmentObservationWithMetar from './utils/metar.mjs';
import {
	temperature, windSpeed, pressure, distanceMeters, distanceKilometers,
} from './utils/units.mjs';
import { debugFlag } from './utils/debug.mjs';
import { isDataStale, enhanceObservationWithMapClick } from './utils/mapclick.mjs';

// some stations prefixed do not provide all the necessary data
const skipStations = ['U', 'C', 'H', 'W', 'Y', 'T', 'S', 'M', 'O', 'L', 'A', 'F', 'B', 'N', 'V', 'R', 'D', 'E', 'I', 'G', 'J'];

class CurrentWeather extends WeatherDisplay {
	constructor(navId, elemId) {
		super(navId, elemId, 'Current Conditions', true);
	}

	async getData(weatherParameters, refresh) {
		// always load the data for use in the lower scroll
		const superResult = super.getData(weatherParameters, refresh);
		// note: current weather does not use old data on a silent refresh
		// this is deliberate because it can pull data from more than one station in sequence

		// filter for 4-letter observation stations, only those contain sky conditions and thus an icon
		const filteredStations = this.weatherParameters.stations.filter((station) => station?.properties?.stationIdentifier?.length === 4 && !skipStations.includes(station.properties.stationIdentifier.slice(0, 1)));

		// Load the observations
		let observations;
		let station;

		// station number counter
		let stationNum = 0;
		while (!observations && stationNum < filteredStations.length) {
			// get the station
			station = filteredStations[stationNum];
			const stationId = station.properties.stationIdentifier;

			stationNum += 1;

			let candidateObservation;
			try {
				// eslint-disable-next-line no-await-in-loop
				candidateObservation = await safeJson(`${station.id}/observations`, {
					data: {
						limit: 2, // we need the two most recent observations to calculate pressure direction
					},
					retryCount: 3,
					stillWaiting: () => this.stillWaiting(),
				});
			} catch (error) {
				console.error(`Unexpected error getting Current Conditions for station ${stationId}: ${error.message} (trying next station)`);
				candidateObservation = undefined;
			}

			// Check if request was successful and has data
			if (candidateObservation && candidateObservation.features?.length > 0) {
				// Attempt making observation data usable with METAR data
				const originalData = { ...candidateObservation.features[0].properties };
				candidateObservation.features[0].properties = augmentObservationWithMetar(candidateObservation.features[0].properties);
				const metarFields = [
					{ name: 'temperature', check: (orig, metar) => orig.temperature?.value === null && metar.temperature?.value !== null },
					{ name: 'windSpeed', check: (orig, metar) => orig.windSpeed?.value === null && metar.windSpeed?.value !== null },
					{ name: 'windDirection', check: (orig, metar) => orig.windDirection?.value === null && metar.windDirection?.value !== null },
					{ name: 'windGust', check: (orig, metar) => orig.windGust?.value === null && metar.windGust?.value !== null },
					{ name: 'dewpoint', check: (orig, metar) => orig.dewpoint?.value === null && metar.dewpoint?.value !== null },
					{ name: 'barometricPressure', check: (orig, metar) => orig.barometricPressure?.value === null && metar.barometricPressure?.value !== null },
					{ name: 'relativeHumidity', check: (orig, metar) => orig.relativeHumidity?.value === null && metar.relativeHumidity?.value !== null },
					{ name: 'visibility', check: (orig, metar) => orig.visibility?.value === null && metar.visibility?.value !== null },
					{ name: 'ceiling', check: (orig, metar) => orig.cloudLayers?.[0]?.base?.value === null && metar.cloudLayers?.[0]?.base?.value !== null },
				];
				const augmentedData = candidateObservation.features[0].properties;
				const metarReplacements = metarFields.filter((field) => field.check(originalData, augmentedData)).map((field) => field.name);
				if (debugFlag('currentweather') && metarReplacements.length > 0) {
					console.log(`Current Conditions for station ${stationId} were augmented with METAR data for ${metarReplacements.join(', ')}`);
				}

				// test data quality - check required fields and allow one optional field to be missing
				const requiredFields = [
					{ name: 'temperature', check: (props) => props.temperature?.value === null, required: true },
					{ name: 'textDescription', check: (props) => props.textDescription === null || props.textDescription === '', required: true },
					{ name: 'icon', check: (props) => props.icon === null, required: true },
					{ name: 'windSpeed', check: (props) => props.windSpeed?.value === null, required: false },
					{ name: 'dewpoint', check: (props) => props.dewpoint?.value === null, required: false },
					{ name: 'barometricPressure', check: (props) => props.barometricPressure?.value === null, required: false },
					{ name: 'visibility', check: (props) => props.visibility?.value === null, required: false },
					{ name: 'relativeHumidity', check: (props) => props.relativeHumidity?.value === null, required: false },
					{ name: 'ceiling', check: (props) => props.cloudLayers?.[0]?.base?.value === null, required: false },
				];

				// Use enhanced observation with MapClick fallback
				// eslint-disable-next-line no-await-in-loop
				const enhancedResult = await enhanceObservationWithMapClick(augmentedData, {
					requiredFields,
					maxOptionalMissing: 1, // Allow one optional field to be missing
					stationId,
					stillWaiting: () => this.stillWaiting(),
					debugContext: 'currentweather',
				});

				candidateObservation.features[0].properties = enhancedResult.data;
				const { missingFields } = enhancedResult;
				const missingRequired = missingFields.filter((fieldName) => {
					const field = requiredFields.find((f) => f.name === fieldName && f.required);
					return !!field;
				});
				const missingOptional = missingFields.filter((fieldName) => {
					const field = requiredFields.find((f) => f.name === fieldName && !f.required);
					return !!field;
				});
				const missingOptionalCount = missingOptional.length;

				// Check final data quality
				// Allow one optional field to be missing
				if (missingRequired.length === 0 && missingOptionalCount <= 1) {
					// Station data is good, use it
					observations = candidateObservation;
					if (debugFlag('currentweather') && missingOptional.length > 0) {
						console.log(`Data for station ${stationId} is missing optional fields: ${missingOptional.join(', ')} (acceptable)`);
					}
				} else {
					const allMissing = [...missingRequired, ...missingOptional];
					if (debugFlag('currentweather')) {
						console.log(`Data for station ${stationId} is missing fields: ${allMissing.join(', ')} (${missingRequired.length} required, ${missingOptionalCount} optional) (trying next station)`);
					}
				}
			} else if (debugFlag('verbose-failures')) {
				if (!candidateObservation) {
					console.log(`Current Conditions for station ${stationId} failed, trying next station`);
				} else {
					console.log(`No features returned for station ${stationId}, trying next station`);
				}
			}
		}
		// test for data received
		if (!observations) {
			console.error('Current Conditions failure: all nearby weather stations exhausted!');
			if (this.isEnabled) this.setStatus(STATUS.failed);
			// send failed to subscribers
			this.getDataCallback(undefined);
			return;
		}

		// we only get here if there was no error above
		this.data = parseData({ ...observations, station });
		this.getDataCallback();

		// stop here if we're disabled
		if (!superResult) return;

		// Data is available, ensure we're enabled for display
		this.timing.totalScreens = 1;

		// Check final data age
		const { isStale, ageInMinutes } = isDataStale(observations.features[0].properties.timestamp, 80); // hourly observation + 20 minute propagation delay
		this.isStaleData = isStale;

		if (isStale && debugFlag('currentweather')) {
			console.warn(`Current Conditions: Data is ${ageInMinutes.toFixed(0)} minutes old (from ${new Date(observations.features[0].properties.timestamp).toISOString()})`);
		}

		// preload the icon if available
		if (observations.features[0].properties.icon) {
			const iconResult = getLargeIcon(observations.features[0].properties.icon);
			if (iconResult) {
				preloadImg(iconResult);
			}
		}
		this.setStatus(STATUS.loaded);
	}

	async drawCanvas() {
		super.drawCanvas();

		// Update header text based on data staleness
		const headerTop = this.elem.querySelector('.header .title .top');
		if (headerTop) {
			headerTop.textContent = this.isStaleData ? 'Recent' : 'Current';
		}

		let condition = this.data.observations.textDescription;
		if (condition.length > 15) {
			condition = shortConditions(condition);
		}

		const wind = (typeof this.data.WindSpeed === 'number') ? this.data.WindDirection.padEnd(3, '') + this.data.WindSpeed.toString().padStart(3, ' ') : this.data.WindSpeed;

		const fill = {
			temp: this.data.Temperature + String.fromCharCode(176),
			condition,
			wind,
			location: locationCleanup(this.data.station.properties.name).substr(0, 20),
			humidity: `${this.data.Humidity}%`,
			dewpoint: this.data.DewPoint + String.fromCharCode(176),
			ceiling: (this.data.Ceiling === 0 ? 'Unlimited' : this.data.Ceiling + this.data.CeilingUnit),
			visibility: this.data.Visibility + this.data.VisibilityUnit,
			pressure: `${this.data.Pressure} ${this.data.PressureDirection}`,
			icon: { type: 'img', src: this.data.Icon },
		};

		if (this.data.WindGust !== '-') fill['wind-gusts'] = `Gusts to ${this.data.WindGust}`;

		if (this.data.observations.heatIndex.value && this.data.HeatIndex !== this.data.Temperature) {
			fill['heat-index-label'] = 'Heat Index:';
			fill['heat-index'] = this.data.HeatIndex + String.fromCharCode(176);
		} else if (this.data.observations.windChill.value && this.data.WindChill !== '' && this.data.WindChill < this.data.Temperature) {
			fill['heat-index-label'] = 'Wind Chill:';
			fill['heat-index'] = this.data.WindChill + String.fromCharCode(176);
		}

		const area = this.elem.querySelector('.main');

		area.innerHTML = '';
		area.append(this.fillTemplate('weather', fill));

		this.finishDraw();
	}

	// make data available outside this class
	// promise allows for data to be requested before it is available
	async getCurrentWeather(stillWaiting) {
		// an external caller has requested data, set up auto reload
		this.setAutoReload();
		if (stillWaiting) this.stillWaitingCallbacks.push(stillWaiting);
		return new Promise((resolve) => {
			if (this.data) resolve(this.data);
			// data not available, put it into the data callback queue
			this.getDataCallbacks.push(() => resolve(this.data));
		});
	}
}

const shortConditions = (_condition) => {
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

// format the received data
const parseData = (data) => {
	// get the unit converter
	const windConverter = windSpeed();
	const temperatureConverter = temperature();
	const metersConverter = distanceMeters();
	const kilometersConverter = distanceKilometers();
	const pressureConverter = pressure();

	const observations = data.features[0].properties;
	// values from api are provided in metric
	data.observations = observations;
	data.Temperature = temperatureConverter(observations.temperature.value);
	data.TemperatureUnit = temperatureConverter.units;
	data.DewPoint = temperatureConverter(observations.dewpoint.value);
	data.Ceiling = metersConverter(observations.cloudLayers[0]?.base?.value ?? 0);
	data.CeilingUnit = metersConverter.units;
	data.Visibility = kilometersConverter(observations.visibility.value);
	data.VisibilityUnit = kilometersConverter.units;
	data.Pressure = pressureConverter(observations.barometricPressure.value);
	data.PressureUnit = pressureConverter.units;
	data.HeatIndex = temperatureConverter(observations.heatIndex.value);
	data.WindChill = temperatureConverter(observations.windChill.value);
	data.WindSpeed = windConverter(observations.windSpeed.value);
	data.WindDirection = directionToNSEW(observations.windDirection.value);
	data.WindGust = windConverter(observations.windGust.value);
	data.WindUnit = windConverter.units;
	data.Humidity = Math.round(observations.relativeHumidity.value);

	// Get the large icon, but provide a fallback if it returns false
	const iconResult = getLargeIcon(observations.icon);
	data.Icon = iconResult || observations.icon; // Use original icon if getLargeIcon returns false

	data.PressureDirection = '';
	data.TextConditions = observations.textDescription;

	// set wind speed of 0 as calm
	if (data.WindSpeed === 0) data.WindSpeed = 'Calm';

	// if two measurements are available, use the difference (in pascals) to determine pressure trend
	if (data.features.length > 1 && data.features[1].properties.barometricPressure?.value) {
		const pressureDiff = (observations.barometricPressure.value - data.features[1].properties.barometricPressure.value);
		if (pressureDiff > 150) data.PressureDirection = 'R';
		if (pressureDiff < -150) data.PressureDirection = 'F';
	}

	return data;
};

const display = new CurrentWeather(1, 'current-weather');
registerDisplay(display);

export default display.getCurrentWeather.bind(display);

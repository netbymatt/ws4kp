/* globals navigation  */
import { locationCleanup } from './utils/string.mjs';
import { elemForEach } from './utils/elem.mjs';

// constants
const degree = String.fromCharCode(176);

// local variables
let interval;
let screenIndex = 0;

// start drawing conditions
// reset starts from the first item in the text scroll list
const start = () => {
	// store see if the context is new

	// set up the interval if needed
	if (!interval) {
		interval = setInterval(incrementInterval, 4000);
	}

	// draw the data
	drawScreen();
};

const stop = (reset) => {
	if (interval) interval = clearInterval(interval);
	if (reset) screenIndex = 0;
};

// increment interval, roll over
const incrementInterval = () => {
	screenIndex = (screenIndex + 1) % (screens.length);
	// draw new text
	drawScreen();
};

const drawScreen = async () => {
	// get the conditions
	const data = await navigation.getCurrentWeather();

	// nothing to do if there's no data yet
	if (!data) return;

	drawCondition(screens[screenIndex](data));
};

// the "screens" are stored in an array for easy addition and removal
const screens = [
	// station name
	(data) => `Conditions at ${locationCleanup(data.station.properties.name).substr(0, 20)}`,

	// temperature
	(data) => {
		let text = `Temp: ${data.Temperature}${degree} ${data.TemperatureUnit}`;
		if (data.observations.heatIndex.value) {
			text += `    Heat Index: ${data.HeatIndex}${degree} ${data.TemperatureUnit}`;
		} else if (data.observations.windChill.value) {
			text += `    Wind Chill: ${data.WindChill}${degree} ${data.TemperatureUnit}`;
		}
		return text;
	},

	// humidity
	(data) => `Humidity: ${data.Humidity}${degree} ${data.TemperatureUnit}  Dewpoint: ${data.DewPoint}${degree} ${data.TemperatureUnit}`,

	// barometric pressure
	(data) => `Barometric Pressure: ${data.Pressure} ${data.PressureDirection}`,

	// wind
	(data) => {
		let text = '';
		if (data.WindSpeed > 0) {
			text = `Wind: ${data.WindDirection} ${data.WindSpeed} ${data.WindUnit}`;
		} else {
			text = 'Wind: Calm';
		}
		if (data.WindGust > 0) {
			text += `  Gusts to ${data.WindGust}`;
		}
		return text;
	},

	// visibility
	(data) => `Visib: ${data.Visibility} ${data.VisibilityUnit}  Ceiling: ${data.Ceiling === 0 ? 'Unlimited' : `${data.Ceiling} ${data.CeilingUnit}`}`,
];

// internal draw function with preset parameters
const drawCondition = (text) => {
	// update all html scroll elements
	elemForEach('.weather-display .scroll .fixed', (elem) => {
		elem.innerHTML = text;
	});
};

// return the api
export {
	start,
	stop,
};

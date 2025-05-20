import { locationCleanup } from './utils/string.mjs';
import { elemForEach } from './utils/elem.mjs';
import getCurrentWeather from './currentweather.mjs';
import { currentDisplay } from './navigation.mjs';

// constants
const degree = String.fromCharCode(176);
const SCROLL_SPEED = 75; // pixels/second
const DEFAULT_UPDATE = 8; // 0.5s ticks

// local variables
let interval;
let screenIndex = 0;
let sinceLastUpdate = 0;
let nextUpdate = DEFAULT_UPDATE;

// start drawing conditions
// reset starts from the first item in the text scroll list
const start = () => {
	// store see if the context is new

	// set up the interval if needed
	if (!interval) {
		interval = setInterval(incrementInterval, 500);
	}

	// draw the data
	drawScreen();
};

const stop = (reset) => {
	if (reset) screenIndex = 0;
};

// increment interval, roll over
// forcing is used when drawScreen receives an invalid screen and needs to request the next one in line
const incrementInterval = (force) => {
	if (!force) {
		// test for elapsed time (0.5s ticks);
		sinceLastUpdate += 1;
		if (sinceLastUpdate < nextUpdate) return;
	}
	// reset flags
	sinceLastUpdate = 0;
	nextUpdate = DEFAULT_UPDATE;

	// test current screen
	const display = currentDisplay();
	if (!display?.okToDrawCurrentConditions) {
		stop(display?.elemId === 'progress');
		return;
	}
	screenIndex = (screenIndex + 1) % (lastScreen);
	// draw new text
	drawScreen();
};

const drawScreen = async () => {
	// get the conditions
	const data = await getCurrentWeather();

	// nothing to do if there's no data yet
	if (!data) return;

	const thisScreen = screens[screenIndex](data);
	if (typeof thisScreen === 'string') {
		// only a string
		drawCondition(thisScreen);
	} else if (typeof thisScreen === 'object') {
		// an object was provided with additional parameters
		switch (thisScreen.type) {
			case 'scroll':
				drawScrollCondition(thisScreen);
				break;
			default: drawCondition(thisScreen);
		}
	} else {
		// can't identify screen, get another one
		incrementInterval(true);
	}
};

// the "screens" are stored in an array for easy addition and removal
const screens = [
	// station name
	(data) => `Conditions at ${locationCleanup(data.station.properties.name).substr(0, 20)}`,

	// temperature
	(data) => {
		let text = `Temp: ${data.Temperature}${degree}${data.TemperatureUnit}`;
		if (data.observations.heatIndex.value) {
			text += `    Heat Index: ${data.HeatIndex}${degree}${data.TemperatureUnit}`;
		} else if (data.observations.windChill.value) {
			text += `    Wind Chill: ${data.WindChill}${degree}${data.TemperatureUnit}`;
		}
		return text;
	},

	// humidity
	(data) => `Humidity: ${data.Humidity}%   Dewpoint: ${data.DewPoint}${degree}${data.TemperatureUnit}`,

	// barometric pressure
	(data) => `Barometric Pressure: ${data.Pressure} ${data.PressureDirection}`,

	// wind
	(data) => {
		let text = data.WindSpeed > 0
			? `Wind: ${data.WindDirection} ${data.WindSpeed} ${data.WindUnit}`
			: 'Wind: Calm';

		if (data.WindGust > 0) {
			text += `  Gusts to ${data.WindGust}`;
		}
		return text;
	},

	// visibility
	(data) => {
		const distance = `${data.Ceiling} ${data.CeilingUnit}`;
		return `Visib: ${data.Visibility} ${data.VisibilityUnit}  Ceiling: ${data.Ceiling === 0 ? 'Unlimited' : distance}`;
	},
];

// internal draw function with preset parameters
const drawCondition = (text) => {
	// update all html scroll elements
	elemForEach('.weather-display .scroll .fixed', (elem) => {
		elem.innerHTML = text;
	});
};
document.addEventListener('DOMContentLoaded', () => {
	start();
});

// store the original number of screens
const originalScreens = screens.length;
let lastScreen = originalScreens;

// reset the number of screens
const reset = () => {
	lastScreen = originalScreens;
};

// add screen
const addScreen = (screen) => {
	screens.push(screen);
	lastScreen += 1;
};

const drawScrollCondition = (screen) => {
	// create the scroll element
	const scrollElement = document.createElement('div');
	scrollElement.classList.add('scroll-area');
	scrollElement.innerHTML = screen.text;
	// add it to the page to get the width
	document.querySelector('.weather-display .scroll .fixed').innerHTML = scrollElement.outerHTML;
	// grab the width
	const { scrollWidth, clientWidth } = document.querySelector('.weather-display .scroll .fixed .scroll-area');

	// calculate the scroll distance and set a minimum scroll
	const scrollDistance = Math.max(scrollWidth - clientWidth, 0);
	// calculate the scroll time
	const scrollTime = scrollDistance / SCROLL_SPEED;
	// calculate a new minimum on-screen time +1.0s at start and end
	nextUpdate = Math.round(Math.ceil(scrollTime / 0.5) + 4);

	// update the element transition and set initial left position
	scrollElement.style.left = '0px';
	scrollElement.style.transition = `left linear ${scrollTime.toFixed(1)}s`;
	elemForEach('.weather-display .scroll .fixed', (elem) => {
		elem.innerHTML = '';
		elem.append(scrollElement.cloneNode(true));
	});
	// start the scroll after a short delay
	setTimeout(() => {
		// change the left position to trigger the scroll
		elemForEach('.weather-display .scroll .fixed .scroll-area', (elem) => {
			elem.style.left = `-${scrollDistance.toFixed(0)}px`;
		});
	}, 1000);
};

window.CurrentWeatherScroll = {
	addScreen,
	reset,
};

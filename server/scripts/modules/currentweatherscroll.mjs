import { locationCleanup } from './utils/string.mjs';
import { elemForEach } from './utils/elem.mjs';
import getCurrentWeather from './currentweather.mjs';
import { currentDisplay } from './navigation.mjs';
import getHazards from './hazards.mjs';

// constants
const degree = String.fromCharCode(176);
const SCROLL_SPEED = 75; // pixels/second
const DEFAULT_UPDATE = 8; // 0.5s ticks

// local variables
let interval;
let screenIndex = 0;
let sinceLastUpdate = 0;
let nextUpdate = DEFAULT_UPDATE;
let resetFlag;
let defaultScreensLoaded = true;

// start drawing conditions
// reset starts from the first item in the text scroll list
const start = () => {
	// if already started, draw the screen on a reset flag and return
	if (interval) {
		if (resetFlag) drawScreen();
		resetFlag = false;
		return;
	}
	resetFlag = false;
	// set up the interval if needed
	if (!interval) {
		interval = setInterval(incrementInterval, 500);
	}

	// draw the data
	drawScreen();
};

const stop = (reset) => {
	if (reset) {
		screenIndex = 0;
		resetFlag = true;
	}
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
	screenIndex = (screenIndex + 1) % (workingScreens.length);

	// draw new text
	drawScreen();
};

const drawScreen = async () => {
	// get the conditions
	const data = await getCurrentWeather();

	// add the hazards if on screen 0
	if (screenIndex === 0) {
		data.hazards = await getHazards(() => this.stillWaiting());
	}

	// nothing to do if there's no data yet
	if (!data) return;

	const thisScreen = workingScreens[screenIndex](data);

	// update classes on the scroll area
	elemForEach('.weather-display .scroll', (elem) => {
		elem.classList.forEach((cls) => { if (cls !== 'scroll') elem.classList.remove(cls); });
		// no scroll on progress
		if (elem.parentElement.id === 'progress-html') return;
		thisScreen?.classes?.forEach((cls) => elem.classList.add(cls));
	});

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
		// add the header if available
		if (thisScreen.header) {
			setHeader(thisScreen.header);
		} else {
			setHeader('');
		}
	} else {
		// can't identify screen, get another one
		incrementInterval(true);
	}
};

const hazards = (data) => {
	// test for data
	if (!data.hazards || data.hazards.length === 0) return false;

	const hazard = `${data.hazards[0].properties.event} ${data.hazards[0].properties.description}`;

	return {
		text: hazard,
		type: 'scroll',
		classes: ['hazard'],
		header: data.hazards[0].properties.event,
	};
};

// additional screens are stored in a separate for simple clearing/resettings
let additionalScreens = [];
// the "screens" are stored in an array for easy addition and removal
const baseScreens = [
	// hazards
	hazards,
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

// working screens are the combination of base screens (when active) and additional screens
let workingScreens = [...baseScreens, ...additionalScreens];

// internal draw function with preset parameters
const drawCondition = (text) => {
	// update all html scroll elements
	elemForEach('.weather-display .scroll .fixed', (elem) => {
		elem.innerHTML = text;
	});
	setHeader('');
};

const setHeader = (text) => {
	elemForEach('.weather-display .scroll .scroll-header', (elem) => {
		elem.innerHTML = text ?? '';
	});
};

// reset the screens back to the original set
const reset = () => {
	workingScreens = [...baseScreens];
	additionalScreens = [];
	defaultScreensLoaded = true;
};

// add screen, keepBase keeps the regular weather crawl
const addScreen = (screen, keepBase = true) => {
	defaultScreensLoaded = false;
	additionalScreens.push(screen);
	workingScreens = [...(keepBase ? baseScreens : []), ...additionalScreens];
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

const parseMessage = (event) => {
	if (event?.data?.type === 'current-weather-scroll') {
		if (event.data?.method === 'start') start();
		if (event.data?.method === 'reload') stop(true);
	}
};

const screenCount = () => workingScreens.length;
const atDefault = () => defaultScreensLoaded;

// add event listener for start message
window.addEventListener('message', parseMessage);

window.CurrentWeatherScroll = {
	addScreen,
	reset,
	start,
	screenCount,
	atDefault,
};

export {
	addScreen,
	reset,
	start,
	screenCount,
	atDefault,
};

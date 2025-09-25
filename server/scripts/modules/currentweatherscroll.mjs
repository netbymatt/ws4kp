import { locationCleanup } from './utils/string.mjs';
import getCurrentWeather from './currentweather.mjs';
import { currentDisplay } from './navigation.mjs';
import getHazards from './hazards.mjs';
import settings from './settings.mjs';

// constants
const degree = String.fromCharCode(176);
const SCROLL_SPEED = 100; // pixels/second
const TICK_INTERVAL_MS = 500; // milliseconds per tick
const secondsToTicks = (seconds) => Math.ceil((seconds * 1000) / TICK_INTERVAL_MS);
const DEFAULT_UPDATE = secondsToTicks(4.0); // 4 second default for each current conditions

// items on page
let mainScroll;
let fixedScroll;
let header;
document.addEventListener('DOMContentLoaded', () => {
	mainScroll = document.querySelector('#container>.scroll');
	fixedScroll = document.querySelector('#container>.scroll .fixed');
	header = document.querySelector('#container>.scroll .scroll-header');
});

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
	// show the block
	show();
	// if already started, draw the screen on a reset flag and return
	if (interval) {
		if (resetFlag) drawScreen();
		resetFlag = false;
		return;
	}
	resetFlag = false;
	// set up the interval if needed
	if (!interval) {
		interval = setInterval(incrementInterval, TICK_INTERVAL_MS);
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
		hide();
		return;
	}
	screenIndex = (screenIndex + 1) % (workingScreens.length);

	// draw new text
	drawScreen();
};

const drawScreen = async () => {
	// get the conditions
	const data = await getCurrentWeather();

	// create a data object (empty if no valid current weather conditions)
	const scrollData = data || {};

	// add the hazards if on screen 0
	if (screenIndex === 0) {
		const hazards = await getHazards();
		if (hazards && hazards.length > 0) {
			scrollData.hazards = hazards;
		}
	}

	// if we have no current weather and no hazards, there's nothing to display
	if (!data && (!scrollData.hazards || scrollData.hazards.length === 0)) return;

	const thisScreen = workingScreens[screenIndex](scrollData);

	// update classes on the scroll area
	mainScroll.classList.forEach((cls) => { if (cls !== 'scroll') mainScroll.classList.remove(cls); });
	thisScreen?.classes?.forEach((cls) => mainScroll.classList.add(cls));

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
	(data) => {
		const location = (StationInfo[data.station.properties.stationIdentifier]?.city ?? locationCleanup(data.station.properties.name)).substr(0, 20);
		return `Conditions at ${location}`;
	},

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
	fixedScroll.innerHTML = text;
	setHeader('');
};

const setHeader = (text) => {
	header.innerHTML = text ?? '';
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
	fixedScroll.innerHTML = scrollElement.outerHTML;
	// grab the width
	const { scrollWidth, clientWidth } = document.querySelector('#container>.scroll .fixed .scroll-area');

	// calculate the scroll distance and set a minimum scroll
	const scrollDistance = Math.max(scrollWidth - clientWidth, 0);
	// calculate the scroll time (scaled by global speed setting), minimum 2s (4s when added to start and end delays)
	const scrollTime = Math.max(scrollDistance / SCROLL_SPEED * settings.speed.value, 2);
	// add 1 second pause at the end of the scroll animation
	const endPauseTime = 1.0;
	const totalAnimationTime = scrollTime + endPauseTime;
	// calculate total on-screen time: animation time + start delay + end pause
	const startDelayTime = 1.0; // setTimeout delay below
	const totalDisplayTime = totalAnimationTime + startDelayTime;
	nextUpdate = secondsToTicks(totalDisplayTime);

	// update the element with initial position and transition
	scrollElement.style.transform = 'translateX(0px)';
	scrollElement.style.transition = `transform ${scrollTime.toFixed(1)}s linear`;
	scrollElement.style.willChange = 'transform'; // Hint to browser for hardware acceleration
	scrollElement.style.backfaceVisibility = 'hidden'; // Force hardware acceleration
	scrollElement.style.perspective = '1000px'; // Enable 3D rendering context

	fixedScroll.innerHTML = '';
	fixedScroll.append(scrollElement.cloneNode(true));

	// start the scroll after the specified delay
	setTimeout(() => {
		// change the transform to trigger the scroll
		document.querySelector('#container>.scroll .fixed .scroll-area').style.transform = `translateX(-${scrollDistance.toFixed(0)}px)`;
	}, startDelayTime * 1000);
};

const parseMessage = (event) => {
	if (event?.data?.type === 'current-weather-scroll') {
		if (event.data?.method === 'start') start();
		if (event.data?.method === 'reload') stop(true);
		if (event.data?.method === 'show') show();
		if (event.data?.method === 'hide') hide();
	}
};

const show = () => {
	mainScroll.style.display = 'block';
};

const hide = () => {
	mainScroll.style.display = 'none';
};

const screenCount = () => workingScreens.length;
const atDefault = () => defaultScreensLoaded;

// add event listener for start message
window.addEventListener('message', parseMessage);

window.CurrentWeatherScroll = {
	addScreen,
	reset,
	start,
	show,
	hide,
	screenCount,
	atDefault,
};

export {
	addScreen,
	reset,
	start,
	show,
	hide,
	screenCount,
	atDefault,
};

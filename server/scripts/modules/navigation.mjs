// navigation handles progress, next/previous and initial load messages from the parent frame
import noSleep from './utils/nosleep.mjs';
import STATUS from './status.mjs';
import { wrap } from './utils/calc.mjs';
import { json } from './utils/fetch.mjs';
import { getPoint } from './utils/weather.mjs';

document.addEventListener('DOMContentLoaded', () => {
	init();
});

const displays = [];
let playing = false;
let progress;
const weatherParameters = {};

// auto refresh
const AUTO_REFRESH_INTERVAL_MS = 500;
const AUTO_REFRESH_TIME_MS = 600_000; // 10 min.
const CHK_AUTO_REFRESH_SELECTOR = '#chkAutoRefresh';
let AutoRefreshIntervalId = null;
let AutoRefreshCountMs = 0;

const init = async () => {
	// set up resize handler
	window.addEventListener('resize', resize);
	resize();

	// auto refresh
	const autoRefresh = localStorage.getItem('autoRefresh');
	if (!autoRefresh || autoRefresh === 'true') {
		document.querySelector(CHK_AUTO_REFRESH_SELECTOR).checked = true;
	} else {
		document.querySelector(CHK_AUTO_REFRESH_SELECTOR).checked = false;
	}
	document.querySelector(CHK_AUTO_REFRESH_SELECTOR).addEventListener('change', autoRefreshChange);
	generateCheckboxes();
};

const message = (data) => {
	// dispatch event
	if (!data.type) return false;
	if (data.type === 'navButton') return handleNavButton(data.message);
	return console.error(`Unknown event ${data.type}`);
};

const getWeather = async (latLon, haveDataCallback) => {
	// get initial weather data
	const point = await getPoint(latLon.lat, latLon.lon);

	if (typeof haveDataCallback === 'function') haveDataCallback(point);

	// get stations
	const stations = await json(point.properties.observationStations);

	const StationId = stations.features[0].properties.stationIdentifier;

	let { city } = point.properties.relativeLocation.properties;
	const { state } = point.properties.relativeLocation.properties;

	if (StationId in StationInfo) {
		city = StationInfo[StationId].city;
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
	weatherParameters.stations = stations.features;

	// update the main process for display purposes
	populateWeatherParameters(weatherParameters);

	// draw the progress canvas and hide others
	hideAllCanvases();
	document.querySelector('#loading').style.display = 'none';
	if (progress) {
		await progress.drawCanvas();
		progress.showCanvas();
	}

	// call for new data on each display
	displays.forEach((display) => display.getData(weatherParameters));
};

// receive a status update from a module {id, value}
const updateStatus = (value) => {
	if (value.id < 0) return;
	if (!progress) return;
	progress.drawCanvas(displays, countLoadedDisplays());

	// first display is hazards and it must load before evaluating the first display
	if (displays[0].status === STATUS.loading) return;

	// calculate first enabled display
	const firstDisplayIndex = displays.findIndex((display) => display.enabled && display.timing.totalScreens > 0);

	// value.id = 0 is hazards, if they fail to load hot-wire a new value.id to the current display to see if it needs to be loaded
	// typically this plays out as current conditions loads, then hazards fails.
	if (value.id === 0 && (value.status === STATUS.failed || value.status === STATUS.retrying)) {
		value.id = firstDisplayIndex;
		value.status = displays[firstDisplayIndex].status;
	}

	// if this is the first display and we're playing, load it up so it starts playing
	if (isPlaying() && value.id === firstDisplayIndex && value.status === STATUS.loaded) {
		navTo(msg.command.firstFrame);
	}

	// send loaded messaged to parent
	if (countLoadedDisplays() < displays.length) return;

	// everything loaded, set timestamps
	AssignLastUpdate(new Date());
};

// note: a display that is "still waiting"/"retrying" is considered loaded intentionally
// the weather.gov api has long load times for some products when you are the first
// requester for the product after the cache expires
const countLoadedDisplays = () => displays.reduce((acc, display) => {
	if (display.status !== STATUS.loading) return acc + 1;
	return acc;
}, 0);

const hideAllCanvases = () => {
	displays.forEach((display) => display.hideCanvas());
};

// is playing interface
const isPlaying = () => playing;

// navigation message constants
const msg = {
	response: {	// display to navigation
		previous: Symbol('previous'),		// already at first frame, calling function should switch to previous canvas
		inProgress: Symbol('inProgress'),	// have data to display, calling function should do nothing
		next: Symbol('next'),				// end of frames reached, calling function should switch to next canvas
	},
	command: {	// navigation to display
		firstFrame: Symbol('firstFrame'),
		previousFrame: Symbol('previousFrame'),
		nextFrame: Symbol('nextFrame'),
		lastFrame: Symbol('lastFrame'),	// used when navigating backwards from the begining of the next canvas
	},
};

// receive navigation messages from displays
const displayNavMessage = (myMessage) => {
	if (myMessage.type === msg.response.previous) loadDisplay(-1);
	if (myMessage.type === msg.response.next) loadDisplay(1);
};

// navigate to next or previous
const navTo = (direction) => {
	// test for a current display
	const current = currentDisplay();
	progress.hideCanvas();
	if (!current) {
		// special case for no active displays (typically on progress screen)
		// find the first ready display
		let firstDisplay;
		let displayCount = 0;
		do {
			if (displays[displayCount].status === STATUS.loaded && displays[displayCount].timing.totalScreens > 0) firstDisplay = displays[displayCount];
			displayCount += 1;
		} while (!firstDisplay && displayCount < displays.length);

		if (!firstDisplay) return;

		firstDisplay.navNext(msg.command.firstFrame);
		firstDisplay.showCanvas();
		return;
	}
	if (direction === msg.command.nextFrame) currentDisplay().navNext();
	if (direction === msg.command.previousFrame) currentDisplay().navPrev();
};

// find the next or previous available display
const loadDisplay = (direction) => {
	const totalDisplays = displays.length;
	const curIdx = currentDisplayIndex();
	let idx;
	for (let i = 0; i < totalDisplays; i += 1) {
		// convert form simple 0-10 to start at current display index +/-1 and wrap
		idx = wrap(curIdx + (i + 1) * direction, totalDisplays);
		if (displays[idx].status === STATUS.loaded && displays[idx].timing.totalScreens > 0) break;
	}
	// if new display index is less than current display a wrap occurred, test for reload timeout
	if (idx <= curIdx && refreshCheck()) return;
	const newDisplay = displays[idx];
	// hide all displays
	hideAllCanvases();
	// show the new display and navigate to an appropriate display
	if (direction < 0) newDisplay.showCanvas(msg.command.lastFrame);
	if (direction > 0) newDisplay.showCanvas(msg.command.firstFrame);
};

// get the current display index or value
const currentDisplayIndex = () => displays.findIndex((display) => display.active);
const currentDisplay = () => displays[currentDisplayIndex()];

const setPlaying = (newValue) => {
	playing = newValue;
	const playButton = document.querySelector('#NavigatePlay');
	localStorage.setItem('play', playing);

	if (playing) {
		noSleep(true);
		playButton.title = 'Pause';
		playButton.src = 'images/nav/ic_pause_white_24dp_2x.png';
	} else {
		noSleep(false);
		playButton.title = 'Play';
		playButton.src = 'images/nav/ic_play_arrow_white_24dp_2x.png';
	}
	// if we're playing and on the progress screen jump to the next screen
	if (!progress) return;
	if (playing && !currentDisplay()) navTo(msg.command.firstFrame);
};

// handle all navigation buttons
const handleNavButton = (button) => {
	switch (button) {
	case 'play':
		setPlaying(true);
		break;
	case 'playToggle':
		setPlaying(!playing);
		break;
	case 'stop':
		setPlaying(false);
		break;
	case 'next':
		setPlaying(false);
		navTo(msg.command.nextFrame);
		break;
	case 'previous':
		setPlaying(false);
		navTo(msg.command.previousFrame);
		break;
	case 'menu':
		setPlaying(false);
		progress.showCanvas();
		hideAllCanvases();
		break;
	default:
		console.error(`Unknown navButton ${button}`);
	}
};

// return the specificed display
const getDisplay = (index) => displays[index];

// resize the container on a page resize
const resize = () => {
	const widthZoomPercent = (document.querySelector('#divTwcBottom').getBoundingClientRect().width) / 640;
	const heightZoomPercent = (window.innerHeight) / 480;

	const scale = Math.min(widthZoomPercent, heightZoomPercent);
	if (scale < 1.0 || document.fullscreenElement) {
		document.querySelector('#container').style.zoom = scale;
	} else {
		document.querySelector('#container').style.zoom = 1;
	}
};

// reset all statuses to loading on all displays, used to keep the progress bar accurate during refresh
const resetStatuses = () => {
	displays.forEach((display) => { display.status = STATUS.loading; });
};

// allow displays to register themselves
const registerDisplay = (display) => {
	displays[display.navId] = display;

	// generate checkboxes
	generateCheckboxes();
};

const generateCheckboxes = () => {
	const availableDisplays = document.querySelector('#enabledDisplays');

	if (!availableDisplays) return;
	// generate checkboxes
	const checkboxes = displays.map((d) => d.generateCheckbox(d.defaultEnabled)).filter((d) => d);

	// write to page
	availableDisplays.innerHTML = '';
	availableDisplays.append(...checkboxes);
};

// special registration method for progress display
const registerProgress = (_progress) => {
	progress = _progress;
};

const populateWeatherParameters = (params) => {
	document.querySelector('#spanCity').innerHTML = `${params.city}, `;
	document.querySelector('#spanState').innerHTML = params.state;
	document.querySelector('#spanStationId').innerHTML = params.stationId;
	document.querySelector('#spanRadarId').innerHTML = params.radarId;
	document.querySelector('#spanZoneId').innerHTML = params.zoneId;
};

const autoRefreshChange = (e) => {
	const { checked } = e.target;

	if (checked) {
		startAutoRefreshTimer();
	} else {
		stopAutoRefreshTimer();
	}

	localStorage.setItem('autoRefresh', checked);
};

const AssignLastUpdate = (date) => {
	if (date) {
		document.querySelector('#spanLastRefresh').innerHTML = date.toLocaleString('en-US', {
			weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', timeZoneName: 'short',
		});
		if (document.querySelector(CHK_AUTO_REFRESH_SELECTOR).checked) startAutoRefreshTimer();
	} else {
		document.querySelector('#spanLastRefresh').innerHTML = '(none)';
	}
};

const latLonReceived = (data, haveDataCallback) => {
	getWeather(data, haveDataCallback);
	AssignLastUpdate(null);
};

const startAutoRefreshTimer = () => {
	// Ensure that any previous timer has already stopped.
	// check if timer is running
	if (AutoRefreshIntervalId) return;

	// Reset the time elapsed.
	AutoRefreshCountMs = 0;

	const AutoRefreshTimer = () => {
		// Increment the total time elapsed.
		AutoRefreshCountMs += AUTO_REFRESH_INTERVAL_MS;

		// Display the count down.
		let RemainingMs = (AUTO_REFRESH_TIME_MS - AutoRefreshCountMs);
		if (RemainingMs < 0) {
			RemainingMs = 0;
		}
		const dt = new Date(RemainingMs);
		document.querySelector('#spanRefreshCountDown').innerHTML = `${dt.getMinutes().toString().padStart(2, '0')}:${dt.getSeconds().toString().padStart(2, '0')}`;

		// Time has elapsed.
		if (AutoRefreshCountMs >= AUTO_REFRESH_TIME_MS && !isPlaying()) loadTwcData();
	};
	AutoRefreshIntervalId = window.setInterval(AutoRefreshTimer, AUTO_REFRESH_INTERVAL_MS);
	AutoRefreshTimer();
};
const stopAutoRefreshTimer = () => {
	if (AutoRefreshIntervalId) {
		window.clearInterval(AutoRefreshIntervalId);
		document.querySelector('#spanRefreshCountDown').innerHTML = '--:--';
		AutoRefreshIntervalId = null;
	}
};

const refreshCheck = () => {
	// Time has elapsed.
	if (AutoRefreshCountMs >= AUTO_REFRESH_TIME_MS && isPlaying()) {
		loadTwcData();
		return true;
	}
	return false;
};

const loadTwcData = () => {
	if (loadTwcData.callback) loadTwcData.callback();
};

const registerRefreshData = (callback) => {
	loadTwcData.callback = callback;
};

const timeZone = () => weatherParameters.timeZone;

export {
	updateStatus,
	displayNavMessage,
	resetStatuses,
	isPlaying,
	resize,
	registerDisplay,
	registerProgress,
	currentDisplay,
	getDisplay,
	msg,
	message,
	latLonReceived,
	stopAutoRefreshTimer,
	registerRefreshData,
	timeZone,
};

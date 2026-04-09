import { json } from './modules/utils/fetch.mjs';
import noSleep from './modules/utils/nosleep.mjs';
import {
	message as navMessage, isPlaying, resize, resetStatuses, latLonReceived, isIOS,
} from './modules/navigation.mjs';
import { round2 } from './modules/utils/units.mjs';
import { registerHiddenSetting } from './modules/share.mjs';
import settings from './modules/settings.mjs';
import AutoComplete from './modules/autocomplete.mjs';
import { loadAllData } from './modules/utils/data-loader.mjs';
import { debugFlag } from './modules/utils/debug.mjs';
import { parseQueryString } from './modules/utils/setting.mjs';

document.addEventListener('DOMContentLoaded', () => {
	init();
	getCustomCode();
});

const categories = [
	'Land Features',
	'Bay', 'Channel', 'Cove', 'Dam', 'Delta', 'Gulf', 'Lagoon', 'Lake', 'Ocean', 'Reef', 'Reservoir', 'Sea', 'Sound', 'Strait', 'Waterfall', 'Wharf', // Water Features
	'Amusement Park', 'Historical Monument', 'Landmark', 'Tourist Attraction', 'Zoo', // POI/Arts and Entertainment
	'College', // POI/Education
	'Beach', 'Campground', 'Golf Course', 'Harbor', 'Nature Reserve', 'Other Parks and Outdoors', 'Park', 'Racetrack',
	'Scenic Overlook', 'Ski Resort', 'Sports Center', 'Sports Field', 'Wildlife Reserve', // POI/Parks and Outdoors
	'Airport', 'Ferry', 'Marina', 'Pier', 'Port', 'Resort', // POI/Travel
	'Postal', 'Populated Place',
];
const category = categories.join(',');
const TXT_ADDRESS_SELECTOR = '#txtLocation';
const TOGGLE_FULL_SCREEN_SELECTOR = '#ToggleFullScreen';
const BNT_GET_GPS_SELECTOR = '#btnGetGps';

const init = async () => {
	// Load core data first - app cannot function without it
	try {
		await loadAllData(typeof OVERRIDES !== 'undefined' && OVERRIDES.VERSION ? OVERRIDES.VERSION : '');
	} catch (error) {
		console.error('Failed to load core application data:', error);
		// Show error message to user and halt initialization
		document.body.innerHTML = `
			<div>
				<h2>Unable to load Weather Data</h2>
				<p>The application cannot start because core data failed to load.</p>
				<p>Please check your connection and try refreshing.</p>
			</div>
		`;
		return; // Stop initialization
	}

	document.querySelector(TXT_ADDRESS_SELECTOR).addEventListener('focus', (e) => {
		e.target.select();
	});

	document.querySelector('#NavigateMenu').addEventListener('click', btnNavigateMenuClick);
	document.querySelector('#NavigateRefresh').addEventListener('click', btnNavigateRefreshClick);
	document.querySelector('#NavigateNext').addEventListener('click', btnNavigateNextClick);
	document.querySelector('#NavigatePrevious').addEventListener('click', btnNavigatePreviousClick);
	document.querySelector('#NavigatePlay').addEventListener('click', btnNavigatePlayClick);
	document.querySelector('#ToggleScanlines').addEventListener('click', btnNavigateToggleScanlines);

	// Hide fullscreen button on iOS since it doesn't support true fullscreen
	const fullscreenButton = document.querySelector(TOGGLE_FULL_SCREEN_SELECTOR);
	if (isIOS()) {
		fullscreenButton.style.display = 'none';
	} else {
		fullscreenButton.addEventListener('click', btnFullScreenClick);
	}

	const btnGetGps = document.querySelector(BNT_GET_GPS_SELECTOR);
	btnGetGps.addEventListener('click', btnGetGpsClick);
	if (!navigator.geolocation) btnGetGps.style.display = 'none';

	document.querySelector('#divTwc').addEventListener('mousemove', () => {
		if (document.fullscreenElement || settings.kiosk?.value) updateFullScreenNavigate();
	});

	document.querySelector('#btnGetLatLng').addEventListener('click', () => autoComplete.directFormSubmit());

	document.addEventListener('keydown', documentKeydown);
	document.addEventListener('touchmove', (e) => { if (document.fullscreenElement) e.preventDefault(); });

	const autoComplete = new AutoComplete(document.querySelector(TXT_ADDRESS_SELECTOR), {
		serviceUrl: 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/suggest',
		deferRequestBy: 300,
		paramName: 'text',
		params: {
			f: 'json',
			countryCode: 'USA',
			category,
			maxSuggestions: 10,
		},
		dataType: 'json',
		transformResult: (response) => ({
			suggestions: response.suggestions.map((i) => ({
				value: i.text,
				data: i.magicKey,
			})),
		}),
		minChars: 3,
		showNoSuggestionNotice: true,
		noSuggestionNotice: 'No results found. Please try a different search string.',
		onSelect(suggestion) { autocompleteOnSelect(suggestion); },
		width: 490,
	});
	window.autoComplete = autoComplete;

	// attempt to parse the url parameters
	const parsedParameters = parseQueryString();
	const loadFromParsed = !!parsedParameters.latLon;

	// Auto load the parsed parameters and fall back to the previous query
	const query = parsedParameters.latLonQuery ?? localStorage.getItem('latLonQuery');
	const latLon = parsedParameters.latLon ?? localStorage.getItem('latLon');
	const fromGPS = localStorage.getItem('latLonFromGPS') && !loadFromParsed;

	if (parsedParameters.latLonQuery && !parsedParameters.latLon) {
		const txtAddress = document.querySelector(TXT_ADDRESS_SELECTOR);
		txtAddress.value = parsedParameters.latLonQuery;
		const geometry = await geocodeLatLonQuery(parsedParameters.latLonQuery);
		if (geometry) {
			doRedirectToGeometry(geometry);
		}
	} else if (latLon && !fromGPS) {
		// update in-page search box if using cached data, or parsed parameter
		if ((query && !loadFromParsed) || (parsedParameters.latLonQuery && loadFromParsed)) {
			const txtAddress = document.querySelector(TXT_ADDRESS_SELECTOR);
			txtAddress.value = query;
		}
		// use lat-long lookup if that's all that was provided in the query string
		if (loadFromParsed && parsedParameters.latLon && !parsedParameters.latLonQuery) {
			const { lat, lon } = JSON.parse(latLon);
			getForecastFromLatLon(lat, lon, true);
		} else {
			// otherwise use pre-stored data
			loadData(JSON.parse(latLon));
		}
	}
	if (fromGPS) {
		btnGetGpsClick();
	}

	// Handle kiosk mode initialization
	const urlKioskCheckbox = parsedParameters['settings-kiosk-checkbox'];

	// If kiosk=false is specified, disable kiosk mode and clear any stored value
	if (urlKioskCheckbox === 'false') {
		settings.kiosk.value = false;
		// Clear stored value by using conditional storage with false
		settings.kiosk.conditionalStoreToLocalStorage(false, false);
	} else if (urlKioskCheckbox === 'true') {
		// if kiosk mode was set via the query string, enable it
		settings.kiosk.value = true;
	}

	// Auto-play logic: also play immediately if kiosk mode is enabled
	const play = settings.kiosk.value || urlKioskCheckbox === 'true' ? 'true' : localStorage.getItem('play');
	if (play === null || play === 'true') postMessage('navButton', 'play');

	document.querySelector('#btnClearQuery').addEventListener('click', () => {
		document.querySelector('#spanCity').innerHTML = '';
		document.querySelector('#spanState').innerHTML = '';
		document.querySelector('#spanStationId').innerHTML = '';
		document.querySelector('#spanRadarId').innerHTML = '';
		document.querySelector('#spanZoneId').innerHTML = '';
		document.querySelector('#spanOfficeId').innerHTML = '';
		document.querySelector('#spanGridPoint').innerHTML = '';

		localStorage.removeItem('play');
		postMessage('navButton', 'play');

		localStorage.removeItem('latLonQuery');
		localStorage.removeItem('latLon');
		localStorage.removeItem('latLonFromGPS');
		document.querySelector(BNT_GET_GPS_SELECTOR).classList.remove('active');
	});

	// swipe functionality
	document.querySelector('#container').addEventListener('swiped-left', () => swipeCallBack('left'));
	document.querySelector('#container').addEventListener('swiped-right', () => swipeCallBack('right'));

	// register hidden settings for search and location query
	registerHiddenSetting('latLonQuery', () => localStorage.getItem('latLonQuery'));
	registerHiddenSetting('latLon', () => localStorage.getItem('latLon'));
};

const geocodeLatLonQuery = async (query) => {
	try {
		const data = await json('https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/find', {
			data: {
				text: query,
				f: 'json',
			},
		});

		const loc = data.locations?.[0];
		if (loc) {
			return loc.feature.geometry;
		}
		return null;
	} catch (error) {
		console.error('Geocoding failed:', error);
		return null;
	}
};

const autocompleteOnSelect = async (suggestion) => {
	// Note: it's fine that this uses json instead of safeJson since it's infrequent and user-initiated
	const data = await json('https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/find', {
		data: {
			text: suggestion.value,
			magicKey: suggestion.data,
			f: 'json',
		},
	});

	const loc = data.locations[0];
	if (loc) {
		localStorage.removeItem('latLonFromGPS');
		document.querySelector(BNT_GET_GPS_SELECTOR).classList.remove('active');
		doRedirectToGeometry(loc.feature.geometry);
	} else {
		console.error('An unexpected error occurred. Please try a different search string.');
	}
};

const doRedirectToGeometry = (geom, haveDataCallback) => {
	const latLon = { lat: round2(geom.y, 4), lon: round2(geom.x, 4) };
	// Save the query
	localStorage.setItem('latLonQuery', document.querySelector(TXT_ADDRESS_SELECTOR).value);
	localStorage.setItem('latLon', JSON.stringify(latLon));

	// get the data
	loadData(latLon, haveDataCallback);
};

const btnFullScreenClick = () => {
	if (document.fullscreenElement) {
		exitFullscreen();
	} else {
		enterFullScreen();
	}

	if (isPlaying()) {
		noSleep(true);
	} else {
		noSleep(false);
	}

	updateFullScreenNavigate();

	return false;
};

// This is async because modern browsers return a Promise from requestFullscreen
const enterFullScreen = async () => {
	const element = document.querySelector('#divTwc');

	// Supports most browsers and their versions.
	const requestMethod = element.requestFullscreen || element.webkitRequestFullscreen || element.mozRequestFullscreen || element.msRequestFullscreen;

	if (requestMethod) {
		try {
			// Native full screen with options for optimal display
			await requestMethod.call(element, {
				navigationUI: 'hide',
				allowsInlineMediaPlayback: true,
			});

			if (debugFlag('fullscreen')) {
				setTimeout(() => {
					console.log(`🖥️ Fullscreen engaged. window=${window.innerWidth}x${window.innerHeight} fullscreenElement=${!!document.fullscreenElement}`);
				}, 150);
			}
		} catch (error) {
			console.error('❌ Fullscreen request failed:', error);
		}
	} else {
		// iOS doesn't support FullScreen API.
		window.scrollTo(0, 0);
		resize(true); // Force resize for iOS
	}
	updateFullScreenNavigate();

	// change hover text and image
	const img = document.querySelector(TOGGLE_FULL_SCREEN_SELECTOR);
	if (img && img.style.display !== 'none') {
		img.src = 'images/nav/ic_fullscreen_exit_white_24dp_2x.png';
		img.title = 'Exit fullscreen';
	}
};

const exitFullscreen = () => {
	// exit full-screen

	if (document.exitFullscreen) {
		// Chrome 71 broke this if the user pressed F11 to enter full screen mode.
		document.exitFullscreen();
	} else if (document.webkitExitFullscreen) {
		document.webkitExitFullscreen();
	} else if (document.mozCancelFullscreen) {
		document.mozCancelFullscreen();
	} else if (document.msExitFullscreen) {
		document.msExitFullscreen();
	}
	// Note: resize will be called by fullscreenchange event listener
	exitFullScreenVisibilityChanges();
};

const exitFullScreenVisibilityChanges = () => {
	// change hover text and image
	const img = document.querySelector(TOGGLE_FULL_SCREEN_SELECTOR);
	if (img && img.style.display !== 'none') {
		img.src = 'images/nav/ic_fullscreen_white_24dp_2x.png';
		img.title = 'Enter fullscreen';
	}
	document.querySelector('#divTwc').classList.remove('no-cursor');
	const divTwcBottom = document.querySelector('#divTwcBottom');
	divTwcBottom.classList.remove('hidden');
	divTwcBottom.classList.add('visible');
};

const btnNavigateMenuClick = () => {
	postMessage('navButton', 'menu');
	return false;
};

const loadData = (_latLon, haveDataCallback) => {
	// if latlon is provided store it locally
	if (_latLon) loadData.latLon = _latLon;
	// get the data
	const { latLon } = loadData;
	// if there's no data stop
	if (!latLon) return;

	document.querySelector(TXT_ADDRESS_SELECTOR).blur();
	latLonReceived(latLon, haveDataCallback);
};

const swipeCallBack = (direction) => {
	switch (direction) {
		case 'left':
			btnNavigateNextClick();
			break;

		case 'right':
		default:
			btnNavigatePreviousClick();
			break;
	}
};

const btnNavigateRefreshClick = () => {
	resetStatuses();
	loadData();

	return false;
};

const btnNavigateNextClick = () => {
	postMessage('navButton', 'next');

	return false;
};

const btnNavigatePreviousClick = () => {
	postMessage('navButton', 'previous');

	return false;
};

let navigateFadeIntervalId = null;

const updateFullScreenNavigate = () => {
	document.activeElement.blur();
	const divTwcBottom = document.querySelector('#divTwcBottom');
	divTwcBottom.classList.remove('hidden');
	divTwcBottom.classList.add('visible');
	document.querySelector('#divTwc').classList.remove('no-cursor');

	if (navigateFadeIntervalId) {
		clearTimeout(navigateFadeIntervalId);
		navigateFadeIntervalId = null;
	}

	navigateFadeIntervalId = setTimeout(() => {
		if (document.fullscreenElement || settings.kiosk?.value) {
			divTwcBottom.classList.remove('visible');
			divTwcBottom.classList.add('hidden');
			document.querySelector('#divTwc').classList.add('no-cursor');
		}
	}, 2000);
};

const documentKeydown = (e) => {
	const { key } = e;

	// Handle Ctrl+K to exit kiosk mode (even when other modifiers would normally be ignored)
	if (e.ctrlKey && (key === 'k' || key === 'K')) {
		e.preventDefault();
		if (settings.kiosk?.value) {
			settings.kiosk.value = false;
		}
		return false;
	}

	// don't trigger on ctrl/alt/shift modified key for other shortcuts
	if (e.altKey || e.ctrlKey || e.shiftKey) return false;

	if (document.fullscreenElement || document.activeElement === document.body) {
		switch (key) {
			case ' ': // Space
				// don't scroll
				e.preventDefault();
				btnNavigatePlayClick();
				return false;

			case 'ArrowRight':
			case 'PageDown':
				// don't scroll
				e.preventDefault();
				btnNavigateNextClick();
				return false;

			case 'ArrowLeft':
			case 'PageUp':
				// don't scroll
				e.preventDefault();
				btnNavigatePreviousClick();
				return false;

			case 'ArrowUp': // Home
				e.preventDefault();
				btnNavigateMenuClick();
				return false;

			case '0': // "O" Restart
				btnNavigateRefreshClick();
				return false;

			case 'F':
			case 'f':
				btnFullScreenClick();
				return false;

			default:
		}
	}
	return false;
};

const btnNavigatePlayClick = () => {
	postMessage('navButton', 'playToggle');

	return false;
};

const btnNavigateToggleScanlines = () => {
	settings.scanLines.value = !settings.scanLines.value;
	return false;
};

// post a message to the iframe
const postMessage = (type, myMessage = {}) => {
	navMessage({ type, message: myMessage });
};

const getPosition = async () => new Promise((resolve) => {
	navigator.geolocation.getCurrentPosition(resolve);
});

const btnGetGpsClick = async () => {
	if (!navigator.geolocation) return;
	const btn = document.querySelector(BNT_GET_GPS_SELECTOR);

	// toggle first
	if (btn.classList.contains('active')) {
		btn.classList.remove('active');
		localStorage.removeItem('latLonFromGPS');
		return;
	}

	// set gps active
	btn.classList.add('active');

	// get position
	const position = await getPosition();
	const { latitude, longitude } = position.coords;

	getForecastFromLatLon(latitude, longitude, true);
};

const getForecastFromLatLon = (latitude, longitude, fromGps = false) => {
	const txtAddress = document.querySelector(TXT_ADDRESS_SELECTOR);
	txtAddress.value = `${round2(latitude, 4)}, ${round2(longitude, 4)}`;

	doRedirectToGeometry({ y: latitude, x: longitude }, (point) => {
		const location = point.properties.relativeLocation.properties;
		// Save the query
		const query = `${location.city}, ${location.state}`;
		localStorage.setItem('latLon', JSON.stringify({ lat: latitude, lon: longitude }));
		localStorage.setItem('latLonQuery', query);
		localStorage.setItem('latLonFromGPS', fromGps);
		txtAddress.value = `${location.city}, ${location.state}`;
	});
};

const getCustomCode = async () => {
	// fetch the custom file and see if it returns a 200 status
	const response = await fetch('scripts/custom.js', { method: 'HEAD' });
	if (response.ok) {
		// add the script element to the page
		const customElem = document.createElement('script');
		customElem.src = 'scripts/custom.js';
		customElem.type = 'text/javascript';
		document.body.append(customElem);
	}
};

// expose functions for external use
window.getForecastFromLatLon = getForecastFromLatLon;

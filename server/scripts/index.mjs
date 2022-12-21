import { json } from './modules/utils/fetch.mjs';
import noSleep from './modules/utils/nosleep.mjs';
import {
	message as navMessage, isPlaying, resize, resetStatuses, latLonReceived, stopAutoRefreshTimer, registerRefreshData,
} from './modules/navigation.mjs';
import { round2 } from './modules/utils/units.mjs';

document.addEventListener('DOMContentLoaded', () => {
	init();
});

let fullScreenOverride = false;

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

const init = () => {
	document.getElementById('txtAddress').addEventListener('focus', (e) => {
		e.target.select();
	});

	registerRefreshData(loadData);

	document.getElementById('NavigateMenu').addEventListener('click', btnNavigateMenuClick);
	document.getElementById('NavigateRefresh').addEventListener('click', btnNavigateRefreshClick);
	document.getElementById('NavigateNext').addEventListener('click', btnNavigateNextClick);
	document.getElementById('NavigatePrevious').addEventListener('click', btnNavigatePreviousClick);
	document.getElementById('NavigatePlay').addEventListener('click', btnNavigatePlayClick);
	document.getElementById('ToggleFullScreen').addEventListener('click', btnFullScreenClick);
	const btnGetGps = document.getElementById('btnGetGps');
	btnGetGps.addEventListener('click', btnGetGpsClick);
	if (!navigator.geolocation) btnGetGps.style.display = 'none';

	document.getElementById('divTwc').addEventListener('click', () => {
		if (document.fullscreenElement) updateFullScreenNavigate();
	});

	document.getElementById('txtAddress').addEventListener('keydown', (key) => { if (key.code === 'Enter') formSubmit(); });
	document.getElementById('btnGetLatLng').addEventListener('click', () => formSubmit());

	document.addEventListener('keydown', documentKeydown);
	document.addEventListener('touchmove', (e) => { if (fullScreenOverride) e.preventDefault(); });

	$('#txtAddress').devbridgeAutocomplete({
		serviceUrl: 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/suggest',
		deferRequestBy: 300,
		paramName: 'text',
		params: {
			f: 'json',
			countryCode: 'USA', // 'USA,PRI,VIR,GUM,ASM',
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
		onSelect(suggestion) { autocompleteOnSelect(suggestion, this); },
		width: 490,
	});

	const formSubmit = () => {
		const ac = $('#txtAddress').devbridgeAutocomplete();
		if (ac.suggestions[0]) $(ac.suggestionsContainer.children[0]).trigger('click');
		return false;
	};

	// Auto load the previous query
	const query = localStorage.getItem('latLonQuery');
	const latLon = localStorage.getItem('latLon');
	const fromGPS = localStorage.getItem('latLonFromGPS');
	if (query && latLon && !fromGPS) {
		const txtAddress = document.getElementById('txtAddress');
		txtAddress.value = query;
		loadData(JSON.parse(latLon));
	}
	if (fromGPS) {
		btnGetGpsClick();
	}

	const play = localStorage.getItem('play');
	if (play === null || play === 'true') postMessage('navButton', 'play');

	document.getElementById('btnClearQuery').addEventListener('click', () => {
		document.getElementById('spanCity').innerHTML = '';
		document.getElementById('spanState').innerHTML = '';
		document.getElementById('spanStationId').innerHTML = '';
		document.getElementById('spanRadarId').innerHTML = '';
		document.getElementById('spanZoneId').innerHTML = '';

		document.getElementById('chkAutoRefresh').checked = true;
		localStorage.removeItem('autoRefresh');

		localStorage.removeItem('play');
		postMessage('navButton', 'play');

		localStorage.removeItem('latLonQuery');
		localStorage.removeItem('latLon');
		localStorage.removeItem('latLonFromGPS');
		document.getElementById('btnGetGps').classList.remove('active');
	});

	// swipe functionality
	document.getElementById('container').addEventListener('swiped-left', () => swipeCallBack('left'));
	document.getElementById('container').addEventListener('swiped-right', () => swipeCallBack('right'));
};

const autocompleteOnSelect = async (suggestion, elem) => {
	// Do not auto get the same city twice.
	if (elem.previousSuggestionValue === suggestion.value) return;

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
		document.getElementById('btnGetGps').classList.remove('active');
		doRedirectToGeometry(loc.feature.geometry);
	} else {
		console.error('An unexpected error occurred. Please try a different search string.');
	}
};

const doRedirectToGeometry = (geom, haveDataCallback) => {
	const latLon = { lat: round2(geom.y, 4), lon: round2(geom.x, 4) };
	// Save the query
	localStorage.setItem('latLonQuery', document.getElementById('txtAddress').value);
	localStorage.setItem('latLon', JSON.stringify(latLon));

	// get the data
	loadData(latLon, haveDataCallback);
};

const btnFullScreenClick = () => {
	if (!document.fullscreenElement) {
		enterFullScreen();
	} else {
		exitFullscreen();
	}

	if (isPlaying()) {
		noSleep(true);
	} else {
		noSleep(false);
	}

	updateFullScreenNavigate();

	return false;
};

const enterFullScreen = () => {
	const element = document.getElementById('divTwc');

	// Supports most browsers and their versions.
	const requestMethod = element.requestFullScreen || element.webkitRequestFullScreen
			|| element.mozRequestFullScreen || element.msRequestFullscreen;

	if (requestMethod) {
		// Native full screen.
		requestMethod.call(element, { navigationUI: 'hide' }); // https://bugs.chromium.org/p/chromium/issues/detail?id=933436#c7
	} else {
		// iOS doesn't support FullScreen API.
		window.scrollTo(0, 0);
		fullScreenOverride = true;
	}
	resize();
	updateFullScreenNavigate();

	// change hover text and image
	const img = document.getElementById('ToggleFullScreen');
	img.src = 'images/nav/ic_fullscreen_exit_white_24dp_2x.png';
	img.title = 'Exit fullscreen';
};

const exitFullscreen = () => {
	// exit full-screen

	if (fullScreenOverride) {
		fullScreenOverride = false;
	}

	if (document.exitFullscreen) {
		// Chrome 71 broke this if the user pressed F11 to enter full screen mode.
		document.exitFullscreen();
	} else if (document.webkitExitFullscreen) {
		document.webkitExitFullscreen();
	} else if (document.mozCancelFullScreen) {
		document.mozCancelFullScreen();
	} else if (document.msExitFullscreen) {
		document.msExitFullscreen();
	}
	resize();
	// change hover text and image
	const img = document.getElementById('ToggleFullScreen');
	img.src = 'images/nav/ic_fullscreen_white_24dp_2x.png';
	img.title = 'Enter fullscreen';
};

const btnNavigateMenuClick = () => {
	postMessage('navButton', 'menu');
	updateFullScreenNavigate();
	return false;
};

const loadData = (_latLon, haveDataCallback) => {
	// if latlon is provided store it locally
	if (_latLon) loadData.latLon = _latLon;
	// get the data
	const { latLon } = loadData;
	// if there's no data stop
	if (!latLon) return;

	document.getElementById('txtAddress').blur();
	stopAutoRefreshTimer();
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
	updateFullScreenNavigate();

	return false;
};

const btnNavigateNextClick = () => {
	postMessage('navButton', 'next');
	updateFullScreenNavigate();

	return false;
};

const btnNavigatePreviousClick = () => {
	postMessage('navButton', 'previous');
	updateFullScreenNavigate();

	return false;
};

let navigateFadeIntervalId = null;

const updateFullScreenNavigate = () => {
	document.activeElement.blur();
	document.getElementById('divTwcBottom').classList.remove('hidden');
	document.getElementById('divTwcBottom').classList.add('visible');

	if (navigateFadeIntervalId) {
		clearTimeout(navigateFadeIntervalId);
		navigateFadeIntervalId = null;
	}

	navigateFadeIntervalId = setTimeout(() => {
		if (document.fullscreenElement) {
			document.getElementById('divTwcBottom').classList.remove('visible');
			document.getElementById('divTwcBottom').classList.add('hidden');
		}
	}, 2000);
};

const documentKeydown = (e) => {
	const { key } = e;

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
	updateFullScreenNavigate();

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
	const btn = document.getElementById('btnGetGps');

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

	const txtAddress = document.getElementById('txtAddress');
	txtAddress.value = `${round2(latitude, 4)}, ${round2(longitude, 4)}`;

	doRedirectToGeometry({ y: latitude, x: longitude }, (point) => {
		const location = point.properties.relativeLocation.properties;
		// Save the query
		const query = `${location.city}, ${location.state}`;
		localStorage.setItem('latLon', JSON.stringify({ lat: latitude, lon: longitude }));
		localStorage.setItem('latLonQuery', query);
		localStorage.setItem('latLonFromGPS', true);
		txtAddress.value = `${location.city}, ${location.state}`;
	});
};

import { json } from './modules/utils/fetch.mjs';
import noSleep from './modules/utils/nosleep.mjs';
import {
	message as navMessage, isPlaying, resize, resetStatuses, latLonReceived, stopAutoRefreshTimer, registerRefreshData,
} from './modules/navigation.mjs';

document.addEventListener('DOMContentLoaded', () => {
	init();
});

let FullScreenOverride = false;

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

	registerRefreshData(LoadTwcData);

	document.getElementById('NavigateMenu').addEventListener('click', btnNavigateMenuClick);
	document.getElementById('NavigateRefresh').addEventListener('click', btnNavigateRefreshClick);
	document.getElementById('NavigateNext').addEventListener('click', btnNavigateNextClick);
	document.getElementById('NavigatePrevious').addEventListener('click', btnNavigatePreviousClick);
	document.getElementById('NavigatePlay').addEventListener('click', btnNavigatePlayClick);
	document.getElementById('ToggleFullScreen').addEventListener('click', btnFullScreenClick);
	document.getElementById('btnGetGps').addEventListener('click', btnGetGpsClick);

	document.getElementById('divTwc').addEventListener('click', () => {
		if (document.fullscreenElement) UpdateFullScreenNavigate();
	});

	document.addEventListener('keydown', documentKeydown);
	document.addEventListener('touchmove', (e) => { if (FullScreenOverride) e.preventDefault(); });

	$('#frmGetLatLng #txtAddress').devbridgeAutocomplete({
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
			suggestions: $.map(response.suggestions, (i) => ({
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

	const ac = $('#frmGetLatLng #txtAddress').devbridgeAutocomplete();
	$('#frmGetLatLng').on('submit', () => {
		if (ac.suggestions[0]) $(ac.suggestionsContainer.children[0]).click();
		return false;
	});

	// Auto load the previous query
	const TwcQuery = localStorage.getItem('TwcQuery');
	const TwcLatLong = localStorage.getItem('TwcLatLon');
	if (TwcQuery && TwcLatLong) {
		const txtAddress = document.getElementById('txtAddress');
		txtAddress.value = TwcQuery;
		LoadTwcData(JSON.parse(TwcLatLong));
	}

	const TwcPlay = localStorage.getItem('TwcPlay');
	if (TwcPlay === null || TwcPlay === 'true') postMessage('navButton', 'play');

	document.getElementById('btnClearQuery').addEventListener('click', () => {
		document.getElementById('spanCity').innerHTML = '';
		document.getElementById('spanState').innerHTML = '';
		document.getElementById('spanStationId').innerHTML = '';
		document.getElementById('spanRadarId').innerHTML = '';
		document.getElementById('spanZoneId').innerHTML = '';

		localStorage.removeItem('TwcScrollText');
		localStorage.removeItem('TwcScrollTextChecked');

		document.getElementById('chkAutoRefresh').checked = true;
		localStorage.removeItem('TwcAutoRefresh');

		document.getElementById('radEnglish').checked = true;

		localStorage.removeItem('TwcPlay');
		postMessage('navButton', 'play');

		localStorage.removeItem('TwcQuery');
		localStorage.removeItem('TwcLatLon');
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
		doRedirectToGeometry(loc.feature.geometry);
	} else {
		console.error('An unexpected error occurred. Please try a different search string.');
	}
};

const doRedirectToGeometry = (geom) => {
	const latLon = { lat: Math.round2(geom.y, 4), lon: Math.round2(geom.x, 4) };
	// Save the query
	localStorage.setItem('TwcQuery', document.getElementById('txtAddress').value);
	localStorage.setItem('TwcLatLon', JSON.stringify(latLon));

	// get the data
	LoadTwcData(latLon);
};

const btnFullScreenClick = () => {
	if (!document.fullscreenElement) {
		EnterFullScreen();
	} else {
		ExitFullscreen();
	}

	if (isPlaying()) {
		noSleep(true);
	} else {
		noSleep(false);
	}

	UpdateFullScreenNavigate();

	return false;
};

const EnterFullScreen = () => {
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
		FullScreenOverride = true;
	}
	resize();
	UpdateFullScreenNavigate();

	// change hover text and image
	const img = document.getElementById('ToggleFullScreen');
	img.src = 'images/nav/ic_fullscreen_exit_white_24dp_1x.png';
	img.title = 'Exit fullscreen';
};

const ExitFullscreen = () => {
	// exit full-screen

	if (FullScreenOverride) {
		FullScreenOverride = false;
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
	img.src = 'images/nav/ic_fullscreen_white_24dp_1x.png';
	img.title = 'Enter fullscreen';
};

const btnNavigateMenuClick = () => {
	postMessage('navButton', 'menu');
	UpdateFullScreenNavigate();
	return false;
};

const LoadTwcData = (_latLon) => {
	// if latlon is provided store it locally
	if (_latLon) LoadTwcData.latLon = _latLon;
	// get the data
	const { latLon } = LoadTwcData;
	// if there's no data stop
	if (!latLon) return;

	document.getElementById('txtAddress').blur();
	stopAutoRefreshTimer();
	latLonReceived(latLon);
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
	LoadTwcData();
	UpdateFullScreenNavigate();

	return false;
};

const btnNavigateNextClick = () => {
	postMessage('navButton', 'next');
	UpdateFullScreenNavigate();

	return false;
};

const btnNavigatePreviousClick = () => {
	postMessage('navButton', 'previous');
	UpdateFullScreenNavigate();

	return false;
};

let NavigateFadeIntervalId = null;

const UpdateFullScreenNavigate = () => {
	document.activeElement.blur();
	document.getElementById('divTwcBottom').classList.remove('hidden');
	document.getElementById('divTwcBottom').classList.add('visible');

	if (NavigateFadeIntervalId) {
		clearTimeout(NavigateFadeIntervalId);
		NavigateFadeIntervalId = null;
	}

	NavigateFadeIntervalId = setTimeout(() => {
		if (document.fullscreenElement) {
			document.getElementById('divTwcBottom').classList.remove('visible');
			document.getElementById('divTwcBottom').classList.add('hidden');
		}
	}, 2000);
};

const documentKeydown = (e) => {
	const code = (e.keyCode || e.which);

	// 200ms repeat
	if ((Date.now() - documentKeydown.lastButton ?? 0) < 200) return false;
	documentKeydown.lastButton = Date.now();

	if (document.fullscreenElement || document.activeElement === document.body) {
		switch (code) {
		case 32: // Space
			btnNavigatePlayClick();
			return false;

		case 39: // Right Arrow
		case 34: // Page Down
			btnNavigateNextClick();
			return false;

		case 37: // Left Arrow
		case 33: // Page Up
			btnNavigatePreviousClick();
			return false;

		case 36: // Home
			btnNavigateMenuClick();
			return false;

		case 48: // Restart
			btnNavigateRefreshClick();
			return false;

		case 70: // F
			btnFullScreenClick();
			return false;

		default:
		}
	}
	return false;
};

Math.round2 = (value, decimals) => Number(`${Math.round(`${value}e${decimals}`)}e-${decimals}`);

const btnNavigatePlayClick = () => {
	postMessage('navButton', 'playToggle');
	UpdateFullScreenNavigate();

	return false;
};

// post a message to the iframe
const postMessage = (type, myMessage = {}) => {
	navMessage({ type, message: myMessage });
};

const btnGetGpsClick = async () => {
	if (!navigator.geolocation) return;

	const position = await (() => new Promise((resolve) => {
		navigator.geolocation.getCurrentPosition(resolve);
	}))();
	const { latitude, longitude } = position.coords;

	let data;
	try {
		data = await json('https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode', {
			data: {
				location: `${longitude},${latitude}`,
				distance: 1000, // Find location up to 1 KM.
				f: 'json',
			},
		});
	} catch (e) {
		console.error('Unable to fetch reverse geocode');
		console.error(e.status, e.responseJSONe);
	}
	const ZipCode = data.address.Postal;
	const { City } = data.address;
	const State = states.getTwoDigitCode(data.address.Region);
	const Country = data.address.CountryCode;
	const TwcQuery = `${ZipCode}, ${City}, ${State}, ${Country}`;

	const txtAddress = document.getElementById('txtAddress');
	txtAddress.value = TwcQuery;
	txtAddress.blur();
	txtAddress.focus();

	// Save the query
	localStorage.setItem('TwcQuery', TwcQuery);
};

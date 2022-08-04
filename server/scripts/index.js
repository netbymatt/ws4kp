/* globals NoSleep, states, navigation, UNITS, utils */
document.addEventListener('DOMContentLoaded', () => {
	index.init();
});

const index = (() => {
	const overrides = {
		// '32899, Orlando, Florida, USA': { x: -80.6774, y: 28.6143 },
	};
	const AutoRefreshIntervalMs = 500;
	const AutoRefreshTotalIntervalMs = 600000; // 10 min.

	let AutoSelectQuery = false;

	let LastUpdate = null;
	let AutoRefreshIntervalId = null;
	let AutoRefreshCountMs = 0;

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
	const cats = categories.join(',');

	const init = () => {
		document.getElementById('txtAddress').addEventListener('focus', (e) => {
			e.target.select();
		});

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
				category: cats,
				maxSuggestions: 10,
			},
			dataType: 'json',
			transformResult: (response) => {
				if (AutoSelectQuery) {
					AutoSelectQuery = false;
					window.setTimeout(() => {
						$(ac.suggestionsContainer.children[0]).click();
					}, 1);
				}

				return {
					suggestions: $.map(response.suggestions, (i) => ({
						value: i.text,
						data: i.magicKey,
					})),
				};
			},
			minChars: 3,
			showNoSuggestionNotice: true,
			noSuggestionNotice: 'No results found. Please try a different search string.',
			onSelect: autocompleteOnSelect,
			width: 490,
		});

		const ac = $('#frmGetLatLng #txtAddress').devbridgeAutocomplete();
		$('#frmGetLatLng').submit(() => {
			if (ac.suggestions[0]) $(ac.suggestionsContainer.children[0]).click();
			return false;
		});

		// Auto load the previous query
		const TwcQuery = localStorage.getItem('TwcQuery');
		if (TwcQuery) {
			AutoSelectQuery = true;
			const txtAddress = document.getElementById('txtAddress');
			txtAddress.value = TwcQuery;
			txtAddress.blur();
			txtAddress.focus();
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
			localStorage.removeItem('TwcUnits');

			localStorage.removeItem('TwcPlay');
			postMessage('navButton', 'play');

			localStorage.removeItem('TwcQuery');
		});

		const TwcUnits = localStorage.getItem('TwcUnits');
		if (!TwcUnits || TwcUnits === 'ENGLISH') {
			document.getElementById('radEnglish').checked = true;
			navigation.message({ type: 'units', message: 'english' });
		} else if (TwcUnits === 'METRIC') {
			document.getElementById('radMetric').checked = true;
			navigation.message({ type: 'units', message: 'metric' });
		}

		document.getElementById('radEnglish').addEventListener('change', changeUnits);
		document.getElementById('radMetric').addEventListener('change', changeUnits);

		document.getElementById('chkAutoRefresh').addEventListener('change', (e) => {
			const Checked = e.target.checked;

			if (LastUpdate) {
				if (Checked) {
					StartAutoRefreshTimer();
				} else {
					StopAutoRefreshTimer();
				}
			}

			localStorage.setItem('TwcAutoRefresh', Checked);
		});

		const TwcAutoRefresh = localStorage.getItem('TwcAutoRefresh');
		if (!TwcAutoRefresh || TwcAutoRefresh === 'true') {
			document.getElementById('chkAutoRefresh').checked = true;
		} else {
			document.getElementById('chkAutoRefresh').checked = false;
		}

		// swipe functionality
		document.getElementById('container').addEventListener('swiped-left', () => swipeCallBack('left'));
		document.getElementById('container').addEventListener('swiped-right', () => swipeCallBack('right'));
	};

	const changeUnits = (e) => {
		const Units = e.target.value;
		localStorage.setItem('TwcUnits', Units);
		AssignLastUpdate();
		postMessage('units', Units);
	};

	const autocompleteOnSelect = async (suggestion) => {
		// Do not auto get the same city twice.
		if (this.previousSuggestionValue === suggestion.value) return;

		if (overrides[suggestion.value]) {
			doRedirectToGeometry(overrides[suggestion.value]);
		} else {
			const data = await utils.fetch.json('https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/find', {
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
		}
	};

	const doRedirectToGeometry = (geom) => {
		const latLon = { lat: Math.round2(geom.y, 4), lon: Math.round2(geom.x, 4) };
		LoadTwcData(latLon);
		// Save the query
		localStorage.setItem('TwcQuery', document.getElementById('txtAddress').value);
	};

	const btnFullScreenClick = () => {
		if (!document.fullscreenElement) {
			EnterFullScreen();
		} else {
			ExitFullscreen();
		}

		if (navigation.isPlaying()) {
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

		UpdateFullScreenNavigate();
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
		StopAutoRefreshTimer();
		LastUpdate = null;
		AssignLastUpdate();

		postMessage('latLon', latLon);
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

	const AssignLastUpdate = () => {
		if (LastUpdate) {
			switch (navigation.units()) {
			case UNITS.english:
				LastUpdate = LastUpdate.toLocaleString('en-US', {
					weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', timeZoneName: 'short',
				});
				break;
			default:
				LastUpdate = LastUpdate.toLocaleString('en-GB', {
					weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', timeZoneName: 'short',
				});
				break;
			}
		}

		document.getElementById('spanLastRefresh').innerHTML = LastUpdate;

		if (LastUpdate && document.getElementById('chkAutoRefresh').checked) StartAutoRefreshTimer();
	};

	const btnNavigateRefreshClick = () => {
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

	// read and dispatch an event from the iframe
	const message = (data) => {
		const playButton = document.getElementById('NavigatePlay');
		// dispatch event
		if (!data.type) return;
		switch (data.type) {
		case 'loaded':
			LastUpdate = new Date();
			AssignLastUpdate();
			break;

		case 'weatherParameters':
			populateWeatherParameters(data.message);
			break;

		case 'isPlaying':
			localStorage.setItem('TwcPlay', navigation.isPlaying());

			if (navigation.isPlaying()) {
				noSleep(true);
				playButton.title = 'Pause';
				playButton.src = 'images/nav/ic_pause_white_24dp_1x.png';
			} else {
				noSleep(false);
				playButton.title = 'Play';
				playButton.src = 'images/nav/ic_play_arrow_white_24dp_1x.png';
			}
			break;

		default:
			console.error(`Unknown event '${data.eventType}`);
		}
	};

	// post a message to the iframe
	const postMessage = (type, myMessage = {}) => {
		navigation.message({ type, message: myMessage });
	};

	const StartAutoRefreshTimer = () => {
	// Ensure that any previous timer has already stopped.
		// check if timer is running
		if (AutoRefreshIntervalId) return;

		// Reset the time elapsed.
		AutoRefreshCountMs = 0;

		const AutoRefreshTimer = () => {
		// Increment the total time elapsed.
			AutoRefreshCountMs += AutoRefreshIntervalMs;

			// Display the count down.
			let RemainingMs = (AutoRefreshTotalIntervalMs - AutoRefreshCountMs);
			if (RemainingMs < 0) {
				RemainingMs = 0;
			}
			const dt = new Date(RemainingMs);
			document.getElementById('spanRefreshCountDown').innerHTML = `${dt.getMinutes() < 10 ? `0${dt.getMinutes()}` : dt.getMinutes()}:${dt.getSeconds() < 10 ? `0${dt.getSeconds()}` : dt.getSeconds()}`;

			// Time has elapsed.
			if (AutoRefreshCountMs >= AutoRefreshTotalIntervalMs) LoadTwcData();
		};
		AutoRefreshIntervalId = window.setInterval(AutoRefreshTimer, AutoRefreshIntervalMs);
		AutoRefreshTimer();
	};
	const StopAutoRefreshTimer = () => {
		if (AutoRefreshIntervalId) {
			window.clearInterval(AutoRefreshIntervalId);
			document.getElementById('spanRefreshCountDown').innerHTML = '--:--';
			AutoRefreshIntervalId = null;
		}
	};

	const btnGetGpsClick = async () => {
		if (!navigator.geolocation) return;

		const position = await (() => new Promise((resolve) => {
			navigator.geolocation.getCurrentPosition(resolve);
		}))();
		const { latitude, longitude } = position.coords;

		let data;
		try {
			data = await utils.fetch.json('https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode', {
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

	const populateWeatherParameters = (weatherParameters) => {
		document.getElementById('spanCity').innerHTML = `${weatherParameters.city}, `;
		document.getElementById('spanState').innerHTML = weatherParameters.state;
		document.getElementById('spanStationId').innerHTML = weatherParameters.stationId;
		document.getElementById('spanRadarId').innerHTML = weatherParameters.radarId;
		document.getElementById('spanZoneId').innerHTML = weatherParameters.zoneId;
	};

	// track state of nosleep locally to avoid a null case error
	// when nosleep.disable is called without first calling .enable
	let wakeLock = false;
	const noSleep = (enable = false) => {
		// get a nosleep controller
		if (!noSleep.controller) noSleep.controller = new NoSleep();
		// don't call anything if the states match
		if (wakeLock === enable) return false;
		// store the value
		wakeLock = enable;
		// call the function
		if (enable) return noSleep.controller.enable();
		return noSleep.controller.disable();
	};

	return {
		init,
		message,
	};
})();

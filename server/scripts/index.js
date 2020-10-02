'use strict';
/* globals NoSleep, states, navigation, UNITS */
document.addEventListener('DOMContentLoaded', () => {
	index.init();
});

const index = (() => {
	const overrides = {
		// '32899, Orlando, Florida, USA': { x: -80.6774, y: 28.6143 },
	};
	const _AutoRefreshIntervalMs = 500;
	const _AutoRefreshTotalIntervalMs = 600000; // 10 min.
	const _NoSleep = new NoSleep();

	let _AutoSelectQuery = false;

	let _LastUpdate = null;
	let _AutoRefreshIntervalId = null;
	let _AutoRefreshCountMs = 0;

	let _FullScreenOverride = false;

	const init = () => {
		document.getElementById('txtAddress').addEventListener('focus', (e) => {
			e.target.select();
		});

		document.getElementById('NavigateMenu').addEventListener('click', btnNavigateMenu_click);
		document.getElementById('NavigateRefresh').addEventListener('click', btnNavigateRefresh_click);
		document.getElementById('NavigateNext').addEventListener('click', btnNavigateNext_click);
		document.getElementById('NavigatePrevious').addEventListener('click', btnNavigatePrevious_click);
		document.getElementById('NavigatePlay').addEventListener('click', btnNavigatePlay_click);
		document.getElementById('ToggleFullScreen').addEventListener('click', btnFullScreen_click);
		document.getElementById('btnGetGps').addEventListener('click', btnGetGps_click);

		document.getElementById('divTwc').addEventListener('click', () => {
			if (document.fullscreenElement) UpdateFullScreenNavigate();
		});

		document.addEventListener('keydown', document_keydown);
		document.addEventListener('touchmove', e => { if (_FullScreenOverride) e.preventDefault(); });


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

		$('#frmGetLatLng #txtAddress').devbridgeAutocomplete({
			serviceUrl: location.protocol + '//geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/suggest',
			deferRequestBy: 300,
			paramName: 'text',
			params: {
				f: 'json',
				countryCode: 'USA', //'USA,PRI,VIR,GUM,ASM',
				category: cats,
				maxSuggestions: 10,
			},
			dataType: 'json',
			transformResult: (response) => {
				if (_AutoSelectQuery) {
					_AutoSelectQuery = false;
					window.setTimeout(() => {
						$(ac.suggestionsContainer.children[0]).click();
					}, 1);
				}

				return {
					suggestions: $.map(response.suggestions, function (i) {
						return {
							value: i.text,
							data: i.magicKey,
						};
					}),
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
			_AutoSelectQuery = true;
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
		} else if (TwcUnits === 'METRIC') {
			document.getElementById('radMetric').checked = true;
		}

		document.getElementById('radEnglish').addEventListener('change', changeUnits);
		document.getElementById('radMetric').addEventListener('change', changeUnits);

		document.getElementById('chkAutoRefresh').addEventListener('change', (e) => {
			const Checked = e.target.checked;

			if (_LastUpdate) {
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

	};

	const changeUnits = (e) => {
		const Units = e.target.value;
		e;
		localStorage.setItem('TwcUnits', Units);
		AssignLastUpdate();
		postMessage('units', Units);
	};

	const autocompleteOnSelect = (suggestion) => {
		let request;

		// Do not auto get the same city twice.
		if (this.previousSuggestionValue === suggestion.value)  return;

		if (overrides[suggestion.value]) {
			doRedirectToGeometry(overrides[suggestion.value]);
		} else {
			request = $.ajax({
				url: 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/find',
				data: {
					text: suggestion.value,
					magicKey: suggestion.data,
					f: 'json',
				},
			});
			request.done((data) => {
				const loc = data.locations[0];
				if (loc) {
					doRedirectToGeometry(loc.feature.geometry);
				} else {
					alert('An unexpected error occurred. Please try a different search string.');
				}
			});
		}
	};

	const doRedirectToGeometry = (geom) => {
		const latLon = {lat:Math.round2(geom.y, 4), lon:Math.round2(geom.x, 4)};
		LoadTwcData(latLon);
		// Save the query
		localStorage.setItem('TwcQuery', document.getElementById('txtAddress').value);
	};

	const btnFullScreen_click = () => {

		if (!document.fullscreenElement) {
			EnterFullScreen();
		} else {
			ExitFullscreen();
		}

		if (navigation.isPlaying()) {
			noSleepEnable();
		} else {
			noSleepDisable();
		}

		UpdateFullScreenNavigate();

		return false;
	};

	const EnterFullScreen = () => {
		const element = document.getElementById('divTwc');

		// Supports most browsers and their versions.
		const requestMethod = element.requestFullScreen || element.webkitRequestFullScreen || element.mozRequestFullScreen || element.msRequestFullscreen;

		if (requestMethod) {
		// Native full screen.
			requestMethod.call(element, { navigationUI: 'hide' }); // https://bugs.chromium.org/p/chromium/issues/detail?id=933436#c7
		} else {
		// iOS doesn't support FullScreen API.
			window.scrollTo(0, 0);
			_FullScreenOverride = true;
		}

		UpdateFullScreenNavigate();
	};

	const ExitFullscreen = () => {
	// exit full-screen

		if (_FullScreenOverride) {
			_FullScreenOverride = false;
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

	const btnNavigateMenu_click = () => {
		postMessage('navButton', 'menu');
		UpdateFullScreenNavigate();
		return false;
	};

	const LoadTwcData = (_latLon) => {
		// if latlon is provided store it locally
		if (_latLon) LoadTwcData.latLon = _latLon;
		// get the data
		const latLon = LoadTwcData.latLon;
		// if there's no data stop
		if (!latLon) return;

		document.getElementById('txtAddress').blur();
		StopAutoRefreshTimer();
		_LastUpdate = null;
		AssignLastUpdate();

		postMessage('latLon', latLon);

		const SwipeCallBack = (event, direction) => {
			switch (direction) {
			case 'left':
				btnNavigateNext_click();
				break;

			case 'right':
			default:
				btnNavigatePrevious_click();
				break;
			}
		};

		// display.swipe({
		// //Generic swipe handler for all directions
		// 	swipeRight: SwipeCallBack,
		// 	swipeLeft: SwipeCallBack,
		// });
	};

	const AssignLastUpdate = () => {
		let LastUpdate = '(None)';

		if (_LastUpdate) {
			switch (navigation.units()) {
			case UNITS.english:
				LastUpdate = _LastUpdate.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', timeZoneName: 'short' });
				break;
			default:
				LastUpdate = _LastUpdate.toLocaleString('en-GB', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', timeZoneName: 'short' });
				break;
			}
		}

		document.getElementById('spanLastRefresh').innerHTML = LastUpdate;

		if (_LastUpdate && document.getElementById('chkAutoRefresh').checked) StartAutoRefreshTimer();
	};

	const btnNavigateRefresh_click = () => {
		LoadTwcData();
		UpdateFullScreenNavigate();

		return false;
	};

	const btnNavigateNext_click = () => {
		postMessage('navButton', 'next');
		UpdateFullScreenNavigate();

		return false;
	};

	const btnNavigatePrevious_click = () => {
		postMessage('navButton', 'previous');
		UpdateFullScreenNavigate();

		return false;
	};

	let _NavigateFadeIntervalId = null;

	const UpdateFullScreenNavigate = () => {
		document.activeElement.blur();
		document.getElementById('divTwcBottom').classList.remove('hidden');
		document.getElementById('divTwcBottom').classList.add('visible');

		if (_NavigateFadeIntervalId) {
			clearTimeout(_NavigateFadeIntervalId);
			_NavigateFadeIntervalId = null;
		}

		_NavigateFadeIntervalId = setTimeout(() => {
			if (document.fullscreenElement) {
				document.getElementById('divTwcBottom').classList.remove('visible');
				document.getElementById('divTwcBottom').classList.add('hidden');
			}

		}, 2000);
	};

	const document_keydown = (e) => {

		const code = (e.keyCode || e.which);

		if (document.fullscreenElement || document.activeElement === document.body) {
			switch (code) {
			case 32: // Space
				btnNavigatePlay_click();
				return false;

			case 39: // Right Arrow
			case 34: // Page Down
				btnNavigateNext_click();
				return false;

			case 37: // Left Arrow
			case 33: // Page Up
				btnNavigatePrevious_click();
				return false;

			case 36: // Home
				btnNavigateMenu_click();
				return false;

			case 48: // Restart
				btnNavigateRefresh_click();
				return false;

			case 70: // F
				btnFullScreen_click();
				return false;

			default:
			}
		}
	};

	Math.round2 = (value, decimals) => Number(Math.round(value + 'e' + decimals) + 'e-' + decimals);

	const btnNavigatePlay_click = () => {
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
			_LastUpdate = new Date();
			AssignLastUpdate();
			break;

		case 'weatherParameters':
			populateWeatherParameters(data.message);
			break;

		case 'isPlaying':
			localStorage.setItem('TwcPlay', navigation.isPlaying());


			if (navigation.isPlaying()) {
				noSleepEnable();
				playButton.title = 'Pause';
				playButton.src = 'images/nav/ic_pause_white_24dp_1x.png';
			} else {
				noSleepDisable();
				playButton.title = 'Play';
				playButton.src = 'images/nav/ic_play_arrow_white_24dp_1x.png';
			}
			break;


		default:
			console.error(`Unknown event '${data.eventType}`);
		}
	};

	// post a message to the iframe
	const postMessage = (type, message = {}) => {
		navigation.message({type, message});
	};

	const StartAutoRefreshTimer = () => {
	// Ensure that any previous timer has already stopped.
		// check if timer is running
		if (_AutoRefreshIntervalId) return;

		// Reset the time elapsed.
		_AutoRefreshCountMs = 0;

		const AutoRefreshTimer = () => {
		// Increment the total time elapsed.
			_AutoRefreshCountMs += _AutoRefreshIntervalMs;

			// Display the count down.
			let RemainingMs = (_AutoRefreshTotalIntervalMs - _AutoRefreshCountMs);
			if (RemainingMs < 0) {
				RemainingMs = 0;
			}
			const dt = new Date(RemainingMs);
			document.getElementById('spanRefreshCountDown').innerHTML = (dt.getMinutes() < 10 ? '0' + dt.getMinutes() : dt.getMinutes()) + ':' + (dt.getSeconds() < 10 ? '0' + dt.getSeconds() : dt.getSeconds());

			// Time has elapsed.
			if (_AutoRefreshCountMs >= _AutoRefreshTotalIntervalMs) LoadTwcData();
		};
		_AutoRefreshIntervalId = window.setInterval(AutoRefreshTimer, _AutoRefreshIntervalMs);
		AutoRefreshTimer();
	};
	const StopAutoRefreshTimer = () => {
		if (_AutoRefreshIntervalId) {
			window.clearInterval(_AutoRefreshIntervalId);
			document.getElementById('spanRefreshCountDown').innerHTML = '--:--';
			_AutoRefreshIntervalId = null;
		}
	};

	const btnGetGps_click = async () => {
		if (!navigator.geolocation) return;

		const position = await (() => {
			return new Promise(resolve => {
				navigator.geolocation.getCurrentPosition(resolve);
			});
		})();
		const latitude = position.coords.latitude;
		const longitude = position.coords.longitude;

		let data;
		try {
			data = await $.ajax({
				url: location.protocol + '//geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode',
				data: {
					location: longitude + ',' + latitude,
					distance: 1000, // Find location up to 1 KM.
					f: 'json',
				},
			});
		} catch (e) {
			console.error('Unable to fetch reverse geocode');
			console.error(e.status, e.responseJSONe);
		}
		const ZipCode = data.address.Postal;
		const City = data.address.City;
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

		document.getElementById('spanCity').innerHTML = weatherParameters.city + ', ';
		document.getElementById('spanState').innerHTML = weatherParameters.state;
		document.getElementById('spanStationId').innerHTML = weatherParameters.stationId;
		document.getElementById('spanRadarId').innerHTML = weatherParameters.radarId;
		document.getElementById('spanZoneId').innerHTML = weatherParameters.zoneId;
	};

	// track state of nosleep locally to avoid a null case error when nosleep.disable is called without first calling .enable
	let wakeLock = false;
	const noSleepEnable = () => {
		_NoSleep.enable();
		wakeLock = true;
	};
	const noSleepDisable = () => {
		if (!wakeLock) return;
		_NoSleep.disable();
		wakeLock = false;
	};

	return {
		init,
		message,
	};

})();
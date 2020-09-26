/* globals NoSleep, states, navigation */
$(() => {
	index.init();
});

const index = (() => {
	const overrides = {
		// '32899, Orlando, Florida, USA': { x: -80.6774, y: 28.6143 },
	};
	const _AutoRefreshIntervalMs = 500;
	const _AutoRefreshTotalIntervalMs = 600000; // 10 min.
	const _NoSleep = new NoSleep();

	let divTwcBottom;

	let _AutoSelectQuery = false;

	let _LastUpdate = null;
	let _AutoRefreshIntervalId = null;
	let _AutoRefreshCountMs = 0;

	let _FullScreenOverride = false;

	const init = () => {
		divTwcBottom = $('#divTwcBottom');
		$('#txtAddress').on('focus', (e) => {
			$(e.target).select();
		}).focus();

		$('.NavigateMenu').on('click', btnNavigateMenu_click);
		$('.NavigateRefresh').on('click', btnNavigateRefresh_click);
		$('.NavigateNext').on('click', btnNavigateNext_click);
		$('.NavigatePrevious').on('click', btnNavigatePrevious_click);
		$('.NavigatePlay').on('click', btnNavigatePlay_click);

		$('#btnGetGps').on('click', btnGetGps_click);

		$('#divTwc').on('click', (e) => {
			if (document.fullscreenElement) UpdateFullScreenNavigate(e);
		});

		$(document).on('keydown', document_keydown);
		document.addEventListener('touchmove', e => { if (_FullScreenOverride) e.preventDefault(); });
		$('.ToggleFullScreen').on('click', btnFullScreen_click);

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
			$('#txtAddress').val(TwcQuery)
				.blur()
				.focus();
		}

		const TwcPlay = localStorage.getItem('TwcPlay');
		if (TwcPlay === null || TwcPlay === 'true') postMessage('navButton', 'play');

		$('#btnClearQuery').on('click', () => {
			$('#spanCity').text('');
			$('#spanState').text('');
			$('#spanStationId').text('');
			$('#spanRadarId').text('');
			$('#spanZoneId').text('');

			localStorage.removeItem('TwcScrollText');
			localStorage.removeItem('TwcScrollTextChecked');

			$('#chkAutoRefresh').prop('checked', 'checked');
			localStorage.removeItem('TwcAutoRefresh');

			$('#radEnglish').prop('checked', 'checked');
			localStorage.removeItem('TwcUnits');

			localStorage.removeItem('TwcPlay');
			postMessage('navButton', 'play');

			localStorage.removeItem('TwcQuery');
		});

		const TwcUnits = localStorage.getItem('TwcUnits');
		if (!TwcUnits || TwcUnits === 'ENGLISH') {
			$('#radEnglish').prop('checked', 'checked');
		} else if (TwcUnits === 'METRIC') {
			$('#radMetric').prop('checked', 'checked');
		}

		$('input[type=\'radio\'][name=\'radUnits\']').on('change', (e) => {
			const Units = $(e.target).val();
			e;
			localStorage.setItem('TwcUnits', Units);
			AssignLastUpdate();
			postMessage('units', Units);
		});

		$('#chkAutoRefresh').on('change', (e) => {
			const Checked = $(e.target).is(':checked');

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
			$('#chkAutoRefresh').prop('checked', 'checked');
		} else {
			$('#chkAutoRefresh').prop('checked', '');
		}

	};

	const autocompleteOnSelect = (suggestion) => {
		let request;

		// Do not auto get the same city twice.
		if (this.previousSuggestionValue === suggestion.value)  return;

		if (overrides[suggestion.value]) {
			doRedirectToGeometry(overrides[suggestion.value]);
		} else {
			request = $.ajax({
				url: location.protocol + '//geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/find',
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
		localStorage.setItem('TwcQuery', $('#txtAddress').val());
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
			$(window).resize();
		}

		UpdateFullScreenNavigate();
	};

	const ExitFullscreen = () => {
	// exit full-screen

		if (_FullScreenOverride) {
			_FullScreenOverride = false;
			$(window).resize();
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

		$('#txtAddress').blur();
		StopAutoRefreshTimer();
		_LastUpdate = null;
		AssignLastUpdate();

		postMessage('latLon', latLon);

		postMessage('units', $('input[type=\'radio\'][name=\'radUnits\']:checked').val());

		const display = $('#display');
		display.on('keydown', document_keydown);

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

		display.swipe({
		//Generic swipe handler for all directions
			swipeRight: SwipeCallBack,
			swipeLeft: SwipeCallBack,
		});
	};

	const AssignLastUpdate = () => {
		let LastUpdate = '(None)';

		if (_LastUpdate) {
			switch ($('input[type=\'radio\'][name=\'radUnits\']:checked').val()) {
			case 'ENGLISH':
				LastUpdate = _LastUpdate.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', timeZoneName: 'short' });
				break;
			default:
				LastUpdate = _LastUpdate.toLocaleString('en-GB', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', timeZoneName: 'short' });
				break;
			}
		}

		$('#spanLastRefresh').html(LastUpdate);

		if (_LastUpdate && $('#chkAutoRefresh').is(':checked')) StartAutoRefreshTimer();
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
		$(document.activeElement).blur();
		divTwcBottom.fadeIn2();

		if (_NavigateFadeIntervalId) {
			clearTimeout(_NavigateFadeIntervalId);
			_NavigateFadeIntervalId = null;
		}

		_NavigateFadeIntervalId = setTimeout(() => {
			if (document.fullscreenElement) {
				divTwcBottom.fadeOut2();
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

	$.fn.fadeIn2 = function () {
		const _self = this;
		let opacity = 0.0;
		let IntervalId = null;

		if (_self.css('opacity') !== '0') return;

		_self.css('visibility', 'visible');
		_self.css('opacity', '0.0');

		IntervalId = window.setInterval(() => {
			opacity += 0.1;
			opacity = Math.round2(opacity, 1);
			_self.css('opacity', opacity.toString());

			if (opacity === 1.0) {
			//_self.css("visibility", "");
				_self.css('visibility', 'visible');
				window.clearInterval(IntervalId);
			}
		}, 50);

		return _self;
	};

	$.fn.fadeOut2 = function () {
		const _self = this;
		let opacity = 1.0;
		let IntervalId = null;

		if (_self.css('opacity') !== '1')  return;

		_self.css('visibility', 'visible');
		_self.css('opacity', '1.0');

		IntervalId = window.setInterval(() => {
			opacity -= 0.2;
			opacity = Math.round2(opacity, 1);
			_self.css('opacity', opacity.toString());

			if (opacity === 0) {
				_self.css('visibility', 'hidden');
				window.clearInterval(IntervalId);
			}
		}, 50);

		return _self;
	};

	Math.round2 = (value, decimals) => Number(Math.round(value + 'e' + decimals) + 'e-' + decimals);

	const btnNavigatePlay_click = () => {
		postMessage('navButton', 'playToggle');
		UpdateFullScreenNavigate();

		return false;
	};

	// read and dispatch an event from the iframe
	const message = (data) => {
	// test for trust
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
				$('img[src=\'images/nav/ic_play_arrow_white_24dp_1x.png\']').attr('title', 'Pause');
				$('img[src=\'images/nav/ic_play_arrow_white_24dp_1x.png\']').attr('src', 'images/nav/ic_pause_white_24dp_1x.png');
				$('img[src=\'images/nav/ic_play_arrow_white_24dp_2x.png\']').attr('title', 'Pause');
				$('img[src=\'images/nav/ic_play_arrow_white_24dp_2x.png\']').attr('src', 'images/nav/ic_pause_white_24dp_2x.png');
			} else {
				noSleepDisable();

				$('img[src=\'images/nav/ic_pause_white_24dp_1x.png\']').attr('title', 'Play');
				$('img[src=\'images/nav/ic_pause_white_24dp_1x.png\']').attr('src', 'images/nav/ic_play_arrow_white_24dp_1x.png');
				$('img[src=\'images/nav/ic_pause_white_24dp_2x.png\']').attr('title', 'Play');
				$('img[src=\'images/nav/ic_pause_white_24dp_2x.png\']').attr('src', 'images/nav/ic_play_arrow_white_24dp_2x.png');
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
			$('#spanRefreshCountDown').html((dt.getMinutes() < 10 ? '0' + dt.getMinutes() : dt.getMinutes()) + ':' + (dt.getSeconds() < 10 ? '0' + dt.getSeconds() : dt.getSeconds()));

			// Time has elapsed.
			if (_AutoRefreshCountMs >= _AutoRefreshTotalIntervalMs) LoadTwcData();
		};
		_AutoRefreshIntervalId = window.setInterval(AutoRefreshTimer, _AutoRefreshIntervalMs);
		AutoRefreshTimer();
	};
	const StopAutoRefreshTimer = () => {
		if (_AutoRefreshIntervalId) {
			window.clearInterval(_AutoRefreshIntervalId);
			$('#spanRefreshCountDown').html('--:--');
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

		$('#txtAddress').val(TwcQuery)
			.blur()
			.focus();

		// Save the query
		localStorage.setItem('TwcQuery', TwcQuery);
	};

	const populateWeatherParameters = (weatherParameters) => {

		$('#spanCity').text(weatherParameters.city + ', ');
		$('#spanState').text(weatherParameters.state);
		$('#spanStationId').text(weatherParameters.stationId);
		$('#spanRadarId').text(weatherParameters.radarId);
		$('#spanZoneId').text(weatherParameters.zoneId);
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
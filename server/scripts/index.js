/* globals NoSleep, states */
let frmGetLatLng;
let txtAddress;
let btnClearQuery;
let btnGetGps;

let divTwc;
let divTwcTop;
let divTwcMiddle;
let divTwcBottom;
let divTwcLeft;
let divTwcRight;
let divTwcNavContainer;
let iframeTwc;

let spanLastRefresh;
let chkAutoRefresh;
let spanRefreshCountDown;

let spanCity;
let spanState;
let spanStationId;
let spanRadarId;
let spanZoneId;

let frmScrollText;
let chkScrollText;
let txtScrollText;

let _AutoSelectQuery = false;
let _TwcDataUrl = '';
let _IsPlaying = false;

let _NoSleep = new NoSleep();

let _LastUpdate = null;
let _AutoRefreshIntervalId = null;
let _AutoRefreshIntervalMs = 500;
let _AutoRefreshTotalIntervalMs = 600000; // 10 min.
let _AutoRefreshCountMs = 0;

let _FullScreenOverride = false;

let _WindowHeight = 0;
let _WindowWidth = 0;

let latLon;

let _canvasIds = [
	'canvasProgress',
	'canvasCurrentWeather',
	'canvasLatestObservations',
	'canvasTravelForecast',
	'canvasRegionalForecast1',
	'canvasRegionalForecast2',
	'canvasRegionalObservations',
	'canvasLocalForecast',
	'canvasExtendedForecast1',
	'canvasExtendedForecast2',
	'canvasAlmanac',
	'canvasAlmanacTides',
	'canvasOutlook',
	'canvasMarineForecast',
	'canvasAirQuality',
	'canvasLocalRadar',
	'canvasHazards',
];

const FullScreenResize = () => {
	const iframeDoc = $(iframeTwc[0].contentWindow.document);
	const WindowWidth = $(window).width();
	const WindowHeight = $(window).height();
	const inFullScreen = InFullScreen();
	let NewWidth;
	let NewHeight;
	let IFrameWidth;
	let IFrameHeight;
	let LeftWidth;
	let RightWidth;
	let TopHeight;
	let BottomHeight;
	let Offset;

	if (inFullScreen) {
		if ((WindowWidth / WindowHeight) >= 1.583333333333333) {
			NewHeight = WindowHeight + 'px';
			NewWidth = '';
			divTwcTop.hide();
			divTwcBottom.hide();
			divTwcLeft.show();
			divTwcRight.show();

			divTwcMiddle.attr('style', 'width:100%; height:100%; border:none; margin:0; padding:0; overflow:hidden; z-index:999999;');

			LeftWidth = ((WindowWidth - (WindowHeight * 1.33333333333333333333)) / 2);
			if (LeftWidth < 60) {
				LeftWidth = 60;
			}
			divTwcLeft.attr('style', 'width:' + LeftWidth + 'px; height:100%; border:none; margin:0; padding:0; overflow:hidden; z-index:999999;');
			divTwcLeft.css('visibility', 'visible');

			RightWidth = ((WindowWidth - (WindowHeight * 1.33333333333333333333)) / 2);
			if (RightWidth < 60) {
				RightWidth = 60;
			}
			divTwcRight.attr('style', 'width:' + RightWidth + 'px; height:100%; border:none; margin:0; padding:0; overflow:hidden; z-index:999999;');
			divTwcRight.css('visibility', 'visible');

			IFrameWidth = WindowWidth - LeftWidth - RightWidth;
			NewWidth = IFrameWidth + 'px';
			iframeTwc.attr('style', 'width:' + IFrameWidth + 'px; height:100%; border:none; margin:0; padding:0; overflow:hidden; z-index:999999;');

		} else {
			NewHeight = '';
			NewWidth = WindowWidth + 'px';
			divTwcTop.show();
			divTwcBottom.show();
			divTwcLeft.hide();
			divTwcRight.hide();
			Offset = 0;

			TopHeight = ((WindowHeight - ((WindowWidth - Offset) * 0.75)) / 2);
			if (TopHeight < 0) {
				TopHeight = 0;
			}
			divTwcTop.attr('style', 'width:100%; height:' + TopHeight + 'px; border:none; margin:0; padding:0; overflow:hidden; z-index:999999;');

			BottomHeight = ((WindowHeight - ((WindowWidth - Offset) * 0.75)) / 2);
			if (BottomHeight < 30) {
				BottomHeight = 30;
			}
			divTwcBottom.attr('style', 'width:100%; height:' + BottomHeight + 'px; border:none; margin:0; padding:0; overflow:hidden; z-index:999999;');
			divTwcBottom.css('visibility', 'visible');

			IFrameHeight = WindowHeight - TopHeight - BottomHeight;
			NewHeight = IFrameHeight + 'px';
			iframeTwc.attr('style', 'width:100%; height:' + IFrameHeight + 'px; border:none; margin:0; padding:0; overflow:hidden; z-index:999999;');
			divTwcMiddle.attr('style', 'width:100%; height:' + IFrameHeight + 'px; border:none; margin:0; padding:0; overflow:hidden; z-index:999999;');
		}
	}

	if (!inFullScreen) {
		NewHeight = '';
		NewWidth = '';
		divTwcTop.hide();
		divTwcBottom.hide();
		divTwcLeft.hide();
		divTwcRight.hide();

		divTwc.attr('style', '');
		divTwcMiddle.attr('style', '');
		iframeTwc.attr('style', '');

		$(window).off('resize', FullScreenResize);
	}

	$(_canvasIds).each(function () {
		const canvas = iframeDoc.find('#' + this.toString());
		canvas.css('width', NewWidth);
		canvas.css('height', NewHeight);
	});

	if (inFullScreen) {
		$('body').css('overflow', 'hidden');
		$('.ToggleFullScreen').val('Exit Full Screen');

		if (!GetFullScreenElement()) {
			EnterFullScreen();
		}
	} else {
		$('body').css('overflow', '');
		$('.ToggleFullScreen').val('Full Screen');
	}

	divTwcNavContainer.show();
};

const _lockOrientation = screen.lockOrientation || screen.mozLockOrientation || screen.msLockOrientation;
const _unlockOrientation = screen.unlockOrientation || screen.mozUnlockOrientation || screen.msUnlockOrientation || (screen.orientation && screen.orientation.unlock);

const OnFullScreen = () => {
	if (InFullScreen()) {
		divTwc.attr('style', 'position:fixed; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%; border:none; margin:0; padding:0; overflow:hidden; z-index:999999;');
		FullScreenResize();

		$(window).on('resize', FullScreenResize);
		//FullScreenResize();

		if (_lockOrientation) try { _lockOrientation('landscape-primary'); } catch (ex) { console.log('Unable to lock screen orientation.'); }
	} else {
		divTwc.attr('style', '');
		divTwcMiddle.attr('style', '');
		iframeTwc.attr('style', '');

		$(window).off('resize', FullScreenResize);
		FullScreenResize();

		if (_unlockOrientation) try { _unlockOrientation(); } catch (ex) { console.log('Unable to unlock screen orientation.'); }
	}
};

const InFullScreen = () => ((_FullScreenOverride) || (GetFullScreenElement()) || (window.innerHeight === screen.height) || (window.innerHeight === (screen.height - 1)));

const GetFullScreenElement = () => {
	if (_FullScreenOverride) return document.body;
	return (document.fullScreenElement || document.mozFullScreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
};

const btnFullScreen_click = () => {

	if (!InFullScreen()) {
		EnterFullScreen();
	} else {
		ExitFullscreen();
	}

	if (_IsPlaying) {
		_NoSleep.enable();
	} else {
		_NoSleep.disable();
	}

	UpdateFullScreenNavigate();

	return false;
};

const EnterFullScreen = () => {
	const element = document.body;

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

const LoadTwcData = () => {
	txtAddress.blur();
	StopAutoRefreshTimer();
	_LastUpdate = null;
	AssignLastUpdate();

	postMessage('latLon', latLon);

	iframeTwc.off('load');
	FullScreenResize();

	if (chkScrollText.is(':checked')) {
		postMessage('assignScrollText', txtScrollText.val());
	}

	postMessage('units', $('input[type=\'radio\'][name=\'radUnits\']:checked').val());


	if (_IsPlaying) postMessage('navButton', 'playToggle');

	$(iframeTwc[0].contentWindow.document).on('mousemove', document_mousemove);
	$(iframeTwc[0].contentWindow.document).on('mousedown', document_mousemove);
	$(iframeTwc[0].contentWindow.document).on('keydown', document_keydown);

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

	$(iframeTwc[0].contentWindow.document).swipe({
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

	spanLastRefresh.html(LastUpdate);

	if (_LastUpdate && chkAutoRefresh.is(':checked')) StartAutoRefreshTimer();
};

const btnNavigateRefresh_click = () => {
	LoadTwcData(_TwcDataUrl);
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

const window_resize = () => {
	const $window = $(window);

	if ($window.height() === _WindowHeight || $window.width() === _WindowWidth) return;

	_WindowHeight = $window.height();
	_WindowWidth = $window.width();

	try {
		postMessage('navButton', 'reset');
	} catch (ex) {
		console.log(ex);
	}

	UpdateFullScreenNavigate();
};

let _NavigateFadeIntervalId = null;

const UpdateFullScreenNavigate = () => {
	$(document.activeElement).blur();

	$('body').removeClass('HideCursor');
	$(iframeTwc[0].contentWindow.document).find('body').removeClass('HideCursor');
	divTwcLeft.fadeIn2();
	divTwcRight.fadeIn2();
	divTwcBottom.fadeIn2();

	if (_NavigateFadeIntervalId) {
		window.clearTimeout(_NavigateFadeIntervalId);
		_NavigateFadeIntervalId = null;
	}

	_NavigateFadeIntervalId = window.setTimeout(() => {
		//console.log("window_mousemove: TimeOut");
		if (InFullScreen()) {
			$('body').addClass('HideCursor');
			$(iframeTwc[0].contentWindow.document).find('body').addClass('HideCursor');

			divTwcLeft.fadeOut2();
			divTwcRight.fadeOut2();
			divTwcBottom.fadeOut2();
		}

	}, 2000);
};

const document_mousemove = (e) => {
	if (InFullScreen() && (e.originalEvent.movementX === 0 && e.originalEvent.movementY === 0 && e.originalEvent.buttons === 0)) return;
	UpdateFullScreenNavigate();
};

const document_keydown = (e) => {

	const code = (e.keyCode || e.which);

	if (InFullScreen() || document.activeElement === document.body) {
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

$(() => {
	_WindowHeight = $(window).height();
	_WindowWidth = $(window).width();

	frmGetLatLng = $('#frmGetLatLng');
	txtAddress = $('#txtAddress');
	btnGetLatLng = $('#btnGetLatLng');
	btnClearQuery = $('#btnClearQuery');
	btnGetGps = $('#btnGetGps');

	divLat = $('#divLat');
	spanLat = $('#spanLat');
	divLng = $('#divLng');
	spanLng = $('#spanLng');

	iframeTwc = $('#iframeTwc');
	btnFullScreen = $('#btnFullScreen');
	divTwc = $('#divTwc');
	divTwcTop = $('#divTwcTop');
	divTwcMiddle = $('#divTwcMiddle');
	divTwcBottom = $('#divTwcBottom');
	divTwcLeft = $('#divTwcLeft');
	divTwcRight = $('#divTwcRight');
	divTwcNav = $('#divTwcNav');
	divTwcNavContainer = $('#divTwcNavContainer');

	frmScrollText = $('#frmScrollText');
	chkScrollText = $('#chkScrollText');
	txtScrollText = $('#txtScrollText');
	btnScrollText = $('#btnScrollText');

	frmScrollText.on('submit', frmScrollText_submit);
	txtScrollText.on('focus', function () {
		txtScrollText.select();
	});
	chkScrollText.on('change', chkScrollText_change);

	txtAddress.on('focus', function () {
		txtAddress.select();
	});

	txtAddress.focus();

	$('.NavigateMenu').on('click', btnNavigateMenu_click);
	$('.NavigateRefresh').on('click', btnNavigateRefresh_click);
	$('.NavigateNext').on('click', btnNavigateNext_click);
	$('.NavigatePrevious').on('click', btnNavigatePrevious_click);
	$('.NavigatePlay').on('click', btnNavigatePlay_click);

	$(btnGetGps).on('click', btnGetGps_click);

	$(window).on('resize', OnFullScreen);
	$(window).on('resize', window_resize);
	$(document).on('mousemove', document_mousemove);
	$(document).on('mousedown', document_mousemove);
	divTwc.on('mousedown', document_mousemove);
	$(document).on('keydown', document_keydown);
	document.addEventListener('touchmove', e => { if (_FullScreenOverride) e.preventDefault(); });
	$('.ToggleFullScreen').on('click', btnFullScreen_click);
	FullScreenResize();

	// listen for messages (from iframe) and handle accordingly
	window.addEventListener('message', messageHandler, false);

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

	const overrides = {
		'08736, Manasquan, New Jersey, USA': { x: -74.037, y: 40.1128 },
		'32899, Orlando, Florida, USA': { x: -80.6774, y: 28.6143 },
		'97003, Beaverton, Oregon, USA': { x: -122.8752489, y: 45.5050916 },
		'99734, Prudhoe Bay, Alaska, USA': { x: -148.3372, y: 70.2552 },
		'Guam, Oceania': { x: 144.74, y: 13.46 },
		'Andover, Maine, United States': { x: -70.7525, y: 44.634167 },
		'Bear Creek, Pennsylvania, United States': { x: -75.772809, y: 41.204074 },
		'Bear Creek Village, Pennsylvania, United States': { x: -75.772809, y: 41.204074 },
		'New York City, New York, United States': { x: -74.0059, y: 40.7142 },
		'Pinnacles National Monument, San Benito County,California, United States': { x: -121.147278, y: 36.47075 },
		'Pinnacles National Park, CA-146, Paicines, California': { x: -121.147278, y: 36.47075 },
		'Welcome, Maryland, United States': { x: -77.081212, y: 38.4692469 },
		'Tampa, Florida, United States (City)': { x: -82.5329, y: 27.9756 },
		'San Francisco, California, United States': { x: -122.3758, y: 37.6188 },
	};

	const roundToPlaces = function (num, decimals) {
		var n = Math.pow(10, decimals);
		return Math.round((n * num).toFixed(decimals)) / n;
	};

	const doRedirectToGeometry = (geom) => {
		latLon = {lat:roundToPlaces(geom.y, 4), lon:roundToPlaces(geom.x, 4)};
		LoadTwcData();
		// Save the query
		localStorage.setItem('TwcQuery', txtAddress.val());
	};

	let PreviousSeggestionValue = null;
	let PreviousSeggestion = null;
	const OnSelect = (suggestion) => {
		let request;

		// Do not auto get the same city twice.
		if (PreviousSeggestionValue === suggestion.value)  return;
		PreviousSeggestionValue = suggestion.value;
		PreviousSeggestion = suggestion;

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
				jsonp: 'callback',
				dataType: 'jsonp',
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
		dataType: 'jsonp',
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
		onSelect: OnSelect,
		width: 490,
	});

	const ac = $('#frmGetLatLng #txtAddress').devbridgeAutocomplete();
	frmGetLatLng.submit(function () {
		if (ac.suggestions[0]) {
			$(ac.suggestionsContainer.children[0]).click();
			return false;
		}
		if (PreviousSeggestion) {
			PreviousSeggestionValue = null;
			OnSelect(PreviousSeggestion);
		}

		return false;
	});

	// Auto load the previous query
	const TwcQuery = localStorage.getItem('TwcQuery');
	if (TwcQuery) {
		_AutoSelectQuery = true;
		txtAddress.val(TwcQuery);
		txtAddress.blur();
		txtAddress.focus();
	}

	const TwcPlay = localStorage.getItem('TwcPlay');
	if (!TwcPlay || TwcPlay === 'true') {
		_IsPlaying = true;
	}

	const TwcScrollText = localStorage.getItem('TwcScrollText');
	if (TwcScrollText) {
		txtScrollText.val(TwcScrollText);
	}
	const TwcScrollTextChecked = localStorage.getItem('TwcScrollTextChecked');
	if (TwcScrollTextChecked && TwcScrollTextChecked === 'true') {
		chkScrollText.prop('checked', 'checked');
	} else {
		chkScrollText.prop('checked', '');
	}

	btnClearQuery.on('click', () => {
		spanCity.text('');
		spanState.text('');
		spanStationId.text('');
		spanRadarId.text('');
		spanZoneId.text('');

		chkScrollText.prop('checked', '');
		txtScrollText.val('');
		localStorage.removeItem('TwcScrollText');
		localStorage.removeItem('TwcScrollTextChecked');

		chkAutoRefresh.prop('checked', 'checked');
		localStorage.removeItem('TwcAutoRefresh');

		$('#radEnglish').prop('checked', 'checked');
		localStorage.removeItem('TwcUnits');

		TwcCallBack({ Status: 'ISPLAYING', Value: false });
		localStorage.removeItem('TwcPlay');
		_IsPlaying = true;

		localStorage.removeItem('TwcQuery');
		PreviousSeggestionValue = null;
		PreviousSeggestion = null;

		LoadTwcData('');
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


	divRefresh = $('#divRefresh');
	spanLastRefresh = $('#spanLastRefresh');
	chkAutoRefresh = $('#chkAutoRefresh');
	lblRefreshCountDown = $('#lblRefreshCountDown');
	spanRefreshCountDown = $('#spanRefreshCountDown');

	chkAutoRefresh.on('change', (e) => {
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
		chkAutoRefresh.prop('checked', 'checked');
	} else {
		chkAutoRefresh.prop('checked', '');
	}

	spanCity = $('#spanCity');
	spanState = $('#spanState');
	spanStationId = $('#spanStationId');
	spanRadarId = $('#spanRadarId');
	spanZoneId = $('#spanZoneId');


});
// read and dispatch an event from the iframe
const messageHandler = (event) => {
	// test for trust
	if (!event.isTrusted) return;
	// get the data
	const data = JSON.parse(event.data);

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
		_IsPlaying = data.message;
		localStorage.setItem('TwcPlay', _IsPlaying);

		if (_IsPlaying) {
			_NoSleep.enable();

			$('img[src=\'images/nav/ic_play_arrow_white_24dp_1x.png\']').attr('title', 'Pause');
			$('img[src=\'images/nav/ic_play_arrow_white_24dp_1x.png\']').attr('src', 'images/nav/ic_pause_white_24dp_1x.png');
			$('img[src=\'images/nav/ic_play_arrow_white_24dp_2x.png\']').attr('title', 'Pause');
			$('img[src=\'images/nav/ic_play_arrow_white_24dp_2x.png\']').attr('src', 'images/nav/ic_pause_white_24dp_2x.png');
		} else {
			_NoSleep.disable();

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
	const iframeWindow = document.getElementById('iframeTwc').contentWindow;
	iframeWindow.postMessage(JSON.stringify({type, message}, window.location.origin));
};

const StartAutoRefreshTimer = () => {
	// Esnure that any previous timer has already stopped.
	//StopAutoRefreshTimer();
	if (_AutoRefreshIntervalId) {
		// Timer is already running.
		return;
	}

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
		spanRefreshCountDown.html((dt.getMinutes() < 10 ? '0' + dt.getMinutes() : dt.getMinutes()) + ':' + (dt.getSeconds() < 10 ? '0' + dt.getSeconds() : dt.getSeconds()));

		// Time has elapsed.
		if (_AutoRefreshCountMs >= _AutoRefreshTotalIntervalMs) LoadTwcData(_TwcDataUrl);
	};
	_AutoRefreshIntervalId = window.setInterval(AutoRefreshTimer, _AutoRefreshIntervalMs);
	AutoRefreshTimer();
};
const StopAutoRefreshTimer = () => {
	if (_AutoRefreshIntervalId) {
		window.clearInterval(_AutoRefreshIntervalId);
		spanRefreshCountDown.html('--:--');
		_AutoRefreshIntervalId = null;
	}
};

const btnGetGps_click = () => {
	if (!navigator.geolocation) return;

	const CurrentPosition = (position) => {
		const latitude = position.coords.latitude;
		const longitude = position.coords.longitude;

		console.log('Latitude: ' + latitude + '; Longitude: ' + longitude);

		//http://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode?location=-72.971293%2C+40.850043&f=pjson
		const request = $.ajax({
			url: location.protocol + '//geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode',
			data: {
				location: longitude + ',' + latitude,
				distance: 1000, // Find location upto 1 KM.
				f: 'json',
			},
			jsonp: 'callback',
			dataType: 'jsonp',
		});
		request.done((data) => {
			console.log(data);

			const ZipCode = data.address.Postal;
			const City = data.address.City;
			const State = states.getTwoDigitCode(data.address.Region);
			const Country = data.address.CountryCode;
			const TwcQuery = `${ZipCode}, ${City}, ${State}, ${Country}`;

			txtAddress.val(TwcQuery);
			txtAddress.blur();
			txtAddress.focus();

			// Save the query
			localStorage.setItem('TwcQuery', TwcQuery);

		});

	};

	navigator.geolocation.getCurrentPosition(CurrentPosition);
};

const populateWeatherParameters = (weatherParameters) => {
	spanCity.text(weatherParameters.city + ', ');
	spanState.text(weatherParameters.state);
	spanStationId.text(weatherParameters.stationId);
	spanRadarId.text(weatherParameters.radarId);
	spanZoneId.text(weatherParameters.zoneId);
};

const frmScrollText_submit = () => {
	chkScrollText_change();

	return false;
};

const chkScrollText_change = () => {
	txtScrollText.blur();

	let ScrollText = txtScrollText.val();
	localStorage.setItem('TwcScrollText', ScrollText);

	const ScrollTextChecked = chkScrollText.is(':checked');
	localStorage.setItem('TwcScrollTextChecked', ScrollTextChecked);

	if (chkScrollText.is(':checked') === false) {
		ScrollText = '';
	}
	postMessage('assignScrollText', ScrollText);
};

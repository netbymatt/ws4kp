'use strict';
// navigation handles progress, next/previous and initial load messages from the parent frame
/* globals utils, _StationInfo, STATUS, draw */
/* globals CurrentWeather, LatestObservations, TravelForecast, RegionalForecast, LocalForecast, ExtendedForecast, Almanac, Radar */

document.addEventListener('DOMContentLoaded', () => {
	navigation.init();
});

const UNITS = {
	english: Symbol('english'),
	metric: Symbol('metric'),
};

const navigation = (() => {
	let weatherParameters = {};
	let displays = [];
	let initialLoadDone = false;
	let currentUnits = UNITS.english;
	let playing = false;
	let backgroundImage;

	const init = async () => {
		// set up message receive and dispatch accordingly
		window.addEventListener('message', (event) => {
		// test for trust
			if (!event.isTrusted) return;
			// get the data
			const data = JSON.parse(event.data);

			// dispatch event
			if (!data.type) return;
			switch (data.type) {
			case 'latLon':
				getWeather(data.message);
				break;

			case 'units':
				setUnits(data.message);
				break;

			case 'navButton':
				handleNavButton(data.message);
				break;

			default:
				console.error(`Unknown event ${data.type}`);
			}
		}, false);
		backgroundImage = await utils.image.load('images/BackGround1_1.png');
		drawProgressCanvas();
	};

	const postMessage = (type, message = {}) => {
		const parent = window.parent;
		parent.postMessage(JSON.stringify({type, message}, window.location.origin));
	};

	const getWeather = async (latLon) => {
		// reset statuses
		initialLoadDone = false;

		// get initial weather data
		const point = await utils.weather.getPoint(latLon.lat, latLon.lon);

		// get stations
		const stations = await $.ajax({
			type: 'GET',
			url: point.properties.observationStations,
			dataType: 'json',
			crossDomain: true,
		});

		const StationId = stations.features[0].properties.stationIdentifier;

		let city = point.properties.relativeLocation.properties.city;

		if (StationId in _StationInfo) {
			city = _StationInfo[StationId].City;
			city = city.split('/')[0];
		}


		// populate the weather parameters
		weatherParameters.latitude = latLon.lat;
		weatherParameters.longitude = latLon.lon;
		weatherParameters.zoneId = point.properties.forecastZone.substr(-6);
		weatherParameters.radarId = point.properties.radarStation.substr(-3);
		weatherParameters.stationId = StationId;
		weatherParameters.weatherOffice = point.properties.cwa;
		weatherParameters.city = city;
		weatherParameters.state = point.properties.relativeLocation.properties.state;
		weatherParameters.timeZone = point.properties.relativeLocation.properties.timeZone;
		weatherParameters.forecast = point.properties.forecast;
		weatherParameters.stations = stations.features;

		// update the main process for display purposes
		postMessage('weatherParameters', weatherParameters);

		// start loading canvases if necessary
		if (displays.length === 0) {
			displays = [
				new CurrentWeather(0,'currentWeather', weatherParameters),
				new LatestObservations(1, 'latestObservations', weatherParameters),
				new TravelForecast(2, 'travelForecast', weatherParameters),
				// Regional Forecast: 0 = regional conditions, 1 = today, 2 = tomorrow
				new RegionalForecast(3, 'regionalForecast0', weatherParameters, 0),
				new RegionalForecast(4, 'regionalForecast1', weatherParameters, 1),
				new RegionalForecast(5, 'regionalForecast2', weatherParameters, 2),
				new LocalForecast(6, 'localForecast', weatherParameters),
				new ExtendedForecast(7, 'extendedForecast', weatherParameters),
				new Almanac(8, 'almanac', weatherParameters),
				new Radar(8, 'radar', weatherParameters),
			];
		} else {
			// or just call for new data if the canvases already exist
			displays.forEach(display => display.getData(weatherParameters));
		}

		// GetMonthPrecipitation(this.weatherParameters);
		// GetAirQuality3(this.weatherParameters);
		// ShowDopplerMap(this.weatherParameters);
		// GetWeatherHazards3(this.weatherParameters);
	};

	// receive a status update from a module {id, value}
	const updateStatus = (value) => {
		// skip if initial load
		if (initialLoadDone) return;
		// test for loaded status
		if (value.status !== STATUS.loaded) return;

		drawProgressCanvas();

		// send loaded messaged to parent
		if (countLoadedCanvases < displays.length) return;
		postMessage('loaded');
		// store the display number
	};

	const countLoadedCanvases = () => displays.reduce((acc, display) => {
		if (display.status !== STATUS.loading) return acc+1;
		return acc;
	},0);

	const hideAllCanvases = () => {
		displays.forEach(display => display.hideCanvas());
	};

	const units = () => currentUnits;
	const setUnits = (_unit) => {
		const unit = _unit.toLowerCase();
		if (unit === 'english') {
			currentUnits = UNITS.english;
		} else {
			currentUnits = UNITS.metric;
		}
		// TODO: refresh current screen
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

	// receive naivgation messages from displays
	const displayNavMessage = (message) => {
		if (message.type === msg.response.previous) loadDisplay(-1);
		if (message.type === msg.response.next) loadDisplay(1);
	};

	// navigate to next or previous
	const navTo = (direction) => {
		if (direction === msg.command.nextFrame) currentDisplay().navNext();
		if (direction === msg.command.previousFrame) currentDisplay().navPrev();
	};

	// find the next or previous available display
	const loadDisplay = (direction) => {
		const totalDisplays = displays.length;
		const curIdx = currentDisplayIndex();
		let idx;
		for (let i = 0; i < totalDisplays; i++) {
			// convert form simple 0-10 to start at current display index +/-1 and wrap
			idx = utils.calc.wrap(curIdx+(i+1)*direction,totalDisplays);
			if (displays[idx].status === STATUS.loaded) break;
		}
		const newDisplay = displays[idx];
		// hide all displays
		hideAllCanvases();
		// show the new display and navigate to an appropriate display
		if (direction < 0) newDisplay.showCanvas(msg.command.lastFrame);
		if (direction > 0) newDisplay.showCanvas(msg.command.firstFrame);
	};

	// get the current display index or value
	const currentDisplayIndex = () => {
		const index = displays.findIndex(display=>display.isActive());
		if (index === undefined) console.error('No active display');
		return index;
	};
	const currentDisplay = () => {
		return displays[currentDisplayIndex()];
	};

	const setPlaying = (newValue) => {
		playing = newValue;
		postMessage('isPlaying', playing);
	};

	// handle all navigation buttons
	const handleNavButton = (button) => {
		switch (button) {
		case 'playToggle':
			setPlaying(!playing);
			break;
		case 'next':
			setPlaying(false);
			navTo(msg.command.nextFrame);
			break;
		case 'previous':
			setPlaying(false);
			navTo(msg.command.previousFrame);
			break;
		default:
			console.error(`Unknown navButton ${button}`);
		}
	};

	const drawProgressCanvas = () => {
		const canvas = document.getElementById('progressCanvas');
		const context = canvas.getContext('2d');

		context.drawImage(backgroundImage, 0, 100, 640, 300, 0, 100, 640, 300);
		draw.horizontalGradientSingle(context, 0, 90, 52, 399, draw.sideColor1, draw.sideColor2);
		draw.horizontalGradientSingle(context, 584, 90, 640, 399, draw.sideColor1, draw.sideColor2);

		displays.forEach((display, idx) => {
			const y = 120 + idx*29;
			const dots = Array(120 - Math.floor(display.name.length * 2.5)).join('.');
			draw.text(context, 'Star4000 Extended', '19pt', '#ffffff', 70, y, display.name + dots, 2);

			// Erase any dots that spill into the status text.
			context.drawImage(backgroundImage, 475, y - 20, 165, 30, 475, y - 20, 165, 30);
			draw.horizontalGradientSingle(context, 584, 90, 640, 399, draw.sideColor1, draw.sideColor2);

			let statusText;
			let statusColor;
			switch (display.status) {
			case STATUS.loading:
				statusText = 'Loading';
				statusColor = '#ffff00';
				break;
			case STATUS.loaded:
				statusText = 'Press Here';
				statusColor = '#00ff00';
				break;
			case STATUS.failed:
				statusText = 'Failed';
				statusColor = '#ff0000';
				break;
			case STATUS.noData:
				statusText = 'No Data';
				statusColor = '#C0C0C0';
				draw.box(context, 'rgb(33, 40, 90)', 475, y - 15, 75, 15);
				break;
			default:
			}
			draw.text(context, 'Star4000 Extended', '19pt', statusColor, 565, y, statusText, 2, 'end');

		});
	};

	return {
		init,
		updateStatus,
		units,
		isPlaying,
		displayNavMessage,
		msg,
	};
})();
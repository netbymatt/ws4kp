'use strict';

/* globals draw, navigation */

// eslint-disable-next-line no-unused-vars
const currentWeatherScroll = (() => {
	// local variables
	let context;	// currently active context
	let blankDrawArea;	// original state of context
	let station;
	let interval;
	let screenIndex = 0;

	// start drawing conditions
	// reset starts from the first item in the text scroll list
	const start = (_context) => {
		// see if there is a context available
		if (!_context) return;
		// store see if the context is new
		if (_context !== context) {
			// clean the outgoing context
			cleanLastContext();
			// store the new blank context
			blankDrawArea = _context.getImageData(0, 405, 640, 75);
		}
		// store the context locally
		context = _context;

		// set up the interval if needed
		if (!interval) {
			interval = setInterval(incrementInterval, 700);
		}

		// draw the data
		drawScreen();

	};

	const stop = (reset) => {
		cleanLastContext();
		if (interval) interval = clearInterval(interval);
		if (reset) screenIndex = 0;
	};

	const cleanLastContext = () => {
		if (blankDrawArea) context.putImageData(blankDrawArea, 0, 405);
		blankDrawArea = undefined;
		context = undefined;
	};

	// increment interval, roll over
	const incrementInterval = () => {
		screenIndex = (screenIndex+1)%2;
		// draw new text
		drawScreen();
	};

	const drawScreen = () => {
		// get the conditions
		const data = navigation.getCurrentWeather();

		// nothing to do if there's no data yet
		if (!data) return;
		if (!station) return;

		// clean up any old text
		context.putImageData(blankDrawArea, 0, 405);

		switch (screenIndex) {
		case 0:
		default:
			drawCondition(`Conditions at ${station.name.substr(0,20)}`);
			break;
		case 1:
			drawCondition(`Page 2`);
			break;
		}
	};

	// internal draw function with preset parameters
	const drawCondition = (text) => {
		draw.text(context, 'Star4000', '24pt', '#ffffff', 70, 430, text, 2);
	};

	// store the latest station data
	const setStation = (weatherParameters) => {
		station = weatherParameters.stations[0].properties;
	};

	// return the api
	return {
		start,
		stop,
		setStation,
	};
})();
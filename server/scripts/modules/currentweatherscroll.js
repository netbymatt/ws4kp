/* globals draw, navigation */

// eslint-disable-next-line no-unused-vars
const currentWeatherScroll = (() => {
	// constants
	const degree = String.fromCharCode(176);

	// local variables
	let context;	// currently active context
	let blankDrawArea;	// original state of context
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
			interval = setInterval(incrementInterval, 4000);
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
		screenIndex = (screenIndex + 1) % (screens.length);
		// draw new text
		drawScreen();
	};

	const drawScreen = async () => {
		// get the conditions
		const data = await navigation.getCurrentWeather();

		// nothing to do if there's no data yet
		if (!data) return;

		// clean up any old text
		context.putImageData(blankDrawArea, 0, 405);

		drawCondition(screens[screenIndex](data));
	};

	// the "screens" are stored in an array for easy addition and removal
	const screens = [
		// station name
		(data) => `Conditions at ${data.station.properties.name.substr(0, 20)}`,

		// temperature
		(data) => {
			let text = `Temp: ${data.Temperature}${degree} ${data.TemperatureUnit}`;
			if (data.observations.heatIndex.value) {
				text += `    Heat Index: ${data.HeatIndex}${degree} ${data.TemperatureUnit}`;
			} else if (data.observations.windChill.value) {
				text += `    Wind Chill: ${data.WindChill}${degree} ${data.TemperatureUnit}`;
			}
			return text;
		},

		// humidity
		(data) => `Humidity: ${data.Humidity}${degree} ${data.TemperatureUnit}  Dewpoint: ${data.DewPoint}${degree} ${data.TemperatureUnit}`,

		// barometric pressure
		(data) => `Barometric Pressure: ${data.Pressure} ${data.PressureDirection}`,

		// wind
		(data) => {
			let text = '';
			if (data.WindSpeed > 0) {
				text = `Wind: ${data.WindDirection} ${data.WindSpeed} ${data.WindUnit}`;
			} else {
				text = 'Wind: Calm';
			}
			if (data.WindGust > 0) {
				text += `  Gusts to ${data.WindGust}`;
			}
			return text;
		},

		// visibility
		(data) => `Visib: ${data.Visibility} ${data.VisibilityUnit}  Ceiling: ${data.Ceiling === 0 ? 'Unlimited' : `${data.Ceiling} ${data.CeilingUnit}`}`,
	];

	// internal draw function with preset parameters
	const drawCondition = (text) => {
		draw.text(context, 'Star4000', '24pt', '#ffffff', 70, 430, text, 2);
	};

	// return the api
	return {
		start,
		stop,
	};
})();

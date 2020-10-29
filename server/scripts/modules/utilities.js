// radar utilities

/* globals SuperGif */
// eslint-disable-next-line no-unused-vars
const utils = (() => {
	// ****************************** weather data ********************************
	const getPoint = async (lat, lon) => {
		try {
			return await json(`https://api.weather.gov/points/${lat},${lon}`);
		} catch (e) {
			console.log(`Unable to get point ${lat}, ${lon}`);
			console.error(e);
			return false;
		}
	};

	// ****************************** load images *********************************
	// load an image from a blob or url
	const loadImg = (imgData, cors = false) => new Promise((resolve) => {
		const img = new Image();
		img.onload = (e) => {
			resolve(e.target);
		};
		if (imgData instanceof Blob) {
			img.src = window.URL.createObjectURL(imgData);
		} else {
			let url = imgData;
			if (cors) url = rewriteUrl(imgData);
			img.src = url;
		}
	});

	// async version of SuperGif
	const superGifAsync = (e) => new Promise((resolve) => {
		const gif = new SuperGif(e);
		gif.load(() => resolve(gif));
	});

	// preload an image
	// the goal is to get it in the browser's cache so it is available more quickly when the browser needs it
	// a list of cached icons is used to avoid hitting the cache multiple times
	const cachedImages = [];
	const preload = (src) => {
		if (cachedImages.includes(src)) return false;
		const img = new Image();
		img.scr = src;
		cachedImages.push(src);
		return true;
	};

	// draw an image on a local canvas and return the context
	const drawLocalCanvas = (img) => {
		// create a canvas
		const canvas = document.createElement('canvas');
		canvas.width = img.width;
		canvas.height = img.height;

		// get the context
		const context = canvas.getContext('2d');
		context.imageSmoothingEnabled = false;

		// draw the image
		context.drawImage(img, 0, 0);
		return context;
	};

	// *********************************** unit conversions ***********************

	Math.round2 = (value, decimals) => Number(`${Math.round(`${value}e${decimals}`)}e-${decimals}`);

	const mphToKph = (Mph) => Math.round(Mph * 1.60934);
	const kphToMph = (Kph) => Math.round(Kph / 1.60934);
	const celsiusToFahrenheit = (Celsius) => Math.round((Celsius * 9) / 5 + 32);
	const fahrenheitToCelsius = (Fahrenheit) => Math.round2((((Fahrenheit) - 32) * 5) / 9, 1);
	const milesToKilometers = (Miles) => Math.round(Miles * 1.60934);
	const kilometersToMiles = (Kilometers) => Math.round(Kilometers / 1.60934);
	const feetToMeters = (Feet) => Math.round(Feet * 0.3048);
	const metersToFeet = (Meters) => Math.round(Meters / 0.3048);
	const inchesToCentimeters = (Inches) => Math.round2(Inches * 2.54, 2);
	const pascalToInHg = (Pascal) => Math.round2(Pascal * 0.0002953, 2);

	// ***************************** calculations **********************************

	const relativeHumidity = (Temperature, DewPoint) => {
		const T = Temperature;
		const TD = DewPoint;
		return Math.round(100 * (Math.exp((17.625 * TD) / (243.04 + TD)) / Math.exp((17.625 * T) / (243.04 + T))));
	};

	const heatIndex = (Temperature, RelativeHumidity) => {
		const T = Temperature;
		const RH = RelativeHumidity;
		let HI = 0.5 * (T + 61.0 + ((T - 68.0) * 1.2) + (RH * 0.094));
		let ADJUSTMENT;

		if (T >= 80) {
			HI = -42.379 + 2.04901523 * T + 10.14333127 * RH - 0.22475541 * T * RH - 0.00683783 * T * T - 0.05481717 * RH * RH + 0.00122874 * T * T * RH + 0.00085282 * T * RH * RH - 0.00000199 * T * T * RH * RH;

			if (RH < 13 && (T > 80 && T < 112)) {
				ADJUSTMENT = ((13 - RH) / 4) * Math.sqrt((17 - Math.abs(T - 95)) / 17);
				HI -= ADJUSTMENT;
			} else if (RH > 85 && (T > 80 && T < 87)) {
				ADJUSTMENT = ((RH - 85) / 10) * ((87 - T) / 5);
				HI += ADJUSTMENT;
			}
		}

		if (HI < Temperature) {
			HI = Temperature;
		}

		return Math.round(HI);
	};

	const windChill = (Temperature, WindSpeed) => {
		if (WindSpeed === '0' || WindSpeed === 'Calm' || WindSpeed === 'NA') {
			return '';
		}

		const T = Temperature;
		const V = WindSpeed;

		return Math.round(35.74 + (0.6215 * T) - (35.75 * (V ** 0.16)) + (0.4275 * T * (V ** 0.16)));
	};

	// wind direction
	const directionToNSEW = (Direction) => {
		const val = Math.floor((Direction / 22.5) + 0.5);
		const arr = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
		return arr[(val % 16)];
	};

	const distance = (x1, y1, x2, y2) => Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);

	// wrap a number to 0-m
	const wrap = (x, m) => ((x % m) + m) % m;

	// ********************************* strings *********************************************
	const wordWrap = (str = '', ...rest) => {
		const m = ((rest.length >= 1) ? rest[0] : 75);
		const b = ((rest.length >= 2) ? rest[1] : '\n');
		const c = ((rest.length >= 3) ? rest[2] : false);

		let i;
		let j;
		let l;
		let s;
		let r;

		if (m < 1) {
			return str;
		}

		for (i = -1, l = (r = str.split(/\r\n|\n|\r/)).length; ++i < l; r[i] += s) {
			for (s = r[i], r[i] = '';
				s.length > m;
				r[i] += s.slice(0, j) + ((s = s.slice(j)).length ? b : '')) {
				j = c === 2 || (j = s.slice(0, m + 1).match(/\S*(\s)?$/))[1]
					? m
					: ((j.input.length - j[0].length || c === true) && m)
						|| j.input.length + (j = s.slice(m).match(/^\S*/))[0].length;
			}
		}

		return r.join('\n').replace(/\n /g, '\n');
	};
	// ********************************* cors ********************************************
	// rewrite some urls for local server
	const rewriteUrl = (_url) => {
		let url = _url;
		url = url.replace('https://api.weather.gov/', window.location.href);
		url = url.replace('https://radar.weather.gov/', window.location.href);
		url = url.replace('https://www.cpc.ncep.noaa.gov/', window.location.href);
		return url;
	};

	// ********************************* fetch ********************************************
	const json = (url, params) => fetchAsync(url, 'json', params);
	const text = (url, params) => fetchAsync(url, 'text', params);
	const raw = (url, params) => fetchAsync(url, '', params);
	const blob = (url, params) => fetchAsync(url, 'blob', params);

	const fetchAsync = async (_url, responseType, _params = {}) => {
		// combine default and provided parameters
		const params = {
			method: 'GET',
			mode: 'cors',
			type: 'GET',
			..._params,
		};
		// build a url, including the rewrite for cors if necessary
		let corsUrl = _url;
		if (params.cors === true) corsUrl = rewriteUrl(_url);
		const url = new URL(corsUrl);
		// add parameters if necessary
		if (params.data) {
			Object.keys(params.data).forEach((key) => {
				// get the value
				const value = params.data[key];
				// add to the url
				url.searchParams.append(key, value);
			});
		}

		// make the request
		const response = await fetch(url, params);

		// check for ok response
		if (!response.ok) throw new Error(`Fetch error ${response.status} ${response.statusText} while fetching ${response.url}`);
		// return the requested response
		switch (responseType) {
		case 'json':
			return response.json();
		case 'text':
			return response.text();
		case 'blob':
			return response.blob();
		default:
			return response;
		}
	};

	// return an orderly object
	return {
		image: {
			load: loadImg,
			superGifAsync,
			preload,
			drawLocalCanvas,
		},
		weather: {
			getPoint,
		},
		units: {
			mphToKph,
			kphToMph,
			celsiusToFahrenheit,
			fahrenheitToCelsius,
			milesToKilometers,
			kilometersToMiles,
			feetToMeters,
			metersToFeet,
			inchesToCentimeters,
			pascalToInHg,
		},
		calc: {
			relativeHumidity,
			heatIndex,
			windChill,
			directionToNSEW,
			distance,
			wrap,
		},
		string: {
			wordWrap,
		},
		cors: {
			rewriteUrl,
		},
		fetch: {
			json,
			text,
			raw,
			blob,
		},
	};
})();

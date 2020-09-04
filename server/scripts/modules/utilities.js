'use strict';
// radar utilities

/* globals _Units, Units, SuperGif */
// eslint-disable-next-line no-unused-vars
const utils = (() => {
	// ****************************** weather data ********************************
	const getPoint = async (lat, lon) => {
		try {
			return await $.ajax({
				type: 'GET',
				url: `https://api.weather.gov/points/${lat},${lon}`,
				dataType: 'json',
				crossDomain: true,
			});
		} catch (e) {
			console.error('Unable to get point');
			console.error(lat,lon);
			console.error(e);
			return false;
		}
	};

	// ****************************** load images *********************************
	// load an image from a blob or url
	const loadImg = (imgData) => {
		return new Promise(resolve => {
			const img = new Image();
			img.onload = (e) => {
				resolve(e.target);
			};
			if (imgData instanceof Blob) {
				img.src = window.URL.createObjectURL(imgData);
			} else {
				img.src = imgData;
			}
		});
	};

	// async version of SuperGif
	const superGifAsync = (e) => {
		return new Promise(resolve => {
			const gif = new SuperGif(e);
			gif.load(() => resolve(gif));
		});
	};

	// *********************************** unit conversions ***********************

	Math.round2 = (value, decimals) => Number(Math.round(value + 'e' + decimals) + 'e-' + decimals);

	const mphToKph = (Mph) => Math.round(Mph * 1.60934);
	const kphToMph = (Kph) => Math.round(Kph / 1.60934);
	const celsiusToFahrenheit = (Celsius) => Math.round(Celsius * 9 / 5 + 32);
	const fahrenheitToCelsius = (Fahrenheit) => Math.round2(((Fahrenheit) - 32) * 5 / 9, 1);
	const milesToKilometers = (Miles) => Math.round(Miles * 1.60934);
	const kilometersToMiles = (Kilometers) => Math.round(Kilometers / 1.60934);
	const feetToMeters = (Feet) => Math.round(Feet * 0.3048);
	const metersToFeet = (Meters) => Math.round(Meters / 0.3048);
	const inchesToCentimeters = (Inches) => Math.round2(Inches * 2.54, 2);
	const pascalToInHg = (Pascal) => Math.round2(Pascal*0.0002953,2);

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

		return Math.round(35.74 + (0.6215 * T) - (35.75 * Math.pow(V, 0.16)) + (0.4275 * T * Math.pow(V, 0.16)));
	};

	// wind direction
	const directionToNSEW = (Direction) => {
		const val = Math.floor((Direction / 22.5) + 0.5);
		const arr = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
		return arr[(val % 16)];
	};

	const distance = (x1 ,y1, x2, y2) => Math.sqrt((x2-=x1)*x2 + (y2-=y1)*y2);

	// wrap a number to 0-m
	const wrap = (x,m) => (x%m + m)%m;

	// ********************************* date functions ***************************
	const getDateFromUTC = (date, utc) => {
		const time = utc.split(':');
		return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), time[0], time[1], 0));
	};

	const getTimeZoneOffsetFromUTC = (timezone) => {
		switch (timezone) {
		case 'EST':
			return -5;
		case 'EDT':
			return -4;
		case 'CST':
			return -6;
		case 'CDT':
			return -5;
		case 'MST':
			return -7;
		case 'MDT':
			return -6;
		case 'PST':
			return -8;
		case 'PDT':
			return -7;
		case 'AST':
		case 'AKST':
			return -9;
		case 'ADT':
		case 'AKDT':
			return -8;
		case 'HST':
			return -10;
		case 'HDT':
			return -9;
		default:
			return null;
		}
	};

	Date.prototype.getTimeZone = function () {
		const tz = this.toLocaleTimeString('en-us', { timeZoneName: 'short' }).split(' ')[2];

		if (tz === null){
			switch (this.toTimeString().split(' ')[2]) {
			case '(Eastern':
				return 'EST';
			case '(Central':
				return 'CST';
			case '(Mountain':
				return 'MST';
			case '(Pacific':
				return 'PST';
			case '(Alaskan':
				return 'AST';
			case '(Hawaiian':
				return 'HST';
			default:
			}
		} else if (tz.length === 4) {
			// Fix weird bug in Edge where it returns the timezone with a null character in the first position.
			return tz.substr(1);
		}

		return tz;
	};

	Date.prototype.addHours = function (hours) {
		var dat = new Date(this.valueOf());
		dat.setHours(dat.getHours() + hours);
		return dat;
	};

	Date.prototype.getDayShortName = function () {
		var days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
		return days[this.getDay()];
	};

	Date.prototype.getMonthShortName = function () {
		var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
		return months[this.getMonth()];
	};

	const dateToTimeZone = (date, timezone) => {
		const OldOffset = getTimeZoneOffsetFromUTC(date.getTimeZone());
		const NewOffset = getTimeZoneOffsetFromUTC(timezone);

		let dt = new Date(date);
		dt = dt.addHours(OldOffset * -1);
		dt = dt.addHours(NewOffset);
		return dt;
	};

	const getDateFromTime = (date, time, timezone) => {
		const Time = time.split(':');
		if (timezone) {
			const Offset = getTimeZoneOffsetFromUTC(timezone) * -1;
			const newDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), Time[0], Time[1], 0));
			return newDate.addHours(Offset);
		} else {
			return new Date(date.getFullYear(), date.getMonth(), date.getDate(), Time[0], Time[1], 0);
		}
	};

	Date.prototype.getFormattedTime = function () {
		let hours;
		let minutes;
		let ampm;

		switch (_Units) {
		case Units.English:
			hours = this.getHours() === 0 ? '12' : this.getHours() > 12 ? this.getHours() - 12 : this.getHours();
			minutes = (this.getMinutes() < 10 ? '0' : '') + this.getMinutes();
			ampm = this.getHours() < 12 ? 'am' : 'pm';
			return hours + ':' + minutes + ' ' + ampm;

		default:
			hours = (this.getHours() < 10 ? ' ' : '') + this.getHours();
			minutes = (this.getMinutes() < 10 ? '0' : '') + this.getMinutes();
			return hours + ':' + minutes;
		}
	};

	Date.prototype.toTimeAMPM = function () {
		const date = this;
		let hours = date.getHours();
		let minutes = date.getMinutes();
		let ampm = hours >= 12 ? 'pm' : 'am';
		hours = hours % 12;
		hours = hours ? hours : 12; // the hour '0' should be '12'
		minutes = minutes < 10 ? '0' + minutes : minutes;
		return hours + ':' + minutes + ' ' + ampm;
	};

	const xmlDateToJsDate = (XmlDate) => {
		let bits = XmlDate.split(/[-T:+]/g);

		if (bits[5] === undefined) {
			console.log('bit[5] is undefined');
		}

		bits[5] = bits[5].replace('Z', '');
		const d = new Date(bits[0], bits[1] - 1, bits[2]);
		d.setHours(bits[3], bits[4], bits[5]);

		// Case for when no time zone offset if specified
		if (bits.length < 8) {
			bits.push('00');
			bits.push('00');
		}

		// Get supplied time zone offset in minutes
		const sign = /\d\d-\d\d:\d\d$/.test(XmlDate) ? '-' : '+';
		const offsetMinutes = (sign==='-'?-1:1)*(bits[6] * 60 + Number(bits[7]));

		// Apply offset and local timezone
		// d is now a local time equivalent to the supplied time
		return d.setMinutes(d.getMinutes() - offsetMinutes - d.getTimezoneOffset());
	};

	const timeTo24Hour = (Time) => {
		const AMPM = Time.substr(Time.length - 2);
		const MM = Time.split(':')[1].substr(0, 2);
		let HH = Time.split(':')[0];

		switch (AMPM.toLowerCase()) {
		case 'am':
			if (HH === '12') HH = '0';
			break;

		case 'pm':
			if (HH !== '12') HH = (parseInt(HH) + 12).toString();
			break;
		default:
		}

		return HH + ':' + MM;
	};

	// compare objects on shallow equality (nested objects ignored)
	const shallowEqual= (obj1, obj2) => {
		if (typeof obj1 !== 'object') return false;
		if (typeof obj2 !== 'object') return false;
		const keys1 = Object.keys(obj1);
		const keys2 = Object.keys(obj2);
		if (keys1.length !== keys2.length) return false;
		for (const key of keys1) {
			if (typeof obj1[key] !== 'object' && obj1[key] !== obj2[key]) return false;
		}
		return true;
	};

	// ********************************* strings *********************************************
	if (!String.prototype.startsWith) {
		String.prototype.startsWith = function (searchString, position) {
			position = position || 0;
			return this.substr(position, searchString.length) === searchString;
		};
	}
	if (!String.prototype.endsWith) {
		String.prototype.endsWith = function(searchString, position) {
			var subjectString = this.toString();
			if (typeof position !== 'number' || !isFinite(position) || Math.floor(position) !== position || position > subjectString.length) {
				position = subjectString.length;
			}
			position -= searchString.length;
			var lastIndex = subjectString.lastIndexOf(searchString, position);
			return lastIndex !== -1 && lastIndex === position;
		};
	}
	String.prototype.wordWrap =  function () {

		let str = this;

		let m = ((arguments.length >= 1) ? arguments[0] : 75);
		let b = ((arguments.length >= 2) ? arguments[1] : '\n');
		let c = ((arguments.length >= 3) ? arguments[2] : false);

		let i, j, l, s, r;

		str += '';

		if (m < 1) {
			return str;
		}

		for (i = -1, l = (r = str.split(/\r\n|\n|\r/)).length; ++i < l; r[i] += s) {
			// @todo: Split this up over many more lines and more semantic variable names
			// so it becomes readable
			for (s = r[i], r[i] = '';
				s.length > m;
				r[i] += s.slice(0, j) + ((s = s.slice(j)).length ? b : '')) {
				j = c === 2 || (j = s.slice(0, m + 1).match(/\S*(\s)?$/))[1]
					? m
					: j.input.length - j[0].length || c === true && m ||
						j.input.length + (j = s.slice(m).match(/^\S*/))[0].length;
			}
		}

		return r.join('\n').replace(/\n /g, '\n');
	};

	// return an orderly object
	return {
		image: {
			load: loadImg,
			superGifAsync,
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
		dateTime: {
			getDateFromUTC,
			getTimeZoneOffsetFromUTC,
			dateToTimeZone,
			getDateFromTime,
			xmlDateToJsDate,
			timeTo24Hour,
		},
		object: {
			shallowEqual,
		},
	};
})();

// pass data through local server as CORS workaround
$.ajaxCORS = function (e) {
	// modify the URL
	e.url = e.url.replace('https://api.weather.gov/', '');

	// call the ajax function
	return $.ajax(e);
};
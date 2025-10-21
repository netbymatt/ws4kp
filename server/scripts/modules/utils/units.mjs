// get the settings for units
import settings from '../settings.mjs';
// *********************************** unit conversions ***********************

// certain conversions return a "-" when provided with an undefined value

// round 2 provided for lat/lon formatting
const round2 = (value, decimals) => Math.trunc(value * 10 ** decimals) / 10 ** decimals;

const kphToMph = (Kph) => Math.round(Kph / 1.609_34);
const celsiusToFahrenheit = (Celsius) => Math.round((Celsius * 9) / 5 + 32);
const fahrenheitToCelsius = (Fahrenheit) => Math.round((Fahrenheit - 32) * 5 / 9);
const kilometersToMiles = (Kilometers) => Math.round(Kilometers / 1.609_34);
const metersToFeet = (Meters) => Math.round(Meters / 0.3048);
const pascalToInHg = (Pascal) => round2(Pascal * 0.000_295_3, 2);
const mmToIn = (mm) => round2(mm / 25.4);

// each module/page/slide creates it's own unit converter as needed by providing the base units available
// the factory function then returns an appropriate converter or pass-thru function for use on the page

// passthru is used for the default conditoin
const passthru = (divisor = 1) => (value) => {
	if ((value ?? null) === null) return '-';
	return Math.round(value / divisor);
};

// factory function to add undefined detection to unit converters
const convert = (fxn) => (value) => {
	if ((value ?? null) === null) return '-';
	return fxn(value);
};

const windSpeed = (defaultUnit = 'si') => {
	// default to passthru
	let converter = passthru();
	// change the converter if there is a mismatch
	if (defaultUnit !== settings.units.value) {
		converter = convert(kphToMph);
	}
	// append units
	if (settings.units.value === 'si') {
		converter.units = 'kph';
	} else {
		converter.units = 'MPH';
	}
	return converter;
};

const temperature = (defaultUnit = 'si') => {
	// default to passthru
	let converter = passthru();
	// change the converter if there is a mismatch
	if (defaultUnit !== settings.units.value) {
		if (defaultUnit === 'us') {
			converter = convert(fahrenheitToCelsius);
		} else {
			converter = convert(celsiusToFahrenheit);
		}
	}
	// append units
	if (settings.units.value === 'si') {
		converter.units = 'C';
	} else {
		converter.units = 'F';
	}
	return converter;
};

const distanceMeters = (defaultUnit = 'si') => {
	// default to passthru
	let converter = passthru();
	// change the converter if there is a mismatch
	if (defaultUnit !== settings.units.value) {
		// rounded to the nearest 100 (ceiling)
		converter = convert((value) => Math.round(metersToFeet(value) / 100) * 100);
	}
	// append units
	if (settings.units.value === 'si') {
		converter.units = 'm.';
	} else {
		converter.units = 'ft.';
	}
	return converter;
};

const distanceKilometers = (defaultUnit = 'si') => {
	// default to passthru
	let converter = passthru(1000);
	// change the converter if there is a mismatch
	if (defaultUnit !== settings.units.value) {
		converter = convert((value) => Math.round(kilometersToMiles(value) / 1000));
	}
	// append units
	if (settings.units.value === 'si') {
		converter.units = ' km.';
	} else {
		converter.units = ' mi.';
	}
	return converter;
};

// millimeters (annoying with camel case)
const distanceMm = (defaultUnit = 'si') => {
	// default to passthru
	let converter = passthru();
	// change the converter if there is a mismatch
	if (defaultUnit !== settings.units.value) {
		converter = convert((value) => Math.round(mmToIn(value)));
	}
	// append units
	if (settings.units.value === 'si') {
		converter.units = ' mm.';
	} else {
		converter.units = ' in.';
	}
	return converter;
};

const pressure = (defaultUnit = 'si') => {
	// default to passthru (millibar)
	let converter = passthru(100);
	// change the converter if there is a mismatch
	if (defaultUnit !== settings.units.value) {
		converter = convert((value) => pascalToInHg(value).toFixed(2));
	}
	// append units
	if (settings.units.value === 'si') {
		converter.units = ' mbar';
	} else {
		converter.units = ' in.hg';
	}
	return converter;
};

export {
	// unit conversions
	windSpeed,
	temperature,
	distanceMeters,
	distanceKilometers,
	pressure,
	distanceMm,

	// formatter
	round2,
};

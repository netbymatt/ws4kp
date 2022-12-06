const UNITS = {
	english: Symbol('english'),
	metric: Symbol('metric'),
};

let currentUnits = UNITS.english;

const getUnits = () => currentUnits;
const setUnits = (_unit) => {
	const unit = _unit.toLowerCase();
	if (unit === 'english') {
		currentUnits = UNITS.english;
	} else {
		currentUnits = UNITS.metric;
	}
	// TODO: refresh current screen
};

// *********************************** unit conversions ***********************

const round2 = (value, decimals) => Number(`${Math.round(`${value}e${decimals}`)}e-${decimals}`);

const mphToKph = (Mph) => Math.round(Mph * 1.60934);
const kphToMph = (Kph) => Math.round(Kph / 1.60934);
const celsiusToFahrenheit = (Celsius) => Math.round((Celsius * 9) / 5 + 32);
const fahrenheitToCelsius = (Fahrenheit) => round2((((Fahrenheit) - 32) * 5) / 9, 1);
const milesToKilometers = (Miles) => Math.round(Miles * 1.60934);
const kilometersToMiles = (Kilometers) => Math.round(Kilometers / 1.60934);
const feetToMeters = (Feet) => Math.round(Feet * 0.3048);
const metersToFeet = (Meters) => Math.round(Meters / 0.3048);
const inchesToCentimeters = (Inches) => round2(Inches * 2.54, 2);
const pascalToInHg = (Pascal) => round2(Pascal * 0.0002953, 2);

const convert = {
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
};

export {
	getUnits,
	setUnits,
	UNITS,
	convert,
};

export default getUnits;

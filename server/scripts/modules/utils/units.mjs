// *********************************** unit conversions ***********************

const round2 = (value, decimals) => Number(`${Math.round(`${value}e${decimals}`)}e-${decimals}`);

const kphToMph = (Kph) => Math.round(Kph / 1.60934);
const celsiusToFahrenheit = (Celsius) => Math.round((Celsius * 9) / 5 + 32);
const kilometersToMiles = (Kilometers) => Math.round(Kilometers / 1.60934);
const metersToFeet = (Meters) => Math.round(Meters / 0.3048);
const pascalToInHg = (Pascal) => round2(Pascal * 0.0002953, 2);

export {
	kphToMph,
	celsiusToFahrenheit,
	kilometersToMiles,
	metersToFeet,
	pascalToInHg,
};

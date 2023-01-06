// *********************************** unit conversions ***********************

const round2 = (value, decimals) => Math.trunc(value * 10 ** decimals) / 10 ** decimals;

const kphToMph = (Kph) => Math.round(Kph / 1.609_34);
const celsiusToFahrenheit = (Celsius) => Math.round((Celsius * 9) / 5 + 32);
const kilometersToMiles = (Kilometers) => Math.round(Kilometers / 1.609_34);
const metersToFeet = (Meters) => Math.round(Meters / 0.3048);
const pascalToInHg = (Pascal) => round2(Pascal * 0.000_295_3, 2);

export {
	kphToMph,
	celsiusToFahrenheit,
	kilometersToMiles,
	metersToFeet,
	pascalToInHg,
	round2,
};

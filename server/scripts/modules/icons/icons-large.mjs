/* spell-checker: disable */
import parseIconUrl from './icons-parse.mjs';

const addPath = (icon) => `images/icons/current-conditions/${icon}`;

const largeIcon = (link, _isNightTime) => {
	let conditionIcon;
	let probability;
	let isNightTime;

	try {
		({ conditionIcon, probability, isNightTime } = parseIconUrl(link, _isNightTime));
	} catch (error) {
		console.warn(`largeIcon: ${error.message}`);
		// Return a fallback icon to prevent downstream errors
		return addPath(_isNightTime ? 'Clear.gif' : 'Sunny.gif');
	}

	// find the icon
	switch (conditionIcon + (isNightTime ? '-n' : '')) {
		case 'skc':
		case 'hot':
			return addPath('Sunny.gif');

		case 'skc-n':
			return addPath('Clear.gif');

		case 'haze':
			return addPath('Sunny.gif');

		case 'haze-n':
			return addPath('Clear.gif');

		case 'cold':
			return addPath('Sunny.gif');

		case 'cold-n':
			return addPath('Clear.gif');

		case 'dust':
		case 'dust-n':
			return addPath('Smoke.gif');

		case 'few':
			return addPath('Partly-Cloudy.gif');

		case 'few-n':
			return addPath('Mostly-Clear.gif');

		case 'sct':
			return addPath('Partly-Cloudy.gif');

		case 'sct-n':
			return addPath('Mostly-Clear.gif');

		case 'bkn':
			return addPath('Partly-Cloudy.gif');

		case 'bkn-n':
			return addPath('Mostly-Clear.gif');

		case 'ovc':
		case 'ovc-n':
			return addPath('Cloudy.gif');

		case 'fog':
		case 'fog-n':
			return addPath('Fog.gif');

		case 'rain_sleet':
		case 'rain_sleet-n':
			return addPath('Rain-Sleet.gif');

		case 'sleet':
		case 'sleet-n':
			return addPath('Sleet.gif');

		case 'smoke':
		case 'smoke-n':
			return addPath('Smoke.gif');

		case 'rain_showers':
		case 'rain_showers_hi':
		case 'rain_showers_high':
		case 'rain_showers-n':
		case 'rain_showers_hi-n':
		case 'rain_showers_high-n':
			return addPath('Shower.gif');

		case 'rain':
		case 'rain-n':
			return addPath('Rain.gif');

		case 'snow':
		case 'snow-n':
			if (probability > 50) return addPath('Heavy-Snow.gif');
			return addPath('Light-Snow.gif');

		case 'rain_snow':
		case 'rain_snow-n':
			return addPath('Rain-Snow.gif');

		case 'snow_fzra':
		case 'snow_fzra-n':
			return addPath('Freezing-Rain-Snow.gif');

		case 'fzra':
		case 'fzra-n':
		case 'rain_fzra':
		case 'rain_fzra-n':
			return addPath('Freezing-Rain.gif');

		case 'snow_sleet':
		case 'snow_sleet-n':
			return addPath('Snow-Sleet.gif');

		case 'tsra_sct':
			return addPath('Scattered-Thunderstorms-Day.gif');

		case 'tsra_sct-n':
			return addPath('Scattered-Thunderstorms-Night.gif');

		case 'tsra':
			return addPath('Scattered-Thunderstorms-Day.gif');

		case 'tsra-n':
			return addPath('Scattered-Thunderstorms-Night.gif');

		case 'tsra_hi':
		case 'tsra_hi-n':
			return addPath('Thunderstorm.gif');

		case 'tornado':
		case 'tornado-n':
			return addPath('Thunderstorm.gif');

		case 'hurricane':
		case 'hurricane-n':
		case 'tropical_storm':
		case 'tropical_storm-n':
			return addPath('Thunderstorm.gif');

		case 'wind_skc':
			return addPath('Windy.gif');

		case 'wind_skc-n':
			return addPath('Windy.gif');

		case 'wind_few':
		case 'wind_few-n':
			return addPath('Windy.gif');

		case 'wind_sct':
		case 'wind_sct-n':
			return addPath('Windy.gif');

		case 'wind_bkn':
		case 'wind_bkn-n':
			return addPath('Windy.gif');

		case 'wind_ovc':
		case 'wind_ovc-n':
			return addPath('Windy.gif');

		case 'blizzard':
		case 'blizzard-n':
			return addPath('Blowing-Snow.gif');

		default: {
			console.warn(`Unknown weather condition '${conditionIcon}' from ${link}; using fallback icon`);
			// Return a reasonable fallback instead of false to prevent downstream errors
			return addPath(isNightTime ? 'Clear.gif' : 'Sunny.gif');
		}
	}
};

export default largeIcon;

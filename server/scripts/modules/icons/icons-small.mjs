import parseIconUrl from './icons-parse.mjs';

const addPath = (icon) => `images/icons/regional-maps/${icon}`;

const smallIcon = (link, _isNightTime) => {
	let conditionIcon;
	let probability;
	let isNightTime;

	try {
		({ conditionIcon, probability, isNightTime } = parseIconUrl(link, _isNightTime));
	} catch (error) {
		console.warn(`smallIcon: ${error.message}`);
		// Return a fallback icon to prevent downstream errors
		return addPath(_isNightTime ? 'Clear-1992.gif' : 'Sunny.gif');
	}

	// handle official weather.gov API condition icons
	switch (conditionIcon + (isNightTime ? '-n' : '')) {
		case 'skc':
			return addPath('Sunny.gif');

		case 'skc-n':
			return addPath('Clear-1992.gif');

		case 'few':
			return addPath('Partly-Cloudy.gif');

		case 'few-n':
			return addPath('Partly-Clear-1994.gif');

		case 'sct':
			return addPath('Partly-Cloudy.gif');

		case 'sct-n':
			return addPath('Partly-Cloudy-Night.gif');

		case 'bkn':
			return addPath('Mostly-Cloudy-1994.gif');

		case 'bkn-n':
			return addPath('Partly-Clear-1994.gif');

		case 'ovc':
		case 'ovc-n':
			return addPath('Cloudy.gif');

		case 'fog':
		case 'fog-n':
			return addPath('Fog.gif');

		case 'rain':
		case 'rain-n':
			return addPath('Rain-1992.gif');

		case 'rain_showers':
			return addPath('Scattered-Showers-1994.gif');

		case 'rain_showers-n':
			return addPath('Scattered-Showers-Night-1994.gif');

		case 'rain_showers_hi':
			return addPath('Scattered-Showers-1994.gif');

		case 'rain_showers_hi-n':
			return addPath('Scattered-Showers-Night-1994.gif');

		case 'snow':
		case 'snow-n':
			if (probability > 50) return addPath('Heavy-Snow-1994.gif');
			return addPath('Light-Snow.gif');

		case 'rain_snow':
		case 'rain_snow-n':
			return addPath('Rain-Snow-1992.gif');

		case 'rain_sleet':
			return addPath('Rain-Sleet.gif');

		case 'snow_sleet':
		case 'snow_sleet-n':
			return addPath('Snow-Sleet.gif');

		case 'sleet':
		case 'sleet-n':
			return addPath('Sleet.gif');

		case 'fzra':
		case 'fzra-n':
			return addPath('Freezing-Rain-1992.gif');

		case 'rain_fzra':
		case 'rain_fzra-n':
			return addPath('Freezing-Rain-1992.gif');

		case 'snow_fzra':
		case 'snow_fzra-n':
			return addPath('Freezing-Rain-Snow-1994.gif');

		case 'tsra':
			return addPath('Scattered-Tstorms-1994.gif');

		case 'tsra-n':
			return addPath('Scattered-Tstorms-Night-1994.gif');

		case 'tsra_sct':
			return addPath('Scattered-Tstorms-1994.gif');

		case 'tsra_sct-n':
			return addPath('Scattered-Tstorms-Night-1994.gif');

		case 'tsra_hi':
		case 'tsra_hi-n':
			return addPath('Thunderstorm.gif');

		case 'tornado':
		case 'tornado-n':
			return addPath('Thunderstorm.gif');

		case 'hurricane':
		case 'hurricane-n':
			return addPath('Thunderstorm.gif');

		case 'tropical_storm':
		case 'tropical_storm-n':
			return addPath('Thunderstorm.gif');

		case 'wind_skc':
			return addPath('Sunny-Wind-1994.gif');

		case 'wind_skc-n':
			return addPath('Clear-Wind-1994.gif');

		case 'wind_few':
		case 'wind_few-n':
			return addPath('Wind.gif');

		case 'wind_sct':
			return addPath('Wind.gif');

		case 'wind_sct-n':
			return addPath('Clear-Wind-1994.gif');

		case 'wind_bkn':
		case 'wind_bkn-n':
			return addPath('Cloudy-Wind.gif');

		case 'wind_ovc':
		case 'wind_ovc-n':
			return addPath('Cloudy-Wind.gif');

		case 'dust':
		case 'dust-n':
			return addPath('Smoke.gif');

		case 'smoke':
		case 'smoke-n':
			return addPath('Smoke.gif');

		case 'haze':
		case 'haze-n':
			return addPath('Haze.gif');

		case 'hot':
			return addPath('Hot.gif');

		case 'cold':
		case 'cold-n':
			return addPath('Cold.gif');

		case 'blizzard':
		case 'blizzard-n':
			return addPath('Blowing-Snow.gif');

		default:
			console.warn(`Unknown weather condition '${conditionIcon}' from ${link}; using fallback icon`);
			// Return a reasonable fallback instead of false to prevent downstream errors
			return addPath(isNightTime ? 'Clear-1992.gif' : 'Sunny.gif');
	}
};

export default smallIcon;

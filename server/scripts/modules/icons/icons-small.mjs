// internal function to add path to returned icon
const addPath = (icon) => `images/icons/regional-maps/${icon}`;

const smallIcon = (link, _isNightTime) => {
	// extract day or night if not provided
	const isNightTime = _isNightTime ?? link.indexOf('/night/') >= 0;

	// grab everything after the last slash ending at any of these: ?&,
	const afterLastSlash = link.toLowerCase().match(/[^/]+$/)[0];
	let conditionName = afterLastSlash.match(/(.*?)[&,.?]/)[1];
	// using probability as a crude heavy/light indication where possible
	const value = +(link.match(/,(\d{2,3})/) ?? [0, 100])[1];

	// if a 'DualImage' is captured, adjust to just the j parameter
	if (conditionName === 'dualimage') {
		const match = link.match(/&j=(.*)&/);
		[, conditionName] = match;
	}

	// find the icon
	switch (conditionName + (isNightTime ? '-n' : '')) {
		case 'skc':
			return addPath('Sunny.gif');

		case 'skc-n':
		case 'nskc':
		case 'nskc-n':
		case 'cold-n':
			return addPath('Clear-1992.gif');

		case 'bkn':
			return addPath('Mostly-Cloudy-1994.gif');

		case 'bkn-n':
		case 'few-n':
		case 'nfew-n':
		case 'nfew':
			return addPath('Partly-Clear-1994.gif');

		case 'sct':
		case 'few':
			return addPath('Partly-Cloudy.gif');

		case 'sct-n':
		case 'nsct':
		case 'nsct-n':
			return addPath('Partly-Cloudy-Night.gif');

		case 'ovc':
		case 'ovc-n':
			return addPath('Cloudy.gif');

		case 'fog':
		case 'fog-n':
			return addPath('Fog.gif');

		case 'rain_sleet':
			return addPath('Rain-Sleet.gif');

		case 'rain_showers':
		case 'rain_showers_high':
			return addPath('Scattered-Showers-1994.gif');

		case 'rain_showers-n':
		case 'rain_showers_high-n':
			return addPath('Scattered-Showers-Night-1994.gif');

		case 'rain':
		case 'rain-n':
			return addPath('Rain-1992.gif');

		case 'snow':
		case 'snow-n':
			if (value > 50) return addPath('Heavy-Snow-1994.gif');
			return addPath('Light-Snow.gif');

		case 'rain_snow':
		case 'rain_snow-n':
			return addPath('Rain-Snow-1992.gif');

		case 'snow_fzra':
		case 'snow_fzra-n':
			return addPath('Freezing-Rain-Snow-1994.gif');

		case 'fzra':
		case 'fzra-n':
		case 'rain_fzra':
		case 'rain_fzra-n':
			return addPath('Freezing-Rain-1992.gif');

		case 'snow_sleet':
		case 'snow_sleet-n':
			return addPath('Snow-Sleet.gif');

		case 'sleet':
		case 'sleet-n':
			return addPath('Sleet.gif');

		case 'tsra_sct':
		case 'tsra':
			return addPath('Scattered-Tstorms-1994.gif');

		case 'tsra_sct-n':
		case 'tsra-n':
			return addPath('Scattered-Tstorms-Night-1994.gif');

		case 'tsra_hi':
		case 'tsra_hi-n':
		case 'hurricane':
		case 'tropical_storm':
		case 'hurricane-n':
		case 'tropical_storm-n':
			return addPath('Thunderstorm.gif');

		case 'wind':
		case 'wind_few':
		case 'wind_sct':
		case 'wind-n':
		case 'wind_few-n':
			return addPath('Wind.gif');

		case 'wind_bkn':
		case 'wind_ovc':
		case 'wind_bkn-n':
		case 'wind_ovc-n':
			return addPath('Cloudy-Wind.gif');

		case 'wind_skc':
			return addPath('Sunny-Wind-1994.gif');

		case 'wind_skc-n':
		case 'wind_sct-n':
			return addPath('Clear-Wind-1994.gif');

		case 'blizzard':
		case 'blizzard-n':
			return addPath('Blowing Snow.gif');

		case 'cold':
			return addPath('Cold.gif');

		case 'smoke':
		case 'smoke-n':
			return addPath('Smoke.gif');

		case 'hot':
			return addPath('Hot.gif');

		case 'haze':
			return addPath('Haze.gif');

		default:
			console.log(`Unable to locate regional icon for ${conditionName} ${link} ${isNightTime}`);
			return false;
	}
};

export default smallIcon;

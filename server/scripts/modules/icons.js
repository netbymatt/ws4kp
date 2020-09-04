'use strict';

// eslint-disable-next-line no-unused-vars
const icons = (() => {
	// internal function to add path to returned icon
	const addPath = (icon) => `images/r/${icon}`;

	const getWeatherRegionalIconFromIconLink = (link, isNightTime) => {
	// extract day or night if not provided
		if (isNightTime === undefined) isNightTime = link.indexOf('/night/') >=0;

		// grab everything after the last slash ending at any of these: ?&,
		const afterLastSlash = link.toLowerCase().match(/[^/]+$/)[0];
		let conditionName = afterLastSlash.match(/(.*?)[,?&.]/)[1];

		// if a 'DualImage' is captured, adjust to just the j parameter
		if (conditionName === 'dualimage') {
			const match = link.match(/&j=(.*)&/);
			conditionName = match[1];
		}


		// find the icon
		switch (conditionName + (isNightTime?'-n':'')) {
		case 'skc':
		case 'hot':
		case 'haze':
			return addPath('Sunny.gif');

		case 'skc-n':
		case 'nskc':
		case 'nskc-n':
			return addPath('Clear-1992.gif');

		case 'bkn':
			return addPath('Mostly-Cloudy-1994-2.gif');

		case 'bkn-n':
		case 'few-n':
		case 'nfew-n':
		case 'nfew':
			return addPath('Partly-Clear-1994-2.gif');

		case 'sct':
		case 'few':
			return addPath('Partly-Cloudy.gif');

		case 'sct-n':
		case 'nsct':
		case 'nsct-n':
			return addPath('Mostly-Clear.gif');

		case 'ovc':
			return addPath('Cloudy.gif');

		case 'fog':
			return addPath('Fog.gif');

		case 'rain_sleet':
			return addPath('Sleet.gif');

		case 'rain_showers':
		case 'rain_showers_high':
			return addPath('Scattered-Showers-1994-2.gif');

		case 'rain_showers-n':
		case 'rain_showers_high-n':
			return addPath('Scattered-Showers-Night-1994-2.gif');

		case 'rain':
			return addPath('Rain-1992.gif');

			// case 'snow':
			// 	return addPath('Light-Snow.gif');
			// 	break;

			// case 'cc_snowshowers.gif':
			// 	//case "heavy-snow.gif":
			// 	return addPath('AM-Snow-1994.gif');
			// 	break;

		case 'snow':
			return addPath('Heavy-Snow-1994-2.gif');

		case 'rain_snow':
			return addPath('Rain-Snow-1992.gif');

		case 'snow_fzra':
			return addPath('Freezing-Rain-Snow-1992.gif');

		case 'fzra':
			return addPath('Freezing-Rain-1992.gif');

		case 'snow_sleet':
			return addPath('Wintry-Mix-1992.gif');

		case 'tsra_sct':
		case 'tsra':
			return addPath('Scattered-Tstorms-1994-2.gif');

		case 'tsra_sct-n':
		case 'tsra-n':
			return addPath('Scattered-Tstorms-Night-1994-2.gif');

		case 'tsra_hi':
		case 'tsra_hi-n':
		case 'hurricane':
			return addPath('Thunderstorm.gif');

		case 'wind_few':
		case 'wind_sct':
		case 'wind_bkn':
		case 'wind_ovc':
			return addPath('Wind.gif');

		case 'wind_skc':
			return addPath('Sunny-Wind-1994.gif');

		case 'wind_skc-n':
			return addPath('Clear-Wind-1994.gif');

		case 'blizzard':
			return addPath('Blowing Snow.gif');

		default:
			console.log(`Unable to locate regional icon for ${link} ${isNightTime}`);
			return false;
		}
	};

	const getWeatherIconFromIconLink = function (link, OverrideIsDay = true) {
	// grab everything after the last slash ending at any of these: ?&,
		const afterLastSlash = link.toLowerCase().match(/[^/]+$/)[0];
		let conditionName = afterLastSlash.match(/(.*?)[,?&.]/)[1];

		// if a 'DualImage' is captured, adjust to just the j parameter
		if (conditionName === 'dualimage') {
			const match = link.match(/&j=(.*)&/);
			conditionName = match[1];
		}


		// find the icon
		switch (conditionName + (!OverrideIsDay?'-n':'')) {


		case 'skc':
			return addPath('Sunny.gif');

		case 'skc-n':
			return addPath('Clear.gif');

		case 'cc_mostlycloudy1.gif':
			return addPath('Mostly-Cloudy.gif');

		case 'cc_mostlycloudy0.gif':
			return addPath('Partly-Clear.gif');

		case 'cc_partlycloudy1.gif':
			return addPath('Partly-Cloudy.gif');

		case 'cc_partlycloudy0.gif':
			return addPath('Mostly-Clear.gif');

		case 'cc_cloudy.gif':
			return addPath('Cloudy.gif');

		case 'cc_fog.gif':
			return addPath('Fog.gif');

		case 'sleet.gif':
			return addPath('Sleet.gif');

		case 'ef_scatshowers.gif':
			return addPath('Scattered-Showers.gif');

		case 'cc_showers.gif':
			return addPath('Shower.gif');

		case 'cc_rain.gif':
			return addPath('Rain.gif');

		//case "ef_scatsnowshowers.gif":
		case 'light-snow.gif':
			return addPath('Light-Snow.gif');

		case 'cc_snowshowers.gif':
			return addPath('Heavy-Snow.gif');

		case 'cc_snow.gif':
		case 'heavy-snow.gif':
			return addPath('Heavy-Snow.gif');

		case 'cc_rainsnow.gif':
		//return addPath("Ice-Snow.gif");
			return addPath('Rain-Snow.gif');

		case 'cc_freezingrain.gif':
			return addPath('Freezing-Rain.gif');

		case 'cc_mix.gif':
			return addPath('Wintry-Mix.gif');

		case 'freezing-rain-sleet.gif':
			return addPath('Freezing-Rain-Sleet.gif');

		case 'snow-sleet.gif':
			return addPath('Snow-Sleet.gif');

		case 'ef_scattstorms.gif':
			return addPath('Scattered-Tstorms.gif');

		case 'ef_scatsnowshowers.gif':
			return addPath('Scattered-Snow-Showers.gif');

		case 'cc_tstorm.gif':
		case 'ef_isolatedtstorms.gif':
			return addPath('Thunderstorm.gif');

		case 'cc_windy.gif':
		case 'cc_windy2.gif':
			return addPath('Windy.gif');

		case 'blowing-snow.gif':
			return addPath('Blowing-Snow.gif');

		default:
			console.error('Unable to locate icon for \'' + link + '\'');
			return false;
		}
	};

	return {
		getWeatherIconFromIconLink,
		getWeatherRegionalIconFromIconLink,
	};
})();

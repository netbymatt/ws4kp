const hourlyIcon = (skyCover, weather, iceAccumulation, probabilityOfPrecipitation, snowfallAmount, windSpeed, isNight = false) => {
	// internal function to add path to returned icon
	const addPath = (icon) => `images/icons/regional-maps/${icon}`;

	// possible phenomenon
	let thunder = false;
	let snow = false;
	let ice = false;
	let fog = false;
	let wind = false;

	// test the phenomenon for various value if it is provided.
	weather.forEach((phenomenon) => {
		if (!phenomenon.weather) return;
		if (phenomenon.weather.toLowerCase().includes('thunder')) thunder = true;
		if (phenomenon.weather.toLowerCase().includes('snow')) snow = true;
		if (phenomenon.weather.toLowerCase().includes('ice')) ice = true;
		if (phenomenon.weather.toLowerCase().includes('fog')) fog = true;
		if (phenomenon.weather.toLowerCase().includes('wind')) wind = true;
	});

	// first item in list is highest priority, units are metric where applicable
	if (iceAccumulation > 0 || ice) return addPath('Freezing-Rain-1992.gif');
	if (snowfallAmount > 10) {
		if (windSpeed > 30 || wind) return addPath('Blowing-Snow.gif');
		return addPath('Heavy-Snow-1994.gif');
	}
	if ((snowfallAmount > 0 || snow) && thunder) return addPath('ThunderSnow.gif');
	if (snowfallAmount > 0 || snow) return addPath('Light-Snow.gif');
	if (thunder) return (addPath('Thunderstorm.gif'));
	if (probabilityOfPrecipitation > 70) return addPath('Rain-1992.gif');
	if (probabilityOfPrecipitation > 30) {
		if (!isNight) return addPath('Scattered-Showers-1994.gif');
		return addPath('Scattered-Showers-Night-1994.gif');
	}
	if (fog) return addPath('Fog.gif');
	if (skyCover > 70) return addPath('Cloudy.gif');
	if (skyCover > 50) {
		if (!isNight) return addPath('Mostly-Cloudy-1994.gif');
		return addPath('Partly-Clear-1994.gif');
	}
	if (skyCover > 30) {
		if (!isNight) return addPath('Partly-Cloudy.gif');
		return addPath('Partly-Cloudy-Night.gif');
	}
	if (isNight) return addPath('Clear-1992.gif');
	return addPath('Sunny.gif');
};

export default hourlyIcon;

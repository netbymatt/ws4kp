// provide regional forecast and regional observations on a map
// this is a two stage process because the data is shared between both
// and allows for three instances of RegionalForecast to use the same data

/* globals utils, _StationInfo, _RegionalCities */

// a shared global object is used to handle the data for all instances of regional weather
// eslint-disable-next-line no-unused-vars
const RegionalForecastData = (() => {
	let dataPromise;
	let lastWeatherParameters;

	// update the data by providing weatherParamaters
	const updateData = (weatherParameters) => {
		// test for new data comparing weather paramaters
		if (utils.object.shallowEqual(lastWeatherParameters, weatherParameters)) return dataPromise;
		// update the promise by calling get data
		lastWeatherParameters = weatherParameters;
		dataPromise = getData(weatherParameters);
		return dataPromise;
	};

	// return an array of cities each containing an array of 3 weather paramaters 0 = current observation, 1,2 = next forecast periods
	const getData = async (weatherParameters) => {
		// map offset
		const offsetXY = {
			x: 240,
			y: 117,
		};
		// get user's location in x/y
		const sourceXY = getXYFromLatitudeLongitude(weatherParameters.latitude, weatherParameters.longitude, offsetXY.x, offsetXY.y, weatherParameters.state);

		// get latitude and longitude limits
		const minMaxLatLon = getMinMaxLatitudeLongitude(sourceXY.x, sourceXY.y, offsetXY.x, offsetXY.y, weatherParameters.state);

		// get a target distance
		let targetDistance = 2.5;
		if (weatherParameters.State === 'HI') targetDistance = 1;

		// make station info into an array
		const stationInfoArray = Object.keys(_StationInfo).map(key => Object.assign({}, _StationInfo[key], {Name: _StationInfo[key].City, targetDistance}));
		// combine regional cities with station info for additional stations
		// stations are intentionally after cities to allow cities priority when drawing the map
		const combinedCities = [..._RegionalCities, ...stationInfoArray];

		// Determine which cities are within the max/min latitude/longitude.
		const regionalCities = [];
		combinedCities.forEach(city => {
			if (city.Latitude > minMaxLatLon.minLat && city.Latitude < minMaxLatLon.maxLat &&
				city.Longitude > minMaxLatLon.minLon && city.Longitude < minMaxLatLon.maxLon - 1) {
			// default to 1 for cities loaded from _RegionalCities, use value calculate above for remaining stations
				const targetDistance = city.targetDistance || 1;
				// Only add the city as long as it isn't within set distance degree of any other city already in the array.
				const okToAddCity = regionalCities.reduce((acc, testCity) => {
					const distance = utils.calc.distance(city.Longitude, city.Latitude, testCity.Longitude, testCity.Latitude);
					return acc && distance >= targetDistance;
				}, true);
				if (okToAddCity) regionalCities.push(city);
			}
		});

		// get regional forecasts and observations (the two are intertwined due to the design of api.weather.gov)
		const regionalForecastPromises = regionalCities.map(async city => {
			try {
			// get the point first, then break down into forecast and observations
				const point = await utils.weather.getPoint(city.Latitude, city.Longitude);

				// start off the observation task
				const observationPromise = getRegionalObservation(point, city);

				const forecast = await $.ajax({
					url: point.properties.forecast,
					dataType: 'json',
					crossDomain: true,
				});

				// get XY on map for city
				const cityXY = getXYForCity(city, minMaxLatLon.maxLat, minMaxLatLon.minLon, weatherParameters.state);

				// wait for the regional observation if it's not done yet
				const observation = await observationPromise;
				// format the observation the same as the forecast
				const regionalObservation = {
					daytime: !!observation.icon.match(/\/day\//),
					temperature: utils.units.celsiusToFahrenheit(observation.temperature.value),
					name: city.Name,
					icon: observation.icon,
					x: cityXY.x,
					y: cityXY.y,
				};

				// return a pared-down forecast
				// 0th object is the current conditions
				// first object is the next period i.e. if it's daytime then it's the "tonight" forecast
				// second object is the following period
				// always skip the first forecast index because it's what's going on right now
				return [
					regionalObservation,
					buildForecast(forecast.properties.periods[1], city, cityXY),
					buildForecast(forecast.properties.periods[2], city, cityXY),
				];
			} catch (e) {
				console.log(`No regional forecast data for '${city.Name}'`);
				console.error(e);
				return false;
			}
		});

		// wait for the forecasts
		const regionalDataAll = await Promise.all(regionalForecastPromises);
		// filter out any false (unavailable data)
		const regionalData = regionalDataAll.filter(data => data);

		// return the weather data and offsets
		return {
			regionalData,
			offsetXY,
			sourceXY,
		};
	};

	const buildForecast = (forecast, city, cityXY) => ({
		daytime: forecast.isDaytime,
		temperature: forecast.temperature||0,
		name: city.Name,
		icon: forecast.icon,
		x: cityXY.x,
		y: cityXY.y,
	});

	const getRegionalObservation = async (point, city) => {
		try {
			// get stations
			const stations = await $.ajax({
				type: 'GET',
				url: point.properties.observationStations,
				dataType: 'json',
				crossDomain: true,
			});

			// get the first station
			const station = stations.features[0].id;
			// get the observation data
			const observation = await $.ajax({
				type: 'GET',
				url: `${station}/observations/latest`,
				dataType: 'json',
				crossDomain: true,
			});
			// return the observation
			return observation.properties;
		} catch (e) {
			console.log(`Unable to get regional observations for ${city.Name}`);
			console.error(e);
			return false;
		}
	};

	// return the data promise so everyone gets the same thing at the same time
	const getDataPromise = () => dataPromise;

	// utility latitude/pixel conversions
	const getXYFromLatitudeLongitude = (Latitude, Longitude, OffsetX, OffsetY, state) => {
		if (state === 'AK') return getXYFromLatitudeLongitudeAK(...arguments);
		if (state === 'HI') return getXYFromLatitudeLongitudeHI(...arguments);
		let y = 0;
		let x = 0;
		const ImgHeight = 1600;
		const ImgWidth = 2550;

		y = (50.5 - Latitude) * 55.2;
		y -= OffsetY; // Centers map.
		// Do not allow the map to exceed the max/min coordinates.
		if (y > (ImgHeight - (OffsetY * 2))) {
			y = ImgHeight - (OffsetY * 2);
		} else if (y < 0) {
			y = 0;
		}

		x = ((-127.5 - Longitude) * 41.775) * -1;
		x -= OffsetX; // Centers map.
		// Do not allow the map to exceed the max/min coordinates.
		if (x > (ImgWidth - (OffsetX * 2))) {
			x = ImgWidth - (OffsetX * 2);
		} else if (x < 0) {
			x = 0;
		}

		return { x, y };
	};

	const getXYFromLatitudeLongitudeAK = (Latitude, Longitude, OffsetX, OffsetY) => {
		let y = 0;
		let x = 0;
		const ImgHeight = 1142;
		const ImgWidth = 1200;

		y = (73.0 - Latitude) * 56;
		y -= OffsetY; // Centers map.
		// Do not allow the map to exceed the max/min coordinates.
		if (y > (ImgHeight - (OffsetY * 2))) {
			y = ImgHeight - (OffsetY * 2);
		} else if (y < 0) {
			y = 0;
		}

		x = ((-175.0 - Longitude) * 25.0) * -1;
		x -= OffsetX; // Centers map.
		// Do not allow the map to exceed the max/min coordinates.
		if (x > (ImgWidth - (OffsetX * 2))) {
			x = ImgWidth - (OffsetX * 2);
		} else if (x < 0) {
			x = 0;
		}

		return { x, y };
	};

	const getXYFromLatitudeLongitudeHI = (Latitude, Longitude, OffsetX, OffsetY) => {
		let y = 0;
		let x = 0;
		const ImgHeight = 571;
		const ImgWidth = 600;

		y = (25 - Latitude) * 55.2;
		y -= OffsetY; // Centers map.
		// Do not allow the map to exceed the max/min coordinates.
		if (y > (ImgHeight - (OffsetY * 2))) {
			y = ImgHeight - (OffsetY * 2);
		} else if (y < 0) {
			y = 0;
		}

		x = ((-164.5 - Longitude) * 41.775) * -1;
		x -= OffsetX; // Centers map.
		// Do not allow the map to exceed the max/min coordinates.
		if (x > (ImgWidth - (OffsetX * 2))) {
			x = ImgWidth - (OffsetX * 2);
		} else if (x < 0) {
			x = 0;
		}

		return { x, y };
	};

	const getMinMaxLatitudeLongitude = function (X, Y, OffsetX, OffsetY, state) {
		if (state === 'AK') return getMinMaxLatitudeLongitudeAK(...arguments);
		if (state === 'HI') return getMinMaxLatitudeLongitudeHI(...arguments);
		const maxLat = ((Y / 55.2) - 50.5) * -1;
		const minLat = (((Y + (OffsetY * 2)) / 55.2) - 50.5) * -1;
		const minLon = (((X * -1) / 41.775) + 127.5) * -1;
		const maxLon = ((((X + (OffsetX * 2)) * -1) / 41.775) + 127.5) * -1;

		return { minLat, maxLat, minLon, maxLon };
	};

	const getMinMaxLatitudeLongitudeAK = (X, Y, OffsetX, OffsetY) => {
		const maxLat = ((Y / 56) - 73.0) * -1;
		const minLat = (((Y + (OffsetY * 2)) / 56) - 73.0) * -1;
		const minLon = (((X * -1) / 25) + 175.0) * -1;
		const maxLon = ((((X + (OffsetX * 2)) * -1) / 25) + 175.0) * -1;

		return { minLat, maxLat, minLon, maxLon };
	};

	const getMinMaxLatitudeLongitudeHI = (X, Y, OffsetX, OffsetY) => {
		const maxLat = ((Y / 55.2) - 25) * -1;
		const minLat = (((Y + (OffsetY * 2)) / 55.2) - 25) * -1;
		const minLon = (((X * -1) / 41.775) + 164.5) * -1;
		const maxLon = ((((X + (OffsetX * 2)) * -1) / 41.775) + 164.5) * -1;

		return { minLat, maxLat, minLon, maxLon };
	};

	const getXYForCity = (City, MaxLatitude, MinLongitude, state) => {
		if (state === 'AK') getXYForCityAK(...arguments);
		if (state === 'HI') getXYForCityHI(...arguments);
		let x = (City.Longitude - MinLongitude) * 57;
		let y = (MaxLatitude - City.Latitude) * 70;

		if (y < 30) y = 30;
		if (y > 282) y = 282;

		if (x < 40) x = 40;
		if (x > 580) x = 580;

		return { x, y };
	};

	const getXYForCityAK = (City, MaxLatitude, MinLongitude) => {
		let x = (City.Longitude - MinLongitude) * 37;
		let y = (MaxLatitude - City.Latitude) * 70;

		if (y < 30) y = 30;
		if (y > 282) y = 282;

		if (x < 40) x = 40;
		if (x > 580) x = 580;
		return { x, y };
	};

	const getXYForCityHI = (City, MaxLatitude, MinLongitude) => {
		let x = (City.Longitude - MinLongitude) * 57;
		let y = (MaxLatitude - City.Latitude) * 70;

		if (y < 30) y = 30;
		if (y > 282) y = 282;

		if (x < 40) x = 40;
		if (x > 580) x = 580;

		return { x, y };
	};

	return {
		updateData,
		getDataPromise,
	};
})();
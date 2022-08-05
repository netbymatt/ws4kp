// regional forecast and observations
// type 0 = observations, 1 = first forecast, 2 = second forecast

/* globals WeatherDisplay, utils, STATUS, icons, UNITS, navigation, luxon, StationInfo, RegionalCities */

// eslint-disable-next-line no-unused-vars
class RegionalForecast extends WeatherDisplay {
	constructor(navId, elemId) {
		super(navId, elemId, 'Regional Forecast', true, true);

		// pre-load background image (returns promise)
		this.backgroundImage = utils.image.load('images/BackGround5_1.png');

		// timings
		this.timing.totalScreens = 3;
	}

	async getData(_weatherParameters) {
		super.getData(_weatherParameters);
		const weatherParameters = _weatherParameters ?? this.weatherParameters;

		// pre-load the base map
		this.baseMap = 'images/Basemap2.png';
		if (weatherParameters.state === 'HI') {
			this.baseMap = 'images/HawaiiRadarMap4.png';
		} else if (weatherParameters.state === 'AK') {
			this.baseMap = 'images/AlaskaRadarMap6.png';
		}
		this.elem.querySelector('.map img').src = this.baseMap;

		// map offset
		const offsetXY = {
			x: 240,
			y: 117,
		};
		// get user's location in x/y
		const sourceXY = RegionalForecast.getXYFromLatitudeLongitude(weatherParameters.latitude, weatherParameters.longitude, offsetXY.x, offsetXY.y, weatherParameters.state);

		// get latitude and longitude limits
		const minMaxLatLon = RegionalForecast.getMinMaxLatitudeLongitude(sourceXY.x, sourceXY.y, offsetXY.x, offsetXY.y, weatherParameters.state);

		// get a target distance
		let targetDistance = 2.5;
		if (weatherParameters.state === 'HI') targetDistance = 1;

		// make station info into an array
		const stationInfoArray = Object.values(StationInfo).map((value) => ({ ...value, targetDistance }));
		// combine regional cities with station info for additional stations
		// stations are intentionally after cities to allow cities priority when drawing the map
		const combinedCities = [...RegionalCities, ...stationInfoArray];

		// Determine which cities are within the max/min latitude/longitude.
		const regionalCities = [];
		combinedCities.forEach((city) => {
			if (city.lat > minMaxLatLon.minLat && city.lat < minMaxLatLon.maxLat
						&& city.lon > minMaxLatLon.minLon && city.lon < minMaxLatLon.maxLon - 1) {
				// default to 1 for cities loaded from RegionalCities, use value calculate above for remaining stations
				const targetDist = city.targetDistance || 1;
				// Only add the city as long as it isn't within set distance degree of any other city already in the array.
				const okToAddCity = regionalCities.reduce((acc, testCity) => {
					const distance = utils.calc.distance(city.lon, city.lat, testCity.lon, testCity.lat);
					return acc && distance >= targetDist;
				}, true);
				if (okToAddCity) regionalCities.push(city);
			}
		});

		// get regional forecasts and observations (the two are intertwined due to the design of api.weather.gov)
		const regionalForecastPromises = regionalCities.map(async (city) => {
			try {
				// get the point first, then break down into forecast and observations
				const point = await utils.weather.getPoint(city.lat, city.lon);

				// start off the observation task
				const observationPromise = RegionalForecast.getRegionalObservation(point, city);

				const forecast = await utils.fetch.json(point.properties.forecast);

				// get XY on map for city
				const cityXY = RegionalForecast.getXYForCity(city, minMaxLatLon.maxLat, minMaxLatLon.minLon, weatherParameters.state);

				// wait for the regional observation if it's not done yet
				const observation = await observationPromise;
				// format the observation the same as the forecast
				const regionalObservation = {
					daytime: !!observation.icon.match(/\/day\//),
					temperature: utils.units.celsiusToFahrenheit(observation.temperature.value),
					name: RegionalForecast.formatCity(city.city),
					icon: observation.icon,
					x: cityXY.x,
					y: cityXY.y,
				};

				// preload the icon
				utils.image.preload(icons.getWeatherRegionalIconFromIconLink(regionalObservation.icon, !regionalObservation.daytime));

				// return a pared-down forecast
				// 0th object is the current conditions
				// first object is the next period i.e. if it's daytime then it's the "tonight" forecast
				// second object is the following period
				// always skip the first forecast index because it's what's going on right now
				return [
					regionalObservation,
					RegionalForecast.buildForecast(forecast.properties.periods[1], city, cityXY),
					RegionalForecast.buildForecast(forecast.properties.periods[2], city, cityXY),
				];
			} catch (e) {
				console.log(`No regional forecast data for '${city.name}'`);
				console.log(e);
				return false;
			}
		});

		// wait for the forecasts
		const regionalDataAll = await Promise.all(regionalForecastPromises);
		// filter out any false (unavailable data)
		const regionalData = regionalDataAll.filter((data) => data);

		// test for data present
		if (regionalData.length === 0) {
			this.setStatus(STATUS.noData);
			return;
		}

		// return the weather data and offsets
		this.data = {
			regionalData,
			offsetXY,
			sourceXY,
		};

		this.setStatus(STATUS.loaded);
	}

	static buildForecast(forecast, city, cityXY) {
		return {
			daytime: forecast.isDaytime,
			temperature: forecast.temperature || 0,
			name: RegionalForecast.formatCity(city.city),
			icon: forecast.icon,
			x: cityXY.x,
			y: cityXY.y,
			time: forecast.startTime,
		};
	}

	static async getRegionalObservation(point, city) {
		try {
			// get stations
			const stations = await utils.fetch.json(point.properties.observationStations);

			// get the first station
			const station = stations.features[0].id;
			// get the observation data
			const observation = await utils.fetch.json(`${station}/observations/latest`);
			// preload the image
			utils.image.preload(icons.getWeatherRegionalIconFromIconLink(observation.properties.icon, !observation.properties.daytime));
			// return the observation
			return observation.properties;
		} catch (e) {
			console.log(`Unable to get regional observations for ${city.Name}`);
			console.error(e.status, e.responseJSON);
			return false;
		}
	}

	// utility latitude/pixel conversions
	static getXYFromLatitudeLongitude(Latitude, Longitude, OffsetX, OffsetY, state) {
		if (state === 'AK') return RegionalForecast.getXYFromLatitudeLongitudeAK(Latitude, Longitude, OffsetX, OffsetY);
		if (state === 'HI') return RegionalForecast.getXYFromLatitudeLongitudeHI(Latitude, Longitude, OffsetX, OffsetY);
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
	}

	static getXYFromLatitudeLongitudeAK(Latitude, Longitude, OffsetX, OffsetY) {
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
	}

	static getXYFromLatitudeLongitudeHI(Latitude, Longitude, OffsetX, OffsetY) {
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
	}

	static getMinMaxLatitudeLongitude(X, Y, OffsetX, OffsetY, state) {
		if (state === 'AK') return RegionalForecast.getMinMaxLatitudeLongitudeAK(X, Y, OffsetX, OffsetY);
		if (state === 'HI') return RegionalForecast.getMinMaxLatitudeLongitudeHI(X, Y, OffsetX, OffsetY);
		const maxLat = ((Y / 55.2) - 50.5) * -1;
		const minLat = (((Y + (OffsetY * 2)) / 55.2) - 50.5) * -1;
		const minLon = (((X * -1) / 41.775) + 127.5) * -1;
		const maxLon = ((((X + (OffsetX * 2)) * -1) / 41.775) + 127.5) * -1;

		return {
			minLat, maxLat, minLon, maxLon,
		};
	}

	static getMinMaxLatitudeLongitudeAK(X, Y, OffsetX, OffsetY) {
		const maxLat = ((Y / 56) - 73.0) * -1;
		const minLat = (((Y + (OffsetY * 2)) / 56) - 73.0) * -1;
		const minLon = (((X * -1) / 25) + 175.0) * -1;
		const maxLon = ((((X + (OffsetX * 2)) * -1) / 25) + 175.0) * -1;

		return {
			minLat, maxLat, minLon, maxLon,
		};
	}

	static getMinMaxLatitudeLongitudeHI(X, Y, OffsetX, OffsetY) {
		const maxLat = ((Y / 55.2) - 25) * -1;
		const minLat = (((Y + (OffsetY * 2)) / 55.2) - 25) * -1;
		const minLon = (((X * -1) / 41.775) + 164.5) * -1;
		const maxLon = ((((X + (OffsetX * 2)) * -1) / 41.775) + 164.5) * -1;

		return {
			minLat, maxLat, minLon, maxLon,
		};
	}

	static getXYForCity(City, MaxLatitude, MinLongitude, state) {
		if (state === 'AK') RegionalForecast.getXYForCityAK(City, MaxLatitude, MinLongitude);
		if (state === 'HI') RegionalForecast.getXYForCityHI(City, MaxLatitude, MinLongitude);
		let x = (City.lon - MinLongitude) * 57;
		let y = (MaxLatitude - City.lat) * 70;

		if (y < 30) y = 30;
		if (y > 282) y = 282;

		if (x < 40) x = 40;
		if (x > 580) x = 580;

		return { x, y };
	}

	static getXYForCityAK(City, MaxLatitude, MinLongitude) {
		let x = (City.lon - MinLongitude) * 37;
		let y = (MaxLatitude - City.lat) * 70;

		if (y < 30) y = 30;
		if (y > 282) y = 282;

		if (x < 40) x = 40;
		if (x > 580) x = 580;
		return { x, y };
	}

	static getXYForCityHI(City, MaxLatitude, MinLongitude) {
		let x = (City.lon - MinLongitude) * 57;
		let y = (MaxLatitude - City.lat) * 70;

		if (y < 30) y = 30;
		if (y > 282) y = 282;

		if (x < 40) x = 40;
		if (x > 580) x = 580;

		return { x, y };
	}

	// to fit on the map, remove anything after punctuation and then limit to 15 characters
	static formatCity(city) {
		return city.match(/[^-;/\\,]*/)[0].substr(0, 12);
	}

	async drawCanvas() {
		super.drawCanvas();
		// break up data into useful values
		const { regionalData: data, sourceXY, offsetXY } = this.data;

		const { DateTime } = luxon;
		// draw the header graphics

		// draw the appropriate title
		const titleTop = this.elem.querySelector('.title.dual .top');
		const titleBottom = this.elem.querySelector('.title.dual .bottom');
		if (this.screenIndex === 0) {
			titleTop.innerHTML = 'Regional';
			titleBottom.innerHTML = 'Observations';
		} else {
			const forecastDate = DateTime.fromISO(data[0][this.screenIndex].time);

			// get the name of the day
			const dayName = forecastDate.toLocaleString({ weekday: 'long' });
			titleTop.innerHTML = 'Forecast for';
			// draw the title
			if (data[0][this.screenIndex].daytime) {
				titleBottom.innerHTML = dayName;
			} else {
				titleBottom.innerHTML = `${dayName} Night`;
			}
		}

		// draw the map
		const scale = 640 / (offsetXY.x * 2);
		const map = this.elem.querySelector('.map');
		map.style.zoom = scale;
		map.style.top = `-${sourceXY.y}px`;
		map.style.left = `-${sourceXY.x}px`;

		const cities = data.map((city) => {
			const fill = {};
			const period = city[this.screenIndex];

			fill.icon = { type: 'img', src: icons.getWeatherRegionalIconFromIconLink(period.icon, !period.daytime) };
			fill.city = period.name;
			let { temperature } = period;
			if (navigation.units() === UNITS.metric) temperature = Math.round(utils.units.fahrenheitToCelsius(temperature));
			fill.temp = temperature;

			const elem = this.fillTemplate('location', fill);
			elem.style.left = `${period.x}px`;
			elem.style.top = `${period.y}px`;

			return elem;
		});

		const locationContainer = this.elem.querySelector('.location-container');
		locationContainer.innerHTML = '';
		locationContainer.append(...cities);

		this.finishDraw();
	}
}

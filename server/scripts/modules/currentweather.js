// current weather conditions display
/* globals WeatherDisplay, utils, STATUS, icons, UNITS, navigation */

// eslint-disable-next-line no-unused-vars
class CurrentWeather extends WeatherDisplay {
	constructor(navId, elemId) {
		super(navId, elemId, 'Current Conditions', true, true);
		// pre-load background image (returns promise)
		this.backgroundImage = utils.image.load('images/BackGround1_1.png');
	}

	async getData(_weatherParameters) {
		super.getData(_weatherParameters);
		const weatherParameters = _weatherParameters ?? this.weatherParameters;

		// Load the observations
		let observations; let
			station;
		// station number counter
		let stationNum = 0;
		while (!observations && stationNum < weatherParameters.stations.length) {
			// get the station
			station = weatherParameters.stations[stationNum];
			stationNum += 1;
			try {
				// station observations
				// eslint-disable-next-line no-await-in-loop
				observations = await utils.fetch.json(`${station.id}/observations`, {
					cors: true,
					data: {
						limit: 2,
					},
				});

				// test data quality
				if (observations.features[0].properties.temperature.value === null
					|| observations.features[0].properties.windSpeed.value === null
					|| observations.features[0].properties.textDescription === null) {
					observations = undefined;
					throw new Error(`Unable to get observations: ${station.properties.stationIdentifier}, trying next station`);
				}
			} catch (e) {
				console.error(e);
			}
		}
		// test for data received
		if (!observations) {
			console.error('All current weather stations exhausted');
			this.setStatus(STATUS.failed);
			return;
		}
		// preload the icon
		utils.image.preload(icons.getWeatherIconFromIconLink(observations.features[0].properties.icon));

		// we only get here if there was no error above
		this.data = { ...observations, station };
		this.setStatus(STATUS.loaded);

		this.getDataCallback();
	}

	// format the data for use outside this function
	parseData() {
		if (!this.data) return false;
		const data = {};
		const observations = this.data.features[0].properties;
		// values from api are provided in metric
		data.observations = observations;
		data.Temperature = Math.round(observations.temperature.value);
		data.TemperatureUnit = 'C';
		data.DewPoint = Math.round(observations.dewpoint.value);
		data.Ceiling = Math.round(observations.cloudLayers[0]?.base?.value ?? 0);
		data.CeilingUnit = 'm.';
		data.Visibility = Math.round(observations.visibility.value / 1000);
		data.VisibilityUnit = ' km.';
		data.WindSpeed = Math.round(observations.windSpeed.value);
		data.WindDirection = utils.calc.directionToNSEW(observations.windDirection.value);
		data.Pressure = Math.round(observations.barometricPressure.value);
		data.HeatIndex = Math.round(observations.heatIndex.value);
		data.WindChill = Math.round(observations.windChill.value);
		data.WindGust = Math.round(observations.windGust.value);
		data.WindUnit = 'KPH';
		data.Humidity = Math.round(observations.relativeHumidity.value);
		data.Icon = icons.getWeatherIconFromIconLink(observations.icon);
		data.PressureDirection = '';
		data.TextConditions = observations.textDescription;
		data.station = this.data.station;

		// difference since last measurement (pascals, looking for difference of more than 150)
		const pressureDiff = (observations.barometricPressure.value - this.data.features[1].properties.barometricPressure.value);
		if (pressureDiff > 150) data.PressureDirection = 'R';
		if (pressureDiff < -150) data.PressureDirection = 'F';

		if (navigation.units() === UNITS.english) {
			data.Temperature = utils.units.celsiusToFahrenheit(data.Temperature);
			data.TemperatureUnit = 'F';
			data.DewPoint = utils.units.celsiusToFahrenheit(data.DewPoint);
			data.Ceiling = Math.round(utils.units.metersToFeet(data.Ceiling) / 100) * 100;
			data.CeilingUnit = 'ft.';
			data.Visibility = utils.units.kilometersToMiles(observations.visibility.value / 1000);
			data.VisibilityUnit = ' mi.';
			data.WindSpeed = utils.units.kphToMph(data.WindSpeed);
			data.WindUnit = 'MPH';
			data.Pressure = utils.units.pascalToInHg(data.Pressure).toFixed(2);
			data.HeatIndex = utils.units.celsiusToFahrenheit(data.HeatIndex);
			data.WindChill = utils.units.celsiusToFahrenheit(data.WindChill);
			data.WindGust = utils.units.kphToMph(data.WindGust);
		}
		return data;
	}

	async drawCanvas() {
		super.drawCanvas();
		const fill = {};
		// parse each time to deal with a change in units if necessary
		const data = this.parseData();

		fill.temp = data.Temperature + String.fromCharCode(176);

		let Conditions = data.observations.textDescription;
		if (Conditions.length > 15) {
			Conditions = this.shortConditions(Conditions);
		}
		fill.condition = Conditions;

		fill.wind = data.WindDirection.padEnd(3, '') + data.WindSpeed.toString().padStart(3, ' ');
		if (data.WindGust) fill['wind-gusts'] = `Gusts to ${data.WindGust}`;

		fill.location = utils.string.locationCleanup(this.data.station.properties.name).substr(0, 20);

		fill.humidity = `${data.Humidity}%`;
		fill.dewpoint = data.DewPoint + String.fromCharCode(176);
		fill.ceiling = (data.Ceiling === 0 ? 'Unlimited' : data.Ceiling + data.CeilingUnit);
		fill.visibility = data.Visibility + data.VisibilityUnit;
		fill.pressure = `${data.Pressure} ${data.PressureDirection}`;

		// switch (data.PressureDirection) {
		// case 'R':
		// // Shadow
		// 	draw.triangle(this.context, '#000000', 552, 302, 542, 312, 562, 312);
		// 	draw.box(this.context, '#000000', 549, 312, 6, 15);

		// 	// Border
		// 	draw.triangle(this.context, '#000000', 550, 300, 540, 310, 560, 310);
		// 	draw.box(this.context, '#000000', 547, 310, 6, 15);

		// 	// Fill
		// 	draw.triangle(this.context, '#FFFF00', 550, 301, 541, 309, 559, 309);
		// 	draw.box(this.context, '#FFFF00', 548, 309, 4, 15);
		// 	break;
		// case 'F':
		// // Shadow
		// 	draw.triangle(this.context, '#000000', 552, 327, 542, 317, 562, 317);
		// 	draw.box(this.context, '#000000', 549, 302, 6, 15);

		// 	// Border
		// 	draw.triangle(this.context, '#000000', 550, 325, 540, 315, 560, 315);
		// 	draw.box(this.context, '#000000', 547, 300, 6, 15);

		// 	// Fill
		// 	draw.triangle(this.context, '#FFFF00', 550, 324, 541, 314, 559, 314);
		// 	draw.box(this.context, '#FFFF00', 548, 301, 4, 15);
		// 	break;
		// default:
		// }

		if (data.observations.heatIndex.value && data.HeatIndex !== data.Temperature) {
			fill['heat-index-label'] = 'Heat Index:';
			fill['heat-index'] = data.HeatIndex + String.fromCharCode(176);
		} else if (data.observations.windChill.value && data.WindChill !== '' && data.WindChill < data.Temperature) {
			fill['heat-index-label'] = 'Wind Chill:';
			fill['heat-index'] = data.WindChill + String.fromCharCode(176);
		}

		fill.icon = { type: 'img', src: data.Icon };

		const area = this.elem.querySelector('.main');

		area.innerHTML = '';
		area.append(this.fillTemplate('weather', fill));

		this.finishDraw();
	}

	// make data available outside this class
	// promise allows for data to be requested before it is available
	async getCurrentWeather() {
		return new Promise((resolve) => {
			if (this.data) resolve(this.parseData());
			// data not available, put it into the data callback queue
			this.getDataCallbacks.push(() => resolve(this.parseData()));
		});
	}

	static shortConditions(_condition) {
		let condition = _condition;
		condition = condition.replace(/Light/g, 'L');
		condition = condition.replace(/Heavy/g, 'H');
		condition = condition.replace(/Partly/g, 'P');
		condition = condition.replace(/Mostly/g, 'M');
		condition = condition.replace(/Few/g, 'F');
		condition = condition.replace(/Thunderstorm/g, 'T\'storm');
		condition = condition.replace(/ in /g, '');
		condition = condition.replace(/Vicinity/g, '');
		condition = condition.replace(/ and /g, ' ');
		condition = condition.replace(/Freezing Rain/g, 'Frz Rn');
		condition = condition.replace(/Freezing/g, 'Frz');
		condition = condition.replace(/Unknown Precip/g, '');
		condition = condition.replace(/L Snow Fog/g, 'L Snw/Fog');
		condition = condition.replace(/ with /g, '/');
		return condition;
	}
}

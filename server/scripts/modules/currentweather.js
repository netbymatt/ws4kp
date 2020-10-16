// current weather conditions display
/* globals WeatherDisplay, utils, STATUS, icons, UNITS, draw, navigation */

// eslint-disable-next-line no-unused-vars
class CurrentWeather extends WeatherDisplay {
	constructor(navId,elemId) {
		super(navId,elemId,'Current Conditions');
		// pre-load background image (returns promise)
		this.backgroundImage = utils.image.load('images/BackGround1_1.png');
	}

	async getData(weatherParameters) {
		super.getData(weatherParameters);
		if (!weatherParameters) weatherParameters = this.weatherParameters;

		// Load the observations
		let observations, station;
		// station number counter
		let stationNum = 0;
		while (!observations && stationNum < weatherParameters.stations.length) {
			// get the station
			station = weatherParameters.stations[stationNum];
			stationNum++;
			try {
				// station observations
				observations = await utils.fetch.json(`${station.id}/observations`,{
					cors: true,
					data: {
						limit: 2,
					},
				});

				// test data quality
				if (observations.features[0].properties.temperature.value === null ||
					observations.features[0].properties.windSpeed.value === null ||
					observations.features[0].properties.textDescription === null) {
					observations = undefined;
					throw new Error(`Unable to get observations: ${station.properties.stationIdentifier}, trying next station`);
				}

			// TODO: add retry for further stations if observations are unavailable
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
		this.data = Object.assign({}, observations, {station: station});
		this.setStatus(STATUS.loaded);
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
		data.Ceiling = Math.round(observations.cloudLayers[0].base.value);
		data.CeilingUnit = 'm.';
		data.Visibility = Math.round(observations.visibility.value/1000);
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

		// difference since last measurement (pascals, looking for difference of more than 150)
		const pressureDiff = (observations.barometricPressure.value - this.data.features[1].properties.barometricPressure.value);
		if (pressureDiff > 150) data.PressureDirection = 'R';
		if (pressureDiff < -150) data.PressureDirection = 'F';

		if (navigation.units() === UNITS.english) {
			data.Temperature = utils.units.celsiusToFahrenheit(data.Temperature);
			data.TemperatureUnit = 'F';
			data.DewPoint = utils.units.celsiusToFahrenheit(data.DewPoint);
			data.Ceiling = Math.round(utils.units.metersToFeet(data.Ceiling)/100)*100;
			data.CeilingUnit = 'ft.';
			data.Visibility = utils.units.kilometersToMiles(observations.visibility.value/1000);
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

	async drawCanvas () {
		super.drawCanvas();
		// parse each time to deal with a change in units if necessary
		const data = this.parseData();

		this.context.drawImage(await this.backgroundImage, 0, 0);
		draw.horizontalGradientSingle(this.context, 0, 30, 500, 90, draw.topColor1, draw.topColor2);
		draw.triangle(this.context, 'rgb(28, 10, 87)', 500, 30, 450, 90, 500, 90);
		draw.horizontalGradientSingle(this.context, 0, 90, 52, 399, draw.sideColor1, draw.sideColor2);
		draw.horizontalGradientSingle(this.context, 584, 90, 640, 399, draw.sideColor1, draw.sideColor2);

		draw.titleText(this.context, 'Current', 'Conditions');

		draw.text(this.context, 'Star4000 Large', '24pt', '#FFFFFF', 170, 135, data.Temperature + String.fromCharCode(176), 2);

		let Conditions = data.observations.textDescription;
		if (Conditions.length > 15) {
			Conditions = this.shortConditions(Conditions);
		}
		draw.text(this.context, 'Star4000 Extended', '24pt', '#FFFFFF', 195, 170, Conditions, 2, 'center');

		draw.text(this.context, 'Star4000 Extended', '24pt', '#FFFFFF', 80, 330, 'Wind:', 2);
		draw.text(this.context, 'Star4000 Extended', '24pt', '#FFFFFF', 300, 330, data.WindDirection + ' ' + data.WindSpeed, 2, 'right');

		if (data.WindGust) draw.text(this.context, 'Star4000 Extended', '24pt', '#FFFFFF', 80, 375, 'Gusts to ' + data.WindGust, 2);

		draw.text(this.context, 'Star4000 Large', 'bold 16pt', '#FFFF00', 315, 120, this.data.station.properties.name.substr(0, 20), 2);

		draw.text(this.context, 'Star4000 Large', 'bold 16pt', '#FFFFFF', 340, 165, 'Humidity:', 2);
		draw.text(this.context, 'Star4000 Large', 'bold 16pt', '#FFFFFF', 560, 165, data.Humidity + '%', 2, 'right');

		draw.text(this.context, 'Star4000 Large', 'bold 16pt', '#FFFFFF', 340, 205, 'Dewpoint:', 2);
		draw.text(this.context, 'Star4000 Large', 'bold 16pt', '#FFFFFF', 560, 205, data.DewPoint + String.fromCharCode(176), 2, 'right');

		draw.text(this.context, 'Star4000 Large', 'bold 16pt', '#FFFFFF', 340, 245, 'Ceiling:', 2);
		draw.text(this.context, 'Star4000 Large', 'bold 16pt', '#FFFFFF', 560, 245, (data.Ceiling === '' ? 'Unlimited' : data.Ceiling + data.CeilingUnit), 2, 'right');

		draw.text(this.context, 'Star4000 Large', 'bold 16pt', '#FFFFFF', 340, 285, 'Visibility:', 2);
		draw.text(this.context, 'Star4000 Large', 'bold 16pt', '#FFFFFF', 560, 285, data.Visibility + data.VisibilityUnit, 2, 'right');

		draw.text(this.context, 'Star4000 Large', 'bold 16pt', '#FFFFFF', 340, 325, 'Pressure:', 2);
		draw.text(this.context, 'Star4000 Large', 'bold 16pt', '#FFFFFF', 535, 325, data.Pressure, 2, 'right');

		switch (data.PressureDirection) {
		case 'R':
		// Shadow
			draw.triangle(this.context, '#000000', 552, 302, 542, 312, 562, 312);
			draw.box(this.context, '#000000', 549, 312, 6, 15);

			// Border
			draw.triangle(this.context, '#000000', 550, 300, 540, 310, 560, 310);
			draw.box(this.context, '#000000', 547, 310, 6, 15);

			// Fill
			draw.triangle(this.context, '#FFFF00', 550, 301, 541, 309, 559, 309);
			draw.box(this.context, '#FFFF00', 548, 309, 4, 15);
			break;
		case 'F':
		// Shadow
			draw.triangle(this.context, '#000000', 552, 327, 542, 317, 562, 317);
			draw.box(this.context, '#000000', 549, 302, 6, 15);

			// Border
			draw.triangle(this.context, '#000000', 550, 325, 540, 315, 560, 315);
			draw.box(this.context, '#000000', 547, 300, 6, 15);

			// Fill
			draw.triangle(this.context, '#FFFF00', 550, 324, 541, 314, 559, 314);
			draw.box(this.context, '#FFFF00', 548, 301, 4, 15);
			break;
		default:
		}

		if (data.observations.heatIndex.value && data.HeatIndex !== data.Temperature) {
			draw.text(this.context, 'Star4000 Large', 'bold 16pt', '#FFFFFF', 340, 365, 'Heat Index:', 2);
			draw.text(this.context, 'Star4000 Large', 'bold 16pt', '#FFFFFF', 560, 365, data.HeatIndex + String.fromCharCode(176), 2, 'right');
		} else if (data.observations.windChill.value && data.WindChill !== '' && data.WindChill < data.Temperature) {
			draw.text(this.context, 'Star4000 Large', 'bold 16pt', '#FFFFFF', 340, 365, 'Wind Chill:', 2);
			draw.text(this.context, 'Star4000 Large', 'bold 16pt', '#FFFFFF', 560, 365, data.WindChill + String.fromCharCode(176), 2, 'right');
		}

		// get main icon
		this.gifs.push(await utils.image.superGifAsync({
			src: data.Icon,
			auto_play: true,
			canvas: this.canvas,
			x: 140,
			y: 175,
			max_width: 126,
		}));

		this.finishDraw();
	}

	// return the latest gathered information if available
	getCurrentWeather() {
		return this.parseData();
	}

	shortConditions(condition) {
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
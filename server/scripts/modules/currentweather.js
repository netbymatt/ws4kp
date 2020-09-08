// current weather conditions display
/* globals WeatherDisplay, utils, STATUS, icons, UNITS, draw, navigation */

// eslint-disable-next-line no-unused-vars
class CurrentWeather extends WeatherDisplay {
	constructor(navId,elemId,weatherParameters) {
		super(navId,elemId,'Current Conditions');
		// pre-load background image (returns promise)
		this.backgroundImage = utils.image.load('images/BackGround1_1.png');

		// get the data
		this.getData(weatherParameters);
	}

	async getData(weatherParameters) {
		super.getData();
		// Load the observations
		let observations, station;
		try {
		// station observations
			const observationsPromise = $.ajaxCORS({
				type: 'GET',
				url: `https://api.weather.gov/stations/${weatherParameters.stationId}/observations`,
				data: {
					limit: 2,
				},
				dataType: 'json',
				crossDomain: true,
			});
			// station info
			const stationPromise = $.ajax({
				type: 'GET',
				url: `https://api.weather.gov/stations/${weatherParameters.stationId}`,
				dataType: 'json',
				crossDomain: true,
			});

			// wait for the promises to resolve
			[observations, station] = await Promise.all([observationsPromise, stationPromise]);

			// TODO: add retry for further stations if observations are unavailable
		} catch (e) {
			console.error('Unable to get current observations');
			console.error(e);
			this.setStatus(STATUS.error);
			return;
		}
		// we only get here if there was no error above
		this.data = Object.assign({}, observations, {station: station});
		this.drawCanvas();
	}

	async drawCanvas () {
		super.drawCanvas();
		const observations = this.data.features[0].properties;
		// values from api are provided in metric
		let Temperature = Math.round(observations.temperature.value);
		let DewPoint = Math.round(observations.dewpoint.value);
		let Ceiling = Math.round(observations.cloudLayers[0].base.value);
		let CeilingUnit = 'm.';
		let Visibility = Math.round(observations.visibility.value/1000);
		let VisibilityUnit = ' km.';
		let WindSpeed = Math.round(observations.windSpeed.value);
		const WindDirection = utils.calc.directionToNSEW(observations.windDirection.value);
		let Pressure = Math.round(observations.barometricPressure.value);
		let HeatIndex = Math.round(observations.heatIndex.value);
		let WindChill = Math.round(observations.windChill.value);
		let WindGust = Math.round(observations.windGust.value);
		let Humidity = Math.round(observations.relativeHumidity.value);
		// TODO: switch to larger icon
		const Icon = icons.getWeatherRegionalIconFromIconLink(observations.icon);
		let PressureDirection = '';
		const TextConditions = observations.textDescription;

		// difference since last measurement (pascals, looking for difference of more than 150)
		const pressureDiff = (observations.barometricPressure.value - this.data.features[1].properties.barometricPressure.value);
		if (pressureDiff > 150) PressureDirection = 'R';
		if (pressureDiff < -150) PressureDirection = 'F';

		if (navigation.units() === UNITS.english) {
			Temperature = utils.units.celsiusToFahrenheit(Temperature);
			DewPoint = utils.units.celsiusToFahrenheit(DewPoint);
			Ceiling = Math.round(utils.units.metersToFeet(Ceiling)/100)*100;
			CeilingUnit = 'ft.';
			Visibility = utils.units.kilometersToMiles(observations.visibility.value/1000);
			VisibilityUnit = ' mi.';
			WindSpeed = utils.units.kphToMph(WindSpeed);
			Pressure = utils.units.pascalToInHg(Pressure);
			HeatIndex = utils.units.celsiusToFahrenheit(HeatIndex);
			WindChill = utils.units.celsiusToFahrenheit(WindChill);
			WindGust = utils.units.kphToMph(WindGust);
		}

		this.context.drawImage(await this.backgroundImage, 0, 0);
		draw.horizontalGradientSingle(this.context, 0, 30, 500, 90, draw.topColor1, draw.topColor2);
		draw.triangle(this.context, 'rgb(28, 10, 87)', 500, 30, 450, 90, 500, 90);
		draw.horizontalGradientSingle(this.context, 0, 90, 52, 399, draw.sideColor1, draw.sideColor2);
		draw.horizontalGradientSingle(this.context, 584, 90, 640, 399, draw.sideColor1, draw.sideColor2);

		draw.titleText(this.context, 'Current', 'Conditions');

		draw.text(this.context, 'Star4000 Large', '24pt', '#FFFFFF', 170, 135, Temperature + String.fromCharCode(176), 2);

		let Conditions = observations.textDescription;
		if (TextConditions.length > 15) {
			Conditions = this.shortConditions(Conditions);
		}
		draw.text(this.context, 'Star4000 Extended', '24pt', '#FFFFFF', 195, 170, Conditions, 2, 'center');

		draw.text(this.context, 'Star4000 Extended', '24pt', '#FFFFFF', 80, 330, 'Wind:', 2);
		draw.text(this.context, 'Star4000 Extended', '24pt', '#FFFFFF', 300, 330, WindDirection + ' ' + WindSpeed, 2, 'right');

		if (WindGust) draw.text(this.context, 'Star4000 Extended', '24pt', '#FFFFFF', 80, 375, 'Gusts to ' + WindGust, 2);

		draw.text(this.context, 'Star4000 Large', 'bold 16pt', '#FFFF00', 315, 120, this.data.station.properties.name.substr(0, 20), 2);

		draw.text(this.context, 'Star4000 Large', 'bold 16pt', '#FFFFFF', 340, 165, 'Humidity:', 2);
		draw.text(this.context, 'Star4000 Large', 'bold 16pt', '#FFFFFF', 560, 165, Humidity + '%', 2, 'right');

		draw.text(this.context, 'Star4000 Large', 'bold 16pt', '#FFFFFF', 340, 205, 'Dewpoint:', 2);
		draw.text(this.context, 'Star4000 Large', 'bold 16pt', '#FFFFFF', 560, 205, DewPoint + String.fromCharCode(176), 2, 'right');

		draw.text(this.context, 'Star4000 Large', 'bold 16pt', '#FFFFFF', 340, 245, 'Ceiling:', 2);
		draw.text(this.context, 'Star4000 Large', 'bold 16pt', '#FFFFFF', 560, 245, (Ceiling === '' ? 'Unlimited' : Ceiling + CeilingUnit), 2, 'right');

		draw.text(this.context, 'Star4000 Large', 'bold 16pt', '#FFFFFF', 340, 285, 'Visibility:', 2);
		draw.text(this.context, 'Star4000 Large', 'bold 16pt', '#FFFFFF', 560, 285, Visibility + VisibilityUnit, 2, 'right');

		draw.text(this.context, 'Star4000 Large', 'bold 16pt', '#FFFFFF', 340, 325, 'Pressure:', 2);
		draw.text(this.context, 'Star4000 Large', 'bold 16pt', '#FFFFFF', 535, 325, Pressure, 2, 'right');

		switch (PressureDirection) {
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

		if (observations.heatIndex.value && HeatIndex !== Temperature) {
			draw.text(this.context, 'Star4000 Large', 'bold 16pt', '#FFFFFF', 340, 365, 'Heat Index:', 2);
			draw.text(this.context, 'Star4000 Large', 'bold 16pt', '#FFFFFF', 560, 365, HeatIndex + String.fromCharCode(176), 2, 'right');
		} else if (observations.windChill.value && WindChill !== '' && WindChill < Temperature) {
			draw.text(this.context, 'Star4000 Large', 'bold 16pt', '#FFFFFF', 340, 365, 'Wind Chill:', 2);
			draw.text(this.context, 'Star4000 Large', 'bold 16pt', '#FFFFFF', 560, 365, WindChill + String.fromCharCode(176), 2, 'right');
		}

		// get main icon
		this.gifs.push(await utils.image.superGifAsync({
			src: Icon,
			loop_delay: 100,
			auto_play: true,
			canvas: this.canvas,
			x: 140,
			y: 175,
			max_width: 126,
		}));

		this.finishDraw();
		this.setStatus(STATUS.loaded);
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
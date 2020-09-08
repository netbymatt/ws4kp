// display extended forecast graphically
// technically uses the same data as the local forecast, we'll let the browser do the caching of that

/* globals WeatherDisplay, utils, STATUS, UNITS, draw, icons, navigation, luxon */

// eslint-disable-next-line no-unused-vars
class ExtendedForecast extends WeatherDisplay {
	constructor(navId,elemId,weatherParameters) {
		super(navId,elemId,'Extended Forecast');

		// set timings
		this.timing.totalScreens = 2;

		// pre-load background image (returns promise)
		this.backgroundImage = utils.image.load('images/BackGround2_1.png');

		// get the data
		this.getData(weatherParameters);

	}

	async getData(weatherParameters) {
		super.getData();

		// request us or si units
		let units = 'us';
		if (navigation.units() === UNITS.metric) units = 'si';
		let forecast;
		try {
			forecast = await $.ajax({
				type: 'GET',
				url: weatherParameters.forecast,
				data: {
					units,
				},
				dataType: 'json',
				crossDomain: true,
			});
		} catch (e) {
			console.error('Unable to get extended forecast');
			console.error(e);
			this.setStatus(STATUS.error);
			return;
		}
		// we only get here if there was no error above
		this.data = this.parseExtendedForecast(forecast.properties.periods);
		this.screnIndex = 0;
		this.drawCanvas();

	}

	// the api provides the forecast in 12 hour increments, flatten to day increments with high and low temperatures
	parseExtendedForecast(fullForecast) {
	// create a list of days starting with today
		const _Days = [0, 1, 2, 3, 4, 5, 6];

		const dates = _Days.map(shift => {
			const date = luxon.DateTime.local().startOf('day').plus({days:shift});
			return date.toLocaleString({weekday: 'short'});
		});

		// track the destination forecast index
		let destIndex = 0;
		const forecast = [];
		fullForecast.forEach(period => {
		// create the destination object if necessary
			if (!forecast[destIndex]) forecast.push({dayName:'', low: undefined, high: undefined, text: undefined, icon: undefined});
			// get the object to modify/populate
			const fDay = forecast[destIndex];
			// high temperature will always be last in the source array so it will overwrite the low values assigned below
			// TODO: change to commented line when incons are matched up
			// fDay.icon = icons.GetWeatherIconFromIconLink(period.icon);
			fDay.icon = icons.getWeatherRegionalIconFromIconLink(period.icon);
			fDay.text = this.shortenExtendedForecastText(period.shortForecast);
			fDay.dayName = dates[destIndex];

			if (period.isDaytime) {
			// day time is the high temperature
				fDay.high = period.temperature;
				destIndex++;
			} else {
			// low temperature
				fDay.low = period.temperature;
			}
		});

		return forecast;
	}

	shortenExtendedForecastText(long) {
		let short = long;
		short = short.replace(/ and /g, ' ');
		short = short.replace(/Slight /g, '');
		short = short.replace(/Chance /g, '');
		short = short.replace(/Very /g, '');
		short = short.replace(/Patchy /g, '');
		short = short.replace(/Areas /g, '');
		short = short.replace(/Dense /g, '');

		let conditions = short.split(' ');
		if (short.indexOf('then') !== -1) {
			conditions = short.split(' then ');
			conditions = conditions[1].split(' ');
		}

		let short1 = conditions[0].substr(0, 10);
		let short2 = '';
		if (conditions[1]) {
			if (!short1.endsWith('.')) {
				short2 = conditions[1].substr(0, 10);
			} else {
				short1 = short1.replace(/\./, '');
			}

			if (short2 === 'Blowing') {
				short2 = '';
			}
		}
		short = short1;
		if (short2 !== '') {
			short += ' ' + short2;
		}

		return [short, short1, short2];
	}

	async drawCanvas() {
		super.drawCanvas();

		// determine bounds
		// grab the first three or second set of three array elements
		const forecast = this.data.slice(0+3*this.screenIndex, 3+this.screenIndex*3);

		const backgroundImage = await this.backgroundImage;

		this.context.drawImage(backgroundImage, 0, 0);
		draw.horizontalGradientSingle(this.context, 0, 30, 500, 90, draw.topColor1, draw.topColor2);
		draw.triangle(this.context, 'rgb(28, 10, 87)', 500, 30, 450, 90, 500, 90);
		draw.horizontalGradientSingle(this.context, 0, 90, 640, 399, draw.sideColor1, draw.sideColor2);
		this.context.drawImage(backgroundImage, 38, 100, 174, 297, 38, 100, 174, 297);
		this.context.drawImage(backgroundImage, 232, 100, 174, 297, 232, 100, 174, 297);
		this.context.drawImage(backgroundImage, 426, 100, 174, 297, 426, 100, 174, 297);

		draw.titleText(this.context, 'Extended', 'Forecast');

		await Promise.all(forecast.map(async (Day, Index) => {
			const offset = Index*195;
			draw.text(this.context, 'Star4000', '24pt', '#FFFF00', 100+offset, 135, Day.dayName.toUpperCase(), 2);
			draw.text(this.context, 'Star4000', '24pt', '#8080FF', 85+offset, 345, 'Lo', 2, 'center');
			draw.text(this.context, 'Star4000', '24pt', '#FFFF00', 165+offset, 345, 'Hi', 2, 'center');
			let  low = Day.low;
			if (low !== undefined) {
				if (navigation.units() === UNITS.metric) low = utils.units.rahrenheitToCelsius(low);
				draw.text(this.context, 'Star4000 Large', '24pt', '#FFFFFF', 85+offset, 385, low, 2, 'center');
			}
			let high = Day.high;
			if (navigation.units() === UNITS.metric) high = utils.units.rahrenheitToCelsius(high);
			draw.text(this.context, 'Star4000 Large', '24pt', '#FFFFFF', 165+offset, 385, high, 2, 'center');
			draw.text(this.context, 'Star4000', '24pt', '#FFFFFF', 120+offset, 270, Day.text[1], 2, 'center');
			draw.text(this.context, 'Star4000', '24pt', '#FFFFFF', 120+offset, 310, Day.text[2], 2, 'center');

			// draw the icon
			this.gifs.push(await utils.image.superGifAsync({
				src: Day.icon,
				loop_delay: 100,
				auto_play: true,
				canvas: this.canvas,
				x: 70 + Index*195,
				y: 150,
				max_height: 75,
			}));
		}));

		this.finishDraw();
		this.setStatus(STATUS.loaded);
	}
}
// regional forecast and observations
// type 0 = observations, 1 = first forecast, 2 = second forecast
// makes use of global data retrevial through RegionalForecastData

/* globals WeatherDisplay, utils, STATUS, icons, UNITS, draw, navigation, luxon, RegionalForecastData */

// eslint-disable-next-line no-unused-vars
class RegionalForecast extends WeatherDisplay {
	constructor(navId,elemId, weatherParameters, period) {
		super(navId,elemId,'Regional Forecast');
		// store the period, see above
		this.period = period;

		// pre-load background image (returns promise)
		this.backgroundImage = utils.image.load('images/BackGround5_1.png');

		// get the data and update the promise
		this.getData(weatherParameters);
	}

	// get the data from the globally shared object
	async getData(weatherParameters) {
		super.getData();
		// pre-load the base map (returns promise)
		let src = 'images/Basemap2.png';
		if (weatherParameters.State === 'HI') {
			src = 'images/HawaiiRadarMap4.png';
		} else if (weatherParameters.State === 'AK') {
			src = 'images/AlaskaRadarMap6.png';
		}
		this.baseMap = utils.image.load(src);

		this.data = await RegionalForecastData.updateData(weatherParameters);
		this.drawCanvas();
	}

	async drawCanvas() {
		super.drawCanvas();
		// break up data into useful values
		const {regionalData: data, sourceXY, offsetXY} = this.data;

		// fixed offset for all y values when drawing to the map
		const mapYOff = 90;

		const {DateTime} = luxon;
		// draw the header graphics
		this.context.drawImage(await this.backgroundImage, 0, 0);
		draw.horizontalGradientSingle(this.context, 0, 30, 500, 90, draw.topColor1, draw.topColor2);
		draw.triangle(this.context, 'rgb(28, 10, 87)', 500, 30, 450, 90, 500, 90);

		// draw the appropriate title
		if (this.period === 0) {
			draw.titleText(this.context, 'Regional', 'Observations');
		} else {
			let forecastDate = DateTime.local();
			// four conditions to evaluate based on whether the first forecast is for daytime and the requested period
			const firstIsDay = data[0][1].daytime;
			if (firstIsDay && this.period === 1) forecastDate = forecastDate.plus({days: 1});
			if (firstIsDay && this.period === 2); // no change, shown for consistency
			if (!firstIsDay && this.period === 1); // no change, shown for consistency
			if (!firstIsDay && this.period === 2) forecastDate = forecastDate.plus({days: 1});

			// get the name of the day
			const dayName = forecastDate.toLocaleString({weekday: 'long'});
			// draw the title
			if (data[0][this.period].daytime) {
				draw.titleText(this.context, 'Forecast for', dayName);
			} else {
				draw.titleText(this.context, 'Forecast for', dayName + ' Night');
			}
		}

		// draw the map
		this.context.drawImage(await this.baseMap, sourceXY.x, sourceXY.y, (offsetXY.x * 2), (offsetXY.y * 2), 0, mapYOff, 640, 312);
		await Promise.all(data.map(async city => {
			const period = city[this.period];
			// draw the icon if possible
			const icon = icons.getWeatherRegionalIconFromIconLink(period.icon, !period.daytime);
			if (icon) {
				this.gifs.push(await utils.image.superGifAsync({
					src: icon,
					max_width: 42,
					loop_delay: 100,
					auto_play: true,
					canvas: this.canvas,
					x: period.x,
					y: period.y - 15+mapYOff,
				}));
			}

			// City Name
			draw.text(this.context, 'Star4000', '20px', '#ffffff', period.x - 40, period.y - 15+mapYOff, period.name, 2);

			// Temperature
			let temperature = period.temperature;
			if (navigation.units() === UNITS.metric) temperature = Math.round(utils.units.fahrenheitToCelsius(temperature));
			draw.text(this.context, 'Star4000 Large Compressed', '28px', '#ffff00', period.x - (temperature.toString().length * 15), period.y + 20+mapYOff, temperature, 2);
		}));

		this.finishDraw();
		this.setStatus(STATUS.loaded);

	}
}
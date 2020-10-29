// hourly forecast list
/* globals WeatherDisplay, utils, STATUS, UNITS, draw, navigation, icons, luxon */

// eslint-disable-next-line no-unused-vars
class Hourly extends WeatherDisplay {
	constructor(navId, elemId, defaultActive) {
		// special height and width for scrolling
		super(navId, elemId, 'Hourly Forecast', defaultActive);
		// pre-load background image (returns promise)
		this.backgroundImage = utils.image.load('images/BackGround6_1.png');

		// height of one hour in the forecast
		this.hourHeight = 72;

		// set up the timing
		this.timing.baseDelay = 20;
		// 24 hours = 6 pages
		const pages = 4; // first page is already displayed, last page doesn't happen
		const timingStep = this.hourHeight * 4;
		this.timing.delay = [150 + timingStep];
		// add additional pages
		for (let i = 0; i < pages; i += 1) this.timing.delay.push(timingStep);
		// add the final 3 second delay
		this.timing.delay.push(150);
	}

	async getData(weatherParameters) {
		// super checks for enabled
		if (!super.getData(weatherParameters)) return;
		let forecast;
		try {
			// get the forecast
			forecast = await utils.fetch.json(weatherParameters.forecastGridData);
		} catch (e) {
			console.error('Get hourly forecast failed');
			console.error(e.status, e.responseJSON);
			this.setStatus(STATUS.failed);
		}

		this.data = await Hourly.parseForecast(forecast.properties);

		this.setStatus(STATUS.loaded);
		this.drawLongCanvas();
	}

	// extract specific values from forecast and format as an array
	static async parseForecast(data) {
		const temperature = Hourly.expand(data.temperature.values);
		const apparentTemperature = Hourly.expand(data.apparentTemperature.values);
		const windSpeed = Hourly.expand(data.windSpeed.values);
		const windDirection = Hourly.expand(data.windDirection.values);
		const skyCover = Hourly.expand(data.skyCover.values);	// cloud icon
		const weather = Hourly.expand(data.weather.values);	// fog icon
		const iceAccumulation = Hourly.expand(data.iceAccumulation.values); 	// ice icon
		const probabilityOfPrecipitation = Hourly.expand(data.probabilityOfPrecipitation.values);	// rain icon
		const snowfallAmount = Hourly.expand(data.snowfallAmount.values);	// snow icon

		const icons = await Hourly.determineIcon(skyCover, weather, iceAccumulation, probabilityOfPrecipitation, snowfallAmount, windSpeed);

		return temperature.map((val, idx) => {
			if (navigation.units === UNITS.metric) {
				return {
					temperature: temperature[idx],
					apparentTemperature: apparentTemperature[idx],
					windSpeed: windSpeed[idx],
					windDirection: utils.calc.directionToNSEW(windDirection[idx]),
					icon: icons[idx],
				};
			}

			return {
				temperature: utils.units.celsiusToFahrenheit(temperature[idx]),
				apparentTemperature: utils.units.celsiusToFahrenheit(apparentTemperature[idx]),
				windSpeed: utils.units.kilometersToMiles(windSpeed[idx]),
				windDirection: utils.calc.directionToNSEW(windDirection[idx]),
				icon: icons[idx],
			};
		});
	}

	// given forecast paramaters determine a suitable icon
	static async determineIcon(skyCover, weather, iceAccumulation, probabilityOfPrecipitation, snowfallAmount, windSpeed) {
		const startOfHour = luxon.DateTime.local().startOf('hour');
		const sunTimes = (await navigation.getSun()).sun;
		const overnight = luxon.Interval.fromDateTimes(luxon.DateTime.fromJSDate(sunTimes[0].sunset), luxon.DateTime.fromJSDate(sunTimes[1].sunrise));
		const tomorrowOvernight = luxon.DateTime.fromJSDate(sunTimes[1].sunset);
		return skyCover.map((val, idx) => {
			const hour = startOfHour.plus({ hours: idx });
			const isNight = overnight.contains(hour) || (hour > tomorrowOvernight);
			return icons.getHourlyIcon(skyCover[idx], weather[idx], iceAccumulation[idx], probabilityOfPrecipitation[idx], snowfallAmount[idx], windSpeed[idx], isNight);
		});
	}

	// expand a set of values with durations to an hour-by-hour array
	static expand(data) {
		const startOfHour = luxon.DateTime.utc().startOf('hour').toMillis();
		const result = []; // resulting expanded values
		data.forEach((item) => {
			let startTime = Date.parse(item.validTime.substr(0, item.validTime.indexOf('/')));
			const duration = luxon.Duration.fromISO(item.validTime.substr(item.validTime.indexOf('/') + 1)).shiftTo('milliseconds').values.milliseconds;
			const endTime = startTime + duration;
			// loop through duration at one hour intervals
			do {
				// test for timestamp greater than now
				if (startTime >= startOfHour && result.length < 24) {
					result.push(item.value); // push data array
				} // timestamp is after now
				// increment start time by 1 hour
				startTime += 3600000;
			} while (startTime < endTime && result.length < 24);
		}); // for each value

		return result;
	}

	async drawLongCanvas() {
		// create the "long" canvas if necessary
		if (!this.longCanvas) {
			this.longCanvas = document.createElement('canvas');
			this.longCanvas.width = 640;
			this.longCanvas.height = 24 * this.hourHeight;
			this.longContext = this.longCanvas.getContext('2d');
			this.longCanvasGifs = [];
		}

		// stop all gifs
		this.longCanvasGifs.forEach((gif) => gif.pause());
		// delete the gifs
		this.longCanvasGifs.length = 0;

		// clean up existing gifs
		this.gifs.forEach((gif) => gif.pause());
		// delete the gifs
		this.gifs.length = 0;

		this.longContext.clearRect(0, 0, this.longCanvas.width, this.longCanvas.height);

		// draw the "long" canvas with all cities
		draw.box(this.longContext, 'rgb(35, 50, 112)', 0, 0, 640, 24 * this.hourHeight);

		for (let i = 0; i <= 4; i += 1) {
			const y = i * 346;
			draw.horizontalGradient(this.longContext, 0, y, 640, y + 346, '#102080', '#001040');
		}

		const startingHour = luxon.DateTime.local();

		await Promise.all(this.data.map(async (data, index) => {
			// calculate base y value
			const y = 50 + this.hourHeight * index;

			// hour
			const hour = startingHour.plus({ hours: index });
			const formattedHour = hour.toLocaleString({ weekday: 'short', hour: 'numeric' });
			draw.text(this.longContext, 'Star4000 Large Compressed', '24pt', '#FFFF00', 80, y, formattedHour, 2);

			// temperatures, convert to strings with no decimal
			const temperature = Math.round(data.temperature).toString().padStart(3);
			const feelsLike = Math.round(data.apparentTemperature).toString().padStart(3);
			draw.text(this.longContext, 'Star4000 Large', '24pt', '#FFFF00', 390, y, temperature, 2, 'center');
			// only plot apparent temperature if there is a difference
			if (temperature !== feelsLike) draw.text(this.longContext, 'Star4000 Large', '24pt', '#FFFF00', 470, y, feelsLike, 2, 'center');

			// wind
			let wind = 'Calm';
			if (data.windSpeed > 0) {
				const windSpeed = Math.round(data.windSpeed).toString();
				wind = data.windDirection + (Array(6 - data.windDirection.length - windSpeed.length).join(' ')) + windSpeed;
			}
			draw.text(this.longContext, 'Star4000 Large', '24pt', '#FFFF00', 580, y, wind, 2, 'center');

			this.longCanvasGifs.push(await utils.image.superGifAsync({
				src: data.icon,
				auto_play: true,
				canvas: this.longCanvas,
				x: 290,
				y: y - 35,
				max_width: 47,
			}));
		}));
	}

	async drawCanvas() {
		// there are technically 2 canvases: the standard canvas and the extra-long canvas that contains the complete
		// list of cities. The second canvas is copied into the standard canvas to create the scroll
		super.drawCanvas();

		// draw the standard context
		this.context.drawImage(await this.backgroundImage, 0, 0);
		draw.horizontalGradientSingle(this.context, 0, 30, 500, 90, draw.topColor1, draw.topColor2);
		draw.triangle(this.context, 'rgb(28, 10, 87)', 500, 30, 450, 90, 500, 90);

		draw.titleText(this.context, 'Hourly Forecast');

		draw.text(this.context, 'Star4000 Small', '24pt', '#FFFF00', 390, 105, 'TEMP', 2, 'center');
		draw.text(this.context, 'Star4000 Small', '24pt', '#FFFF00', 470, 105, 'LIKE', 2, 'center');
		draw.text(this.context, 'Star4000 Small', '24pt', '#FFFF00', 580, 105, 'WIND', 2, 'center');

		// copy the scrolled portion of the canvas for the initial run before the scrolling starts
		this.context.drawImage(this.longCanvas, 0, 0, 640, 289, 0, 110, 640, 289);

		this.finishDraw();
	}

	async showCanvas() {
		// special to travel forecast to draw the remainder of the canvas
		await this.drawCanvas();
		super.showCanvas();
	}

	// screen index change callback just runs the base count callback
	screenIndexChange() {
		this.baseCountChange(this.navBaseCount);
	}

	// base count change callback
	baseCountChange(count) {
		// get a fresh canvas
		const longCanvas = this.getLongCanvas();

		// calculate scroll offset and don't go past end
		let offsetY = Math.min(longCanvas.height - 289, (count - 150));

		// don't let offset go negative
		if (offsetY < 0) offsetY = 0;

		// copy the scrolled portion of the canvas
		this.context.drawImage(longCanvas, 0, offsetY, 640, 289, 0, 110, 640, 289);
	}

	static getTravelCitiesDayName(cities) {
		const { DateTime } = luxon;
		// effectively returns early on the first found date
		return cities.reduce((dayName, city) => {
			if (city && dayName === '') {
				// today or tomorrow
				const day = DateTime.local().plus({ days: (city.today) ? 0 : 1 });
				// return the day
				return day.toLocaleString({ weekday: 'long' });
			}
			return dayName;
		}, '');
	}

	// necessary to get the lastest long canvas when scrolling
	getLongCanvas() {
		return this.longCanvas;
	}
}

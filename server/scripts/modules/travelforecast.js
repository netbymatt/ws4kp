// travel forecast display
/* globals WeatherDisplay, utils, STATUS, UNITS, draw, navigation, icons, luxon, _TravelCities */

// eslint-disable-next-line no-unused-vars
class TravelForecast extends WeatherDisplay {
	constructor(navId, elemId, weatherParameters) {
		// special height and width for scrolling
		super(navId, elemId);
		// pre-load background image (returns promise)
		this.backgroundImage = utils.image.load('images/BackGround6_1.png');

		// get the data
		this.getData(weatherParameters);

		// scrolling tracking
		this.scrollCount = 0;
		this.endDelay = 0;
	}

	async getData() {
		const forecastPromises = _TravelCities.map(async city => {
			try {
				// get point then forecast
				const point = await utils.weather.getPoint(city.Latitude, city.Longitude);
				const forecast = await $.ajax({
					url: point.properties.forecast,
					dataType: 'json',
					crossDomain: true,
				});
				// determine today or tomorrow (shift periods by 1 if tomorrow)
				const todayShift = forecast.properties.periods[0].isDaytime? 0:1;
				// return a pared-down forecast
				return {
					today: todayShift === 0,
					high: forecast.properties.periods[todayShift].temperature,
					low: forecast.properties.periods[todayShift+1].temperature,
					name: city.Name,
					icon: icons.getWeatherRegionalIconFromIconLink(forecast.properties.periods[todayShift].icon),
				};
			} catch (e) {
				console.error(`GetTravelWeather for ${city.Name} failed`);
				console.error(e);
				return {name: city.Name};
			}
		});

		// wait for all forecasts
		const forecasts = await Promise.all(forecastPromises);
		this.data = forecasts;
		this.drawCanvas(true);
	}

	async drawCanvas(newData) {
		// there are technically 2 canvases: the standard canvas and the extra-long canvas that contains the complete
		// list of cities. The second canvas is copied into the standard canvas to create the scroll
		super.drawCanvas();

		// create the "long" canvas if necessary
		if (!this.longCanvas) {
			this.longCanvas = document.createElement('canvas');
			this.longCanvas.width = 640;
			this.longCanvas.height = 1728;
			this.longContext = this.longCanvas.getContext('2d');
		}
		// set up variables
		const cities = this.data;

		// draw the long canvas only if there is new data
		if (newData) {
			this.longContext.clearRect(0,0,this.longCanvas.width,this.longCanvas.height);

			// draw the "long" canvas with all cities
			draw.box(this.longContext, 'rgb(35, 50, 112)', 0, 0, 640, 1728);

			for (let i = 0; i <= 4; i++) {
				const y = i * 346;
				draw.horizontalGradient(this.longContext, 0, y, 640, y + 346, '#102080', '#001040');
			}

			await Promise.all(cities.map(async (city, index) => {
			// calculate base y value
				const y = 50+72*index;

				// city name
				draw.text(this.longContext, 'Star4000 Large Compressed', '24pt', '#FFFF00', 80, y, city.name, 2);

				// check for forecast data
				if (city.icon) {
				// get temperatures and convert if necessary
					let {low, high} = city;

					if (navigation.units() === UNITS.metric) {
						low = utils.units.fahrenheitToCelsius(low);
						high = utils.units.fahrenheitToCelsius(high);
					}

					// convert to strings with no decimal
					const lowString = Math.round(low).toString();
					const highString = Math.round(high).toString();

					const xLow = (500 - (lowString.length * 20));
					draw.text(this.longContext, 'Star4000 Large', '24pt', '#FFFF00', xLow, y, lowString, 2);

					const xHigh = (560 - (highString.length * 20));
					draw.text(this.longContext, 'Star4000 Large', '24pt', '#FFFF00', xHigh, y, highString, 2);

					this.gifs.push(await utils.image.superGifAsync({
						src: city.icon,
						loop_delay: 100,
						auto_play: true,
						canvas: this.longCanvas,
						x: 330,
						y: y - 35,
						max_width: 47,
					}));
				} else {
					draw.text(this.longContext, 'Star4000 Small', '24pt', '#FFFFFF', 400, y - 18, 'NO TRAVEL', 2);
					draw.text(this.longContext, 'Star4000 Small', '24pt', '#FFFFFF', 400, y, 'DATA AVAILABLE', 2);
				}

			}));
		}

		// draw the standard context
		this.context.drawImage(await this.backgroundImage, 0, 0);
		draw.horizontalGradientSingle(this.context, 0, 30, 500, 90, draw.topColor1, draw.topColor2);
		draw.triangle(this.context, 'rgb(28, 10, 87)', 500, 30, 450, 90, 500, 90);

		draw.titleText(this.context, 'Travel Forecast', 'For ' + this.getTravelCitiesDayName(cities));

		draw.text(this.context, 'Star4000 Small', '24pt', '#FFFF00', 455, 105, 'LOW', 2);
		draw.text(this.context, 'Star4000 Small', '24pt', '#FFFF00', 510, 105, 'HIGH', 2);

		// copy the scrolled portion of the canvas for the initial run before the scrolling starts
		this.context.drawImage(this.longCanvas, 0, 0, 640, 289, 0, 110, 640, 289);

		// set up scrolling one time
		if (!this.scrollInterval) {
			this.scrollInterval = window.setInterval(() => {
				if (this.isActive()) {
					// get a fresh canvas
					const longCanvas = this.getLongCanvas();
					// increment scrolling
					this.scrollCount++;
					// wait 3 seconds at begining
					if (this.scrollCount < 150) return;
					// calculate scroll offset and don't go past end of canvas
					const offsetY = Math.min(longCanvas.height-289, (this.scrollCount-150));
					// copy the scrolled portion of the canvas
					this.context.drawImage(longCanvas, 0, offsetY, 640, 289, 0, 110, 640, 289);
					// track end of scrolling for 3 seconds
					if (offsetY >= longCanvas.height-289) this.endDelay++;
					// TODO: report playback done
				} else {
					// reset scroll to top of image
					this.scrollCount = 0;
					this.endDelay = 0;
				}
			}, 20);
		}
		this.finishDraw();
		this.setStatus(STATUS.loaded);
	}

	getTravelCitiesDayName(cities) {
		const {DateTime} = luxon;
		// effectively returns early on the first found date
		return cities.reduce((dayName, city) => {
			if (city && dayName === '') {
				// today or tomorrow
				const day = DateTime.local().plus({days: (city.today)?0:1});
				// return the day
				return day.toLocaleString({weekday: 'long'});
			}
			return dayName;
		}, '');
	}

	// necessary to get the lastest long canvas when scrolling
	getLongCanvas() {
		return this.longCanvas;
	}
}
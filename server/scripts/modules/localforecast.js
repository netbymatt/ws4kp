// display text based local forecast

/* globals WeatherDisplay, utils, STATUS, UNITS, draw, navigation*/

// eslint-disable-next-line no-unused-vars
class LocalForecast extends WeatherDisplay {
	constructor(navId,elemId) {
		super(navId,elemId, 'Local Forecast');

		// set timings
		this.timing.baseDelay= 5000;

		// pre-load background image (returns promise)
		this.backgroundImage = utils.image.load('images/BackGround1_1.png');
	}

	async getData(weatherParameters) {
		super.getData(weatherParameters);
		if (!weatherParameters) weatherParameters = this.weatherParameters;


		// get raw data
		const rawData = await this.getRawData(weatherParameters);
		// check for data
		if (!rawData) {
			this.setStatus(STATUS.failed);
			return;
		}
		// parse raw data
		const conditions = this.parseLocalForecast(rawData);

		// split this forecast into the correct number of screens
		const maxRows = 7;
		const maxCols = 32;

		this.screenTexts = [];

		// read each text
		conditions.forEach(condition => {
			// process the text
			let text = condition.DayName.toUpperCase() + '...';
			let conditionText = condition.Text;
			if (navigation.units() === UNITS.metric) {
				conditionText = condition.TextC;
			}
			text += conditionText.toUpperCase().replace('...', ' ');

			text = utils.string.wordWrap(text, maxCols, '\n');
			const lines = text.split('\n');
			const lineCount = lines.length;
			let ScreenText = '';
			const maxRowCount = maxRows;
			let rowCount = 0;


			// if (PrependAlert) {
			// 	ScreenText = LocalForecastScreenTexts[LocalForecastScreenTexts.length - 1];
			// 	rowCount = ScreenText.split('\n').length - 1;
			// }

			for (let i = 0; i <= lineCount - 1; i++) {
				if (lines[i] === '') continue;

				if (rowCount > maxRowCount - 1) {
					// if (PrependAlert) {
					// 	LocalForecastScreenTexts[LocalForecastScreenTexts.length - 1] = ScreenText;
					// 	PrependAlert = false;
					// } else {
					this.screenTexts.push(ScreenText);
					// }
					ScreenText = '';
					rowCount = 0;
				}

				ScreenText += lines[i] + '\n';
				rowCount++;
			}
			// if (PrependAlert) {
			// 	this.screenTexts[this.screenTexts.length - 1] = ScreenText;
			// 	PrependAlert = false;
			// } else {
			this.screenTexts.push(ScreenText);
			// }
		});

		this.timing.totalScreens = this.screenTexts.length;
		this.calcNavTiming();
		this.setStatus(STATUS.loaded);
	}

	// get the unformatted data (also used by extended forecast)
	async getRawData(weatherParameters) {
		// request us or si units
		let units = 'us';
		if (navigation.units() === UNITS.metric) units = 'si';
		try {
			return await utils.fetch.json(weatherParameters.forecast, {
				data: {
					units,
				},
			});

		} catch (e) {
			console.error(`GetWeatherForecast failed: ${weatherParameters.forecast}`);
			console.error(e.status, e.responseJSON);
			this.setStatus(STATUS.failed);
			return false;
		}
	}

	// TODO: alerts needs a cleanup
	// TODO: second page of screenTexts when needed
	async drawCanvas() {
		super.drawCanvas();

		this.context.drawImage(await this.backgroundImage, 0, 0);
		draw.horizontalGradientSingle(this.context, 0, 30, 500, 90, draw.topColor1, draw.topColor2);
		draw.triangle(this.context, 'rgb(28, 10, 87)', 500, 30, 450, 90, 500, 90);
		draw.horizontalGradientSingle(this.context, 0, 90, 52, 399, draw.sideColor1, draw.sideColor2);
		draw.horizontalGradientSingle(this.context, 584, 90, 640, 399, draw.sideColor1, draw.sideColor2);

		draw.titleText(this.context, 'Local ', 'Forecast');

		// clear existing text
		draw.box(this.context, 'rgb(33, 40, 90)', 65, 105, 505, 280);
		// Draw the text.
		this.screenTexts[this.screenIndex].split('\n').forEach((text, index) => {
			draw.text(this.context, 'Star4000', '24pt', '#FFFFFF', 75, 140+40*index, text, 2);
		});
		this.finishDraw();
	}

	// format the forecast
	parseLocalForecast (forecast) {
		// only use the first 6 lines
		return forecast.properties.periods.slice(0,6).map(text => ({
			// format day and text
			DayName: text.name.toUpperCase(),
			Text: text.detailedForecast,
		}));
	}
}
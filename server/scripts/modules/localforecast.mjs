// display text based local forecast

import STATUS from './status.mjs';
import { UNITS, getUnits } from './utils/units.mjs';
import { json } from './utils/fetch.mjs';
import WeatherDisplay from './weatherdisplay.mjs';
import { registerDisplay } from './navigation.mjs';

class LocalForecast extends WeatherDisplay {
	constructor(navId, elemId) {
		super(navId, elemId, 'Local Forecast', true);

		// set timings
		this.timing.baseDelay = 5000;
	}

	async getData(_weatherParameters) {
		super.getData(_weatherParameters);
		const weatherParameters = _weatherParameters ?? this.weatherParameters;

		// get raw data
		const rawData = await this.getRawData(weatherParameters);
		// check for data
		if (!rawData) {
			this.setStatus(STATUS.failed);
			return;
		}
		// parse raw data
		const conditions = LocalForecast.parse(rawData);

		// read each text
		this.screenTexts = conditions.map((condition) => {
			// process the text
			let text = `${condition.DayName.toUpperCase()}...`;
			let conditionText = condition.Text;
			if (getUnits() === UNITS.metric) {
				conditionText = condition.TextC;
			}
			text += conditionText.toUpperCase().replace('...', ' ');

			return text;
		});

		// fill the forecast texts
		const templates = this.screenTexts.map((text) => this.fillTemplate('forecast', { text }));
		const forecastsElem = this.elem.querySelector('.forecasts');
		forecastsElem.innerHTML = '';
		forecastsElem.append(...templates);

		// increase each forecast height to a multiple of container height
		this.pageHeight = forecastsElem.parentNode.getBoundingClientRect().height;
		templates.forEach((forecast) => {
			const newHeight = Math.ceil(forecast.scrollHeight / this.pageHeight) * this.pageHeight;
			forecast.style.height = `${newHeight}px`;
		});

		this.timing.totalScreens = forecastsElem.scrollHeight / this.pageHeight;
		this.calcNavTiming();
		this.setStatus(STATUS.loaded);
	}

	// get the unformatted data (also used by extended forecast)
	async getRawData(weatherParameters) {
		// request us or si units
		let units = 'us';
		if (getUnits() === UNITS.metric) units = 'si';
		try {
			return await json(weatherParameters.forecast, {
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

	async drawCanvas() {
		super.drawCanvas();

		const top = -this.screenIndex * this.pageHeight;
		this.elem.querySelector('.forecasts').style.top = `${top}px`;

		this.finishDraw();
	}

	// format the forecast
	static parse(forecast) {
		// only use the first 6 lines
		return forecast.properties.periods.slice(0, 6).map((text) => ({
			// format day and text
			DayName: text.name.toUpperCase(),
			Text: text.detailedForecast,
		}));
	}
}

// register display
registerDisplay(new LocalForecast(5, 'local-forecast'));

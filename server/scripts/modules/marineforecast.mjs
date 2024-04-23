// display extended forecast graphically
// technically uses the same data as the local forecast, we'll let the browser do the caching of that

import STATUS from './status.mjs';
import WeatherDisplay from './weatherdisplay.mjs';
import { registerDisplay } from './navigation.mjs';
import getHourlyForecast from './hourly.mjs';

class MarineForecast extends WeatherDisplay {
	constructor(navId, elemId) {
		super(navId, elemId, 'Marine Forecast', false);
		// this.showOnProgress = false;

		// set timings
		this.timing.totalScreens = 1;
	}

	async getData() {
		if (!super.getData()) return;

		const hourlyForecast = await getHourlyForecast(() => this.stillWaiting());
		if (hourlyForecast === undefined) {
			this.setStatus(STATUS.failed);
			return;
		}

		// test for all wave heights = 0, no data for wave heights
		if (hourlyForecast.every((value) => !value.waveHeight)) {
			// total screens = 0 to skip this display
			this.totalScreens = 0;
			this.setStatus(STATUS.noData);
			return;
		}

		this.data =	hourlyForecast;
		this.screenIndex = 0;
		this.setStatus(STATUS.loaded);
	}

	async drawCanvas() {
		super.drawCanvas();

		// determine bounds
		// grab the first three or second set of three array elements
		const forecast = this.data.slice(0, 2);

		// create each day template
		const days = forecast.map((Day) => {
			const fill = {};
			const waveHeight = Math.round(Day.waveHeight * 3.281);
			fill.date = Day.dayName;
			fill['wind-dir'] = Day.windDirection;
			fill['wind-speed'] = '10 - 15kts';
			fill['wave-height'] = `${waveHeight}'`;
			fill['wave-desc'] = waveDesc(waveHeight);

			const { low } = Day;
			if (low !== undefined) {
				fill['value-lo'] = Math.round(low);
			}
			const { high } = Day;
			fill['value-hi'] = Math.round(high);
			fill.condition = Day.text;

			// draw the icon
			fill['wave-icon'] = { type: 'img', src: waveImage('') };

			// return the filled template
			return this.fillTemplate('day', fill);
		});

		// empty and update the container
		const dayContainer = this.elem.querySelector('.day-container');
		dayContainer.innerHTML = '';
		dayContainer.append(...days);
		this.finishDraw();
	}
}

const waveImage = (conditions) => {
	const color = 'rgb(172, 165, 251)';
	const canvas = document.createElement('canvas');
	canvas.width = 150;
	canvas.height = 20;
	const context = canvas.getContext('2d');
	context.imageSmoothingEnabled = false;

	let y = 0;
	let r = 35;
	let arc1 = Math.PI * 0.3;
	let arc2 = Math.PI * 0.7;

	switch (conditions) {
	case 'CHOPPY':
		y = -10;
		arc1 = Math.PI * 0.2;
		arc2 = Math.PI * 0.8;
		r = 25;
		break;

	case 'ROUGH':
		y = -5;
		arc1 = Math.PI * 0.1;
		arc2 = Math.PI * 0.9;
		r = 20;
		break;

	case 'LIGHT':
	default:
		y = -20;
		arc1 = Math.PI * 0.3;
		arc2 = Math.PI * 0.7;
		r = 35;
		break;
	}

	context.beginPath();
	context.arc(35, y, r, arc1, arc2);
	context.strokeStyle = color;
	context.lineWidth = 4;
	context.stroke();
	context.beginPath();
	context.arc(75, y, r, arc1, arc2);
	context.stroke();
	context.beginPath();
	context.arc(115, y, r, arc1, arc2);
	context.stroke();

	return canvas.toDataURL();
};

const waveDesc = (waveHeight) => {
	if (waveHeight > 7) return 'ROUGH';
	if (waveHeight > 4) return 'CHOPPY';
	return 'LIGHT';
};

// register display
registerDisplay(new MarineForecast(11, 'marine-forecast'));

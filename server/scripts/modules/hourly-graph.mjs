// hourly forecast list

import STATUS from './status.mjs';
import getHourlyData from './hourly.mjs';
import WeatherDisplay from './weatherdisplay.mjs';
import { registerDisplay } from './navigation.mjs';
import { timeZone } from './location.mjs';
import { DateTime } from '../vendor/auto/luxon.mjs';
import settings from './settings.mjs';

// two chart areas
const chartAreas = [
	'.top',
	'.bottom',
];

// set up spacing and scales
const scaling = () => {
	const available = {
		width: 532,
		height: 285,
	};
	const dataLength = {
		hours: 36,
		xTicks: 4,
	};

	if (settings.wide?.value && settings.enhanced?.value) {
		available.width = available.width + 107 + 107;
		available.height = 285;
		dataLength.hours = 48;
		dataLength.xTicks = 6;
	}

	if (settings.portrait?.value && settings.enhanced?.value) {
		available.height = 450;
	}

	return {
		available,
		dataLength,
	};
};

class HourlyGraph extends WeatherDisplay {
	constructor(navId, elemId, defaultActive) {
		super(navId, elemId, 'Hourly Graph', defaultActive);

		// move the top right data into the correct location on load
		document.addEventListener('DOMContentLoaded', () => {
			this.moveHeader();
		});
	}

	moveHeader() {
		// get the header
		const header = this.fillTemplate('top-right', {});
		// place the header
		this.elem.querySelector('.header .right').append(header);
	}

	async getData(weatherParameters, refresh) {
		// called deliberately with undefined because hourly.mjs is the source of data
		if (!super.getData(undefined, refresh)) return;

		const data = await getHourlyData(() => this.stillWaiting());
		if (!data) {
			if (this.isEnabled) this.setStatus(STATUS.failed);
			return;
		}

		// get interesting data
		const temperature = data.map((d) => d.temperature);
		const probabilityOfPrecipitation = data.map((d) => d.probabilityOfPrecipitation);
		const skyCover = data.map((d) => d.skyCover);
		const dewpoint = data.map((d) => d.dewpoint);

		this.data = {
			skyCover, temperature, probabilityOfPrecipitation, temperatureUnit: data[0].temperatureUnit, dewpoint,
		};

		this.setStatus(STATUS.loaded);
	}

	drawCanvas() {
		super.drawCanvas();
		// get scaling parameters
		const { dataLength, available } = scaling();

		const data = {};
		// clamp down the data to the allowed size
		Object.entries(this.data).forEach(([key, value]) => {
			if (Array.isArray(value)) {
				data[key] = value.slice(0, dataLength.hours);
			}
		});

		// copy the temperature unit
		data.temperatureUnit = this.data.temperatureUnit;

		// get the image
		if (!this.image) this.image = this.elem.querySelector('.chart canvas');
		if (!this.portraitImage) this.portraitImage = this.elem.querySelector('.bottom .chart canvas');

		// set up images
		this.image.width = available.width;
		this.image.height = available.height;
		this.portraitImage.width = available.width;
		this.portraitImage.height = available.height;

		// get context
		this.image.width = available.width;
		this.image.height = available.height;
		const ctx = this.image.getContext('2d');
		ctx.imageSmoothingEnabled = false;

		// set the canvas for each graph to the top one by default
		const contexts = [
			ctx,
			ctx,
			ctx,
			ctx,
		];

		// if in portrait-enhanced, change out the second two contexts with a second canvas
		if (settings.portrait?.value && settings.enhanced?.value) {
			this.portraitImage.width = available.width;
			this.portraitImage.height = available.height;
			const portraitCtx = this.portraitImage.getContext('2d');
			portraitCtx.imageSmoothingEnabled = false;

			contexts[2] = portraitCtx;
			contexts[3] = portraitCtx;
		}

		// calculate time scale
		const timeScale = calcScale(0, 5, data.temperature.length - 1, available.width);
		const timeStep = data.temperature.length / (dataLength.xTicks);
		const startTime = DateTime.now().setZone(timeZone()).startOf('hour');

		// there are two x axes in portrait
		chartAreas.forEach((area) => {
			let prevTime = startTime;
			const elem = this.elem.querySelector(area);
			Array(dataLength.xTicks + 1).fill().forEach((val, idx) => {
				// track the previous label so a day of week can be added when it changes
				const label = formatTime(startTime.plus({ hour: idx * timeStep }), prevTime);
				prevTime = label.ts;
				// write to page
				elem.querySelector(`.x-axis .l-${idx + 1}`).innerHTML = label.formatted;
			});
		});

		// order is important last line drawn is on top
		// clouds
		const percentScale = calcScale(0, available.height - 10, 100, 10);
		const cloud = createPath(data.skyCover, timeScale, percentScale);
		drawPath(cloud, contexts[3], {
			strokeStyle: 'lightgrey',
			lineWidth: 3,
		});

		// precip
		const precip = createPath(data.probabilityOfPrecipitation, timeScale, percentScale);
		drawPath(precip, contexts[2], {
			strokeStyle: 'aqua',
			lineWidth: 3,
		});

		// calculate temperature scale for min and max of dewpoint and temperature
		const minScale = Math.min(...data.dewpoint, ...data.temperature);
		const maxScale = Math.max(...data.dewpoint, ...data.temperature);
		const thirdScale = (maxScale - minScale) / 3;
		const midScale1 = Math.round(minScale + thirdScale);
		const midScale2 = Math.round(minScale + (thirdScale * 2));
		const tempScale = calcScale(minScale, available.height - 10, maxScale, 10);

		// dewpoint
		const dewpointPath = createPath(data.dewpoint, timeScale, tempScale);
		drawPath(dewpointPath, contexts[1], {
			strokeStyle: 'green',
			lineWidth: 3,
		});

		// temperature
		const tempPath = createPath(data.temperature, timeScale, tempScale);
		drawPath(tempPath, contexts[0], {
			strokeStyle: 'red',
			lineWidth: 3,
		});

		// temperature axis labels
		// limited to 3 characters, sacraficing degree character
		const degree = String.fromCharCode(176);

		// only fill the upper chart with temperatures
		this.elem.querySelector('.y-axis .l-1').innerHTML = (maxScale + degree).substring(0, 3);
		this.elem.querySelector('.y-axis .l-2').innerHTML = (midScale2 + degree).substring(0, 3);
		this.elem.querySelector('.y-axis .l-3').innerHTML = (midScale1 + degree).substring(0, 3);
		this.elem.querySelector('.y-axis .l-4').innerHTML = (minScale + degree).substring(0, 3);

		// change the units in the header
		this.elem.querySelector('.temperature').innerHTML = `Temperature ${String.fromCharCode(176)}${data.temperatureUnit}`;
		this.elem.querySelector('.dewpoint').innerHTML = `Dewpoint ${String.fromCharCode(176)}${data.temperatureUnit}`;

		this.finishDraw();
	}
}

// create a scaling function from two points
const calcScale = (x1, y1, x2, y2) => {
	const m = (y2 - y1) / (x2 - x1);
	const b = y1 - m * x1;
	return (x) => m * x + b;
};

// create a path as an array of [x,y]
const createPath = (data, xScale, yScale) => data.map((d, i) => [xScale(i), yScale(d)]);

// draw a path with shadow
const drawPath = (path, ctx, options) => {
	// first shadow
	ctx.beginPath();
	ctx.strokeStyle = 'black';
	ctx.lineWidth = (options?.lineWidth ?? 2) + 2;
	ctx.moveTo(path[0][0], path[0][1] + 2);
	path.slice(1).forEach((point) => ctx.lineTo(point[0], point[1] + 2));
	ctx.stroke();

	// then colored line
	ctx.beginPath();
	ctx.strokeStyle = options?.strokeStyle ?? 'red';
	ctx.lineWidth = (options?.lineWidth ?? 2);
	ctx.moveTo(path[0][0], path[0][1]);
	path.slice(1).forEach((point) => ctx.lineTo(point[0], point[1]));
	ctx.stroke();
};

// format as 1p, 12a, etc.
const formatTime = (time, prev) => {
	// apply the time zone
	const ts = time.setZone(timeZone());

	// if the day of the week changes, show the day of the week in the label
	let format = 'ha';
	if (prev.weekday !== time.weekday) format = 'ccc ha';

	return {
		ts,
		formatted: ts.toFormat(format).slice(0, -1),
	};
};

// register display
registerDisplay(new HourlyGraph(4, 'hourly-graph'));

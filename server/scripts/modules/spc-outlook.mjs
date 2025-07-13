// display spc outlook in a bar graph

import STATUS from './status.mjs';
import { safeJson, safePromiseAll } from './utils/fetch.mjs';
import { DateTime } from '../vendor/auto/luxon.mjs';
import WeatherDisplay from './weatherdisplay.mjs';
import { registerDisplay } from './navigation.mjs';
import testPolygon from './utils/polygon.mjs';
import { debugFlag } from './utils/debug.mjs';

// list of interesting files ordered [0] = today, [1] = tomorrow...
const urlPattern = (day) => `https://www.spc.noaa.gov/products/outlook/day${day}otlk_cat.nolyr.geojson`;

const testAllPoints = (point, data) => {
	// returns all points where the data matches as an array of days and then matches of the properties of the data

	const result = [];
	// start with a loop of days
	data.forEach((day, index) => {
		// initialize the result
		result[index] = false;
		// ensure day exists and has features array
		if (!day || !day.features || !Array.isArray(day.features)) {
			return;
		}
		// loop through each category
		day.features.forEach((feature) => {
			if (!feature.geometry.coordinates) return;
			const inPolygon = testPolygon(point, feature.geometry);
			if (inPolygon) result[index] = feature.properties;
		});
	});

	return result;
};

const barSizes = {
	TSTM: 60,
	MRGL: 150,
	SLGT: 210,
	ENH: 270,
	MDT: 330,
	HIGH: 390,
};

class SpcOutlook extends WeatherDisplay {
	constructor(navId, elemId) {
		super(navId, elemId, 'SPC Outlook', true);
		// don't display on progress/navigation screen
		this.showOnProgress = false;

		// calculate file names, one for each day
		this.files = [null, null, null].map((v, i) => urlPattern(i + 1));

		// set timings
		this.timing.totalScreens = 1;
	}

	async getData(weatherParameters, refresh) {
		if (!super.getData(weatherParameters, refresh)) return;

		// SPC outlook data does not need to be reloaded on a location change, only during silent refresh
		if (!this.rawOutlookData || refresh) {
			try {
				// get the data for today, tomorrow, and the day after
				const filePromises = this.files.map((file) => safeJson(file, {
					retryCount: 1, // Retry one time
					timeout: 10000, // 10 second timeout for SPC outlook data
				}));
				// wait for all the data to be fetched; always returns an array of (potentially null) results
				this.rawOutlookData = await safePromiseAll(filePromises);

				// Filter out null results (like failed requests) and ensure the response has GeoJSON-looking data
				this.rawOutlookData = this.rawOutlookData.filter((value) => value && value.features);

				if (this.rawOutlookData.length === 0) {
					if (debugFlag('verbose-failures')) {
						console.warn('SPC Outlook has zero days of data');
					}
					if (this.isEnabled) this.setStatus(STATUS.failed);
					return;
				}

				if (this.rawOutlookData.length < this.files.length) {
					if (debugFlag('verbose-failures')) {
						console.warn(`SPC Outlook only loaded ${this.rawOutlookData.length} of ${this.files.length} days successfully`);
					}
				}
			} catch (error) {
				console.error(`Unexpected error getting SPC Outlook data: ${error.message}`);
				if (this.isEnabled) this.setStatus(STATUS.failed);
				return;
			}
		}
		// parse the data
		this.data = testAllPoints([weatherParameters.longitude, weatherParameters.latitude], this.rawOutlookData);

		// check if there's a "risk" for any of the three days, otherwise skip the SPC Outlook screen
		if (this.data.reduce((prev, cur) => prev || !!cur, false)) {
			this.timing.totalScreens = 1;
		} else {
			this.timing.totalScreens = 0;
		}
		this.calcNavTiming();

		// we only get here if there was no error above
		this.screenIndex = 0;
		this.setStatus(STATUS.loaded);
	}

	async drawCanvas() {
		super.drawCanvas();

		// analyze each day
		const days = this.data.map((day, index) => {
			// get the day name
			const dayName = DateTime.now().plus({ days: index }).toLocaleString({ weekday: 'long' });

			// fill the name
			const fill = {};
			fill['day-name'] = dayName;

			// create the element
			const elem = this.fillTemplate('day', fill);

			// update the bar length
			const bar = elem.querySelector('.risk-bar');
			if (day.LABEL) {
				bar.style.width = `${barSizes[day.LABEL]}px`;
			} else {
				bar.style.display = 'none';
			}

			return elem;
		});

		// add the days to the display
		const dayContainer = this.elem.querySelector('.days');
		dayContainer.innerHTML = '';
		dayContainer.append(...days);

		// finish drawing
		this.finishDraw();
	}
}

// register display
registerDisplay(new SpcOutlook(10, 'spc-outlook'));

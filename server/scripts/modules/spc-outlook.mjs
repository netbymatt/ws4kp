// display spc outlook in a bar graph

import STATUS from './status.mjs';
import { safeJson, safePromiseAll } from './utils/fetch.mjs';
import { DateTime } from '../vendor/auto/luxon.mjs';
import WeatherDisplay from './weatherdisplay.mjs';
import { registerDisplay } from './navigation.mjs';
import testPolygon from './utils/polygon.mjs';
import { debugFlag } from './utils/debug.mjs';
import settings from './settings.mjs';

// list of interesting files ordered [0] = today, [1] = tomorrow...
const urlPattern = (day, type) => `https://www.spc.noaa.gov/products/outlook/day${day}otlk_${type}.nolyr.geojson`;
const phenomenonTypes = {
	categorical: 'cat',
	tornado: 'torn',
	// sigTornado: 'sigtorn',
	hail: 'hail',
	// sigHail: 'sighail',
	wind: 'wind',
	// sigWind: 'sigwind',
};
// day three only has some files
const day3 = new Set(['categorical']);

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

		// set timings
		this.timing.totalScreens = 1;
	}

	async getData(weatherParameters, refresh) {
		if (weatherParameters) this.weatherParameters = weatherParameters;
		if (!super.getData(weatherParameters, refresh)) return;

		// SPC outlook data does not need to be reloaded on a location change, only during silent refresh
		if (!this.data || refresh) {
			// initialize the data array
			this.data = [];

			// build the list of files
			// calculate file names, one for each day
			this.files = [null, null, null].map((v, i) => {
				const day = {};
				// build a blank data structure at the same time
				const dataDay = {};
				Object.entries(phenomenonTypes).forEach(([key, value]) => {
					if (i < 2 || day3.has(key)) {
						day[key] = urlPattern(i + 1, value);
						dataDay[key] = undefined;
					}
				});
				this.data.push(dataDay);
				return day;
			});

			try {
				// get the data for today, tomorrow, and the day after
				const filePromises = this.files.map((file) => safeJson(file.categorical, {
					retryCount: 1, // Retry one time
					timeout: 10000, // 10 second timeout for SPC outlook data
				}));
				// wait for all the data to be fetched; always returns an array of (potentially null) results
				const rawOutlookData = await safePromiseAll(filePromises);

				// store the data
				rawOutlookData.forEach((outlookDay, index) => {
					this.data[index].categorical = outlookDay?.features;
				});

				// check for at least one day of data
				if (!rawOutlookData.some((d) => d)) {
					if (debugFlag('verbose-failures')) {
						console.warn('SPC Outlook has zero days of data');
					}
					if (this.isEnabled) this.setStatus(STATUS.failed);
					return;
				}

				if (rawOutlookData.length < this.files.length) {
					if (debugFlag('verbose-failures')) {
						console.warn(`SPC Outlook only loaded ${rawOutlookData.length} of ${this.files.length} days successfully`);
					}
				}
			} catch (error) {
				console.error(`Unexpected error getting SPC Outlook data: ${error.message}`);
				if (this.isEnabled) this.setStatus(STATUS.failed);
				return;
			}
		}
		// see if we're inside any of the polygons
		const daysToGet = this.testAllPoints([this.weatherParameters.longitude, this.weatherParameters.latitude], 'categorical');

		// only get detailed data if in portrait
		if (settings.portrait?.value) {
			// determine if all detail data is present
			const allDataPresent = this.data.every((day, dayIndex) => (!daysToGet[dayIndex]?.categorical || Object.values(day).every((cur) => (cur !== undefined))));
			if (!allDataPresent) {
				await this.getRemainingData(daysToGet);
			}
		}

		this.filteredData = this.testAllPoints([this.weatherParameters.longitude, this.weatherParameters.latitude]);

		// check if there's a "risk" for any of the three days, otherwise skip the SPC Outlook screen
		if (!this.filteredData.some((d) => Object.keys(d).length !== 0)) {
			this.timing.totalScreens = 0;
			this.calcNavTiming();
			// the data loaded, there's just nothing to show for this location
			this.setStatus(STATUS.noData);
			return;
		}
		this.timing.totalScreens = 1;
		this.calcNavTiming();

		// we only get here if there was no error above
		this.screenIndex = 0;
		this.setStatus(STATUS.loaded);
	}

	// fetch additional data
	async modeChanged() {
		// get additional data if in portrait
		if (!settings.portrait?.value || this.status !== STATUS.loaded) return;
		const point = [this.weatherParameters.longitude, this.weatherParameters.latitude];
		await this.getRemainingData(this.testAllPoints(point, 'categorical'));
		this.filteredData = this.testAllPoints(point);
		// draw now to avoid a race condition with the higher-level draw command getting not-yet-ready data
		if (this.active) this.drawCanvas();
	}

	async drawCanvas() {
		super.drawCanvas();

		// analyze each day
		const days = this.filteredData.map((day, index) => {
			// get the day name
			const dayName = DateTime.now().plus({ days: index }).toLocaleString({ weekday: 'long' });

			// fill the name
			const fill = {};
			fill['day-name'] = dayName;

			// create the element
			const elem = this.fillTemplate('day', fill);

			// update the bar length
			const bar = elem.querySelector('.risk-bar');
			if (day?.categorical?.LABEL) {
				bar.style.width = `${barSizes[day.categorical.LABEL]}px`;
			} else {
				bar.style.display = 'none';
			}

			return elem;
		});

		// add the days to the display
		const dayContainer = this.elem.querySelector('.days');
		dayContainer.innerHTML = '';
		dayContainer.append(...days);

		// add details for portrait if in portrait
		if (settings.portrait?.value) { // header first
			this.data.forEach((day, index) => {
				if (index > 1) return;
				const header = this.elem.querySelector(`.header.day-${index}`);
				const dayName = DateTime.now().plus({ days: index }).toLocaleString({ weekday: 'long' });
				header.innerHTML = dayName;
			});

			// first column labels
			const rowLabels = ['Tornado', 'Wind', 'Hail'];

			const detailLines = rowLabels.map((label) => {
				const row = [];
				// type of phenomena
				row.push(this.fillTemplate('type', { 'grid-item': label }));
				const phenomena = label.toLowerCase();
				// probability
				row.push(this.fillTemplate('day-0', { 'grid-item': formatProbability(this.filteredData[0]?.[phenomena]?.DN) }));
				row.push(this.fillTemplate('day-1', { 'grid-item': formatProbability(this.filteredData[1]?.[phenomena]?.DN) }));
				return row;
			}).flat(1);

			// add the lines to the page
			const details = this.elem.querySelector('.container-details .table');
			const replaceable = details.querySelectorAll('.replaceable');
			replaceable.forEach((elem) => elem.remove());
			details.append(...detailLines);
		}

		// finish drawing
		this.finishDraw();
	}

	async getRemainingData(daysToGet) {
		await Promise.allSettled(this.data.map(async (day, index) => {
			if (!daysToGet[index]?.categorical) return;
			const dayPromises = Object.entries(day).map(async ([key, value]) => {
				// if data is already present, no work to do
				if (value) return true;
				// no data present, fetch it
				const dayTypeData = await safeJson(this.files[index][key], {
					retryCount: 1, // Retry one time
					timeout: 10000, // 10 second timeout for SPC outlook data
				});
				this.data[index][key] = dayTypeData.features;
				return dayTypeData;
			});
			await Promise.allSettled(Object.values(dayPromises));
		}));
	}

	testAllPoints(point, _types) {
		// uses the stored data and fails soft (false) if data is not yet loaded
		// returns all points where the data matches as an array of days and then matches of the properties of the data

		// types can be specificed as a string, array of strings or defaults to all types
		let types = Object.keys(phenomenonTypes);
		if (typeof _types === 'string') types = [_types];

		const result = [];
		// start with a loop of days
		this.data.forEach((day, index) => {
			// loop through each category
			Object.entries(day).forEach(([category, value]) => {
				// initialize the result
				if (!result[index]) result[index] = {};
				// skip values that do not have data
				if (!value) return;
				// check for category match
				if (!types.includes(category)) return;
				// intermediate result, to be sorted by most significant
				const categoryResult = [];
				value.forEach((polygon) => {
					if (!polygon.geometry.coordinates) return;
					const inPolygon = testPolygon(point, polygon.geometry);
					if (inPolygon) categoryResult.push(polygon.properties);
				});
				if (categoryResult.length > 0) {
					const sorted = categoryResult.sort(labelSortAlgorithm);
					const highestProbability = sorted[0];
					result[index][category] = highestProbability;
				}
			});
		});

		return result;
	}
}

const formatProbability = (prob) => {
	if (prob === undefined) return '-';
	return `${prob}%`;
};

// sort the LABEL field where a label with text such as 'SIGN' is ranked higher than a numeric value
const labelSortAlgorithm = (a, b) => {
	const letterMatch = /[A-Za-z]{1,4}/;
	const aDN = letterMatch.test(a.LABEL) ? a.DN + 1 : a.DN;
	const bDN = letterMatch.test(b.LABEL) ? b.DN + 1 : b.DN;
	return bDN - aDN;
};

// register display
registerDisplay(new SpcOutlook(10, 'spc-outlook'));

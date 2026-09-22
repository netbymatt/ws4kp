// display text based local forecast

import STATUS from './status.mjs';
import { safeJson } from './utils/fetch.mjs';
import WeatherDisplay from './weatherdisplay.mjs';
import { registerDisplay } from './navigation.mjs';
import settings from './settings.mjs';
import filterExpiredPeriods from './utils/forecast-utils.mjs';
import { debugFlag } from './utils/debug.mjs';

// Screen durations below are seconds at normal speed. WeatherDisplay multiplies the base count
// interval by the user's speed setting, so nothing here applies that factor a second time.
const SECONDS_PER_LINE = 1.5; // hold each screen in proportion to how much text it carries
const MIN_SCREEN_SECONDS = 5; // floor so a one or two line screen does not flash past
const BASE_DELAY_MS = 250; // milliseconds per base count, fine enough to express the above
// only used when the forecast container cannot be measured
const FALLBACK_PAGE_LINES = 7;

// convert a normal-speed duration to base counts
const secondsToCounts = (seconds) => Math.round((seconds * 1000) / BASE_DELAY_MS);

// how long a screen holding the given number of text lines should remain up, at normal speed
const screenSeconds = (lines) => Math.max(MIN_SCREEN_SECONDS, lines * SECONDS_PER_LINE);

class LocalForecast extends WeatherDisplay {
	constructor(navId, elemId) {
		super(navId, elemId, 'Local Forecast', true);

		// set timings
		this.timing.baseDelay = BASE_DELAY_MS;
	}

	async getData(weatherParameters, refresh) {
		if (!super.getData(weatherParameters, refresh)) return;

		// get raw data
		const rawData = await this.getRawData(this.weatherParameters);
		// check for data, or if there's old data available
		if (!rawData && !this.data) {
			// fail for no old or new data
			if (this.isEnabled) this.setStatus(STATUS.failed);
			return;
		}
		// store the data
		this.data = rawData || this.data;

		// set up the forecast pages
		this.layoutScreens();
	}

	modeChanged() {
		if (this.status !== STATUS.loaded) return;
		this.layoutScreens();	// pairing + fillTemplate + calculateContentAwareTiming + calcNavTiming
		// roll back the screen if the re-layout puts us past the end of pages
		if (this.screenIndex >= this.timing.totalScreens) this.screenIndex = this.timing.totalScreens - 1;
	}

	// set the paging and screen timings for the text forecasts
	layoutScreens() {
		// parse raw data and filter out expired periods
		const conditions = parse(this.data, this.weatherParameters.forecast);

		// read each text
		this.screenTexts = conditions.map((condition) => {
			// process the text
			let text = `${condition.DayName}...`;
			const conditionText = condition.Text;
			text += conditionText.replaceAll('...', ' ');

			return text;
		});

		// if in portrait combine to 2 days on one screen

		if (settings.portrait?.value && settings.enhanced?.value) {
			const newScreenTexts = [];
			this.screenTexts.forEach((text, idx) => {
				// even is passed through
				if ((idx % 2) === 0) {
					newScreenTexts.push(text);
				} else {
					// odd is added to the previous index
					newScreenTexts[Math.floor(idx / 2)] += `<br/><br/>${text}`;
				}
			});
			// reassign the screens
			this.screenTexts = newScreenTexts;
		}

		// fill the forecast texts
		const templates = this.screenTexts.map((text) => this.fillTemplate('forecast', { text }));
		const forecastsElem = this.elem.querySelector('.forecasts');
		forecastsElem.innerHTML = '';
		forecastsElem.append(...templates);

		// measures the rendered page, sets this.pageHeight, and builds the timing array
		this.calculateContentAwareTiming(templates);

		this.calcNavTiming();

		this.setStatus(STATUS.loaded);
	}

	// get the unformatted data
	async getRawData(weatherParameters) {
		// request us or si units using centralized safe handling
		// safeJson resolves to null on failure
		return safeJson(weatherParameters.forecast, {
			data: {
				units: settings.units.value,
			},
			retryCount: 3,
			stillWaiting: () => this.stillWaiting(),
		});
	}

	async drawCanvas() {
		super.drawCanvas();

		const top = -this.screenIndex * this.pageHeight;
		this.elem.querySelector('.forecasts').style.top = `${top}px`;

		this.finishDraw();
	}

	// calculate dynamic timing based on height measurement template approach
	calculateContentAwareTiming(templates) {
		const forecastContainer = this.elem.querySelector('.local-forecast .container');

		if (!templates || templates.length === 0) {
			// nothing to measure or paginate, hold one minimum-length screen
			this.pageHeight = forecastContainer?.offsetHeight ?? 0;
			this.timing.delay = secondsToCounts(MIN_SCREEN_SECONDS);
			return;
		}

		// Get line height from CSS for accurate calculations
		const sampleForecast = templates[0];
		const computedStyle = window.getComputedStyle(sampleForecast);
		const lineHeight = parseInt(computedStyle.lineHeight, 10);

		// Page geometry is measured from the rendered container so it cannot drift from the
		// stylesheet, then snapped down to a whole number of lines. A page height that is not an
		// exact multiple of the line height puts the page boundary partway through a wrapped line.
		let maxLinesPerScreen = Math.floor((forecastContainer?.offsetHeight ?? 0) / lineHeight);
		if (!Number.isFinite(maxLinesPerScreen) || maxLinesPerScreen < 1) {
			console.error(`LocalForecast: could not measure the forecast container, falling back to ${FALLBACK_PAGE_LINES} lines per page`);
			maxLinesPerScreen = FALLBACK_PAGE_LINES;
		}
		this.pageHeight = maxLinesPerScreen * lineHeight;

		if (debugFlag('localforecast')) {
			console.log(`LocalForecast: page holds ${maxLinesPerScreen} lines (${this.pageHeight}px at ${lineHeight}px line-height)`);
		}

		// Measure each forecast period to get actual line counts
		const forecastLineCounts = [];

		templates.forEach((template, index) => {
			const currentHeight = template.offsetHeight;
			const currentLines = Math.round(currentHeight / lineHeight);

			if (currentLines > maxLinesPerScreen) {
				// Multi-page forecasts measure correctly, so use the measurement directly
				forecastLineCounts.push(currentLines);

				if (debugFlag('localforecast')) {
					console.log(`LocalForecast: Forecast ${index} measured ${currentLines} lines (${currentHeight}px direct measurement, ${lineHeight}px line-height)`);
				}
			} else {
				// Short forecasts are floored by the css min-height, so a two line and a full page
				// forecast measure the same. Pad past that floor with one <br/> per page line,
				// measure, then subtract the padding to recover the real line count.
				const originalHTML = template.innerHTML;
				const paddingBRs = '<br/>'.repeat(maxLinesPerScreen);
				template.innerHTML = originalHTML + paddingBRs;

				// Measure the padded height
				const paddedHeight = template.offsetHeight;
				const paddedLines = Math.round(paddedHeight / lineHeight);

				// Calculate actual content lines by subtracting the padding lines we added
				const actualLines = Math.max(1, paddedLines - maxLinesPerScreen);

				// Restore original content
				template.innerHTML = originalHTML;

				forecastLineCounts.push(actualLines);

				if (debugFlag('localforecast')) {
					console.log(`LocalForecast: Forecast ${index} measured ${actualLines} lines (${paddedHeight}px with padding - ${maxLinesPerScreen * lineHeight}px = ${actualLines * lineHeight}px actual, ${lineHeight}px line-height)`);
				}
			}
		});

		// Apply height padding for proper scrolling display (keep existing system working)
		templates.forEach((forecast) => {
			const newHeight = Math.ceil(forecast.offsetHeight / this.pageHeight) * this.pageHeight;
			forecast.style.height = `${newHeight}px`;
		});

		// Calculate total screens based on padded height (for navigation system)
		const forecastsElem = templates[0].parentNode;
		const totalHeight = forecastsElem.scrollHeight;
		this.timing.totalScreens = Math.round(totalHeight / this.pageHeight);

		// Now calculate timing based on actual measured line counts, ignoring padding
		const screenTimings = [];
		forecastLineCounts.forEach((lines, forecastIndex) => {
			if (lines <= maxLinesPerScreen) {
				// Single screen for this forecast
				screenTimings.push({ forecastIndex, lines, type: 'single' });
			} else {
				// Multiple screens for this forecast
				let remainingLines = lines;
				let isFirst = true;

				while (remainingLines > 0) {
					const linesThisScreen = Math.min(remainingLines, maxLinesPerScreen);
					const type = isFirst ? 'first-of-multi' : 'remainder';

					screenTimings.push({ forecastIndex, lines: linesThisScreen, type });

					remainingLines -= linesThisScreen;
					isFirst = false;
				}
			}
		});

		// Hold each screen in proportion to how much text it carries so the reading rate is the same
		// on a sparse standard page and a dense portrait one. These are normal-speed durations; the
		// user's speed setting is applied downstream when the base count interval is scheduled.
		const screenDelays = screenTimings.map((screenInfo, screenIndex) => {
			const seconds = screenSeconds(screenInfo.lines);
			const baseCounts = secondsToCounts(seconds);

			if (debugFlag('localforecast')) {
				console.log(`LocalForecast: Screen ${screenIndex}: ${screenInfo.lines} lines, ${seconds.toFixed(1)}s at normal speed, ${baseCounts} counts (forecast ${screenInfo.forecastIndex}, ${screenInfo.type})`);
			}

			return baseCounts;
		});

		// Reconcile against the screen count the padded heights produced. The two agree whenever the
		// page height is a whole number of lines, so a mismatch means the geometry changed underneath.
		while (screenDelays.length < this.timing.totalScreens) {
			screenDelays.push(secondsToCounts(MIN_SCREEN_SECONDS));
			if (debugFlag('localforecast')) {
				console.warn(`LocalForecast: using fallback timing for screen ${screenDelays.length - 1}`);
			}
		}

		// Truncate if we have too many calculated screens
		if (screenDelays.length > this.timing.totalScreens) {
			const removed = screenDelays.splice(this.timing.totalScreens);
			if (debugFlag('localforecast')) {
				console.warn(`LocalForecast: truncated ${removed.length} excess screen timings`);
			}
		}

		// Set the timing array based on screen content
		this.timing.delay = screenDelays;

		if (debugFlag('localforecast')) {
			console.log(`LocalForecast: Final screen count - calculated: ${screenTimings.length}, actual: ${this.timing.totalScreens}, timing array: ${screenDelays.length}`);
			console.log('LocalForecast: Screen durations (s at normal speed):', screenDelays.map((counts) => (counts * BASE_DELAY_MS) / 1000));
		}
	}
}

// format the forecast
// filter out expired periods, then use the first 6 forecasts
const parse = (forecast, forecastUrl) => {
	const allPeriods = forecast.properties.periods;
	const activePeriods = filterExpiredPeriods(allPeriods, forecastUrl);

	return activePeriods.slice(0, 6).map((text) => ({
		// format day and text
		DayName: text.name,
		Text: text.detailedForecast,
	}));
};
// register display
registerDisplay(new LocalForecast(7, 'local-forecast'));

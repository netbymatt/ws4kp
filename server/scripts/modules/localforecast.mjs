// display text based local forecast

import STATUS from './status.mjs';
import { safeJson } from './utils/fetch.mjs';
import WeatherDisplay from './weatherdisplay.mjs';
import { registerDisplay } from './navigation.mjs';
import settings from './settings.mjs';
import filterExpiredPeriods from './utils/forecast-utils.mjs';
import { debugFlag } from './utils/debug.mjs';

class LocalForecast extends WeatherDisplay {
	static BASE_FORECAST_DURATION_MS = 5000; // Base duration (in ms) for a standard 3-5 line forecast page

	constructor(navId, elemId) {
		super(navId, elemId, 'Local Forecast', true);

		// set timings
		this.timing.baseDelay = LocalForecast.BASE_FORECAST_DURATION_MS;
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
		// parse raw data and filter out expired periods
		const conditions = parse(this.data, this.weatherParameters.forecast);

		// read each text
		this.screenTexts = conditions.map((condition) => {
			// process the text
			let text = `${condition.DayName.toUpperCase()}...`;
			const conditionText = condition.Text;
			text += conditionText.toUpperCase().replace('...', ' ');

			return text;
		});

		// fill the forecast texts
		const templates = this.screenTexts.map((text) => this.fillTemplate('forecast', { text }));
		const forecastsElem = this.elem.querySelector('.forecasts');
		forecastsElem.innerHTML = '';
		forecastsElem.append(...templates);

		// Get page height for screen calculations
		this.pageHeight = forecastsElem.parentNode.offsetHeight;

		this.calculateContentAwareTiming(templates);

		this.calcNavTiming();

		this.setStatus(STATUS.loaded);
	}

	// get the unformatted data (also used by extended forecast)
	async getRawData(weatherParameters) {
		// request us or si units using centralized safe handling
		const data = await safeJson(weatherParameters.forecast, {
			data: {
				units: settings.units.value,
			},
			retryCount: 3,
			stillWaiting: () => this.stillWaiting(),
		});

		if (!data) {
			return false;
		}

		return data;
	}

	async drawCanvas() {
		super.drawCanvas();

		const top = -this.screenIndex * this.pageHeight;
		this.elem.querySelector('.forecasts').style.top = `${top}px`;

		this.finishDraw();
	}

	// calculate dynamic timing based on height measurement template approach
	calculateContentAwareTiming(templates) {
		if (!templates || templates.length === 0) {
			this.timing.delay = 1; // fallback to single delay if no templates
			return;
		}

		// Use the original base duration constant for timing calculations
		const originalBaseDuration = LocalForecast.BASE_FORECAST_DURATION_MS;
		this.timing.baseDelay = 250; // use 250ms per count for precise timing control

		// Get line height from CSS for accurate calculations
		const sampleForecast = templates[0];
		const computedStyle = window.getComputedStyle(sampleForecast);
		const lineHeight = parseInt(computedStyle.lineHeight, 10);

		// Calculate the actual width that forecast text uses
		// Use the forecast container that's already been set up
		const forecastContainer = this.elem.querySelector('.local-forecast .container');
		let effectiveWidth;

		if (!forecastContainer) {
			console.error('LocalForecast: Could not find forecast container for width calculation, using fallback width');
			effectiveWidth = 492; // "magic number" from manual calculations as fallback
		} else {
			const containerStyle = window.getComputedStyle(forecastContainer);
			const containerWidth = forecastContainer.offsetWidth;
			const paddingLeft = parseInt(containerStyle.paddingLeft, 10) || 0;
			const paddingRight = parseInt(containerStyle.paddingRight, 10) || 0;
			effectiveWidth = containerWidth - paddingLeft - paddingRight;

			if (debugFlag('localforecast')) {
				console.log(`LocalForecast: Using measurement width of ${effectiveWidth}px (container=${containerWidth}px, padding=${paddingLeft}+${paddingRight}px)`);
			}
		}

		// Measure each forecast period to get actual line counts
		const forecastLineCounts = [];
		templates.forEach((template, index) => {
			const currentHeight = template.offsetHeight;
			const currentLines = Math.round(currentHeight / lineHeight);

			if (currentLines > 7) {
				// Multi-page forecasts measure correctly, so use the measurement directly
				forecastLineCounts.push(currentLines);

				if (debugFlag('localforecast')) {
					console.log(`LocalForecast: Forecast ${index} measured ${currentLines} lines (${currentHeight}px direct measurement, ${lineHeight}px line-height)`);
				}
			} else {
				// If may be 7 lines or less, we need to pad the content to ensure proper height measurement
				// Short forecasts are capped by CSS min-height: 280px (7 lines)
				// Add 7 <br> tags to force height beyond the minimum, then subtract the padding
				const originalHTML = template.innerHTML;
				const paddingBRs = '<br/>'.repeat(7);
				template.innerHTML = originalHTML + paddingBRs;

				// Measure the padded height
				const paddedHeight = template.offsetHeight;
				const paddedLines = Math.round(paddedHeight / lineHeight);

				// Calculate actual content lines by subtracting the 7 BR lines we added
				const actualLines = Math.max(1, paddedLines - 7);

				// Restore original content
				template.innerHTML = originalHTML;

				forecastLineCounts.push(actualLines);

				if (debugFlag('localforecast')) {
					console.log(`LocalForecast: Forecast ${index} measured ${actualLines} lines (${paddedHeight}px with padding - ${7 * lineHeight}px = ${actualLines * lineHeight}px actual, ${lineHeight}px line-height)`);
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
		const maxLinesPerScreen = 7; // 280px / 40px line height
		const screenTimings = []; forecastLineCounts.forEach((lines, forecastIndex) => {
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

		// Create timing array based on measured line counts
		const screenDelays = screenTimings.map((screenInfo, screenIndex) => {
			const screenLines = screenInfo.lines;

			// Apply timing rules based on actual screen content lines
			let timingMultiplier;
			if (screenLines === 1) {
				timingMultiplier = 0.6; // 1 line = shortest (3.0s at normal speed)
			} else if (screenLines === 2) {
				timingMultiplier = 0.8; // 2 lines = shorter (4.0s at normal speed)
			} else if (screenLines >= 6) {
				timingMultiplier = 1.4; // 6+ lines = longer (7.0s at normal speed)
			} else {
				timingMultiplier = 1.0; // 3-5 lines = normal (5.0s at normal speed)
			}

			// Convert to base counts
			const desiredDurationMs = timingMultiplier * originalBaseDuration;
			const baseCounts = Math.round(desiredDurationMs / this.timing.baseDelay);

			if (debugFlag('localforecast')) {
				console.log(`LocalForecast: Screen ${screenIndex}: ${screenLines} lines, ${timingMultiplier.toFixed(2)}x multiplier, ${desiredDurationMs}ms desired, ${baseCounts} counts (forecast ${screenInfo.forecastIndex}, ${screenInfo.type})`);
			}

			return baseCounts;
		});

		// Adjust timing array to match actual screen count if needed
		while (screenDelays.length < this.timing.totalScreens) {
			// Add fallback timing for extra screens
			const fallbackCounts = Math.round(originalBaseDuration / this.timing.baseDelay);
			screenDelays.push(fallbackCounts);
			console.warn(`LocalForecast: using fallback timing for Screen ${screenDelays.length - 1}: 5 lines, 1.00x multiplier, ${fallbackCounts} counts`);
		}

		// Truncate if we have too many calculated screens
		if (screenDelays.length > this.timing.totalScreens) {
			const removed = screenDelays.splice(this.timing.totalScreens);
			console.warn(`LocalForecast: Truncated ${removed.length} excess screen timings`);
		}

		// Set the timing array based on screen content
		this.timing.delay = screenDelays;

		if (debugFlag('localforecast')) {
			console.log(`LocalForecast: Final screen count - calculated: ${screenTimings.length}, actual: ${this.timing.totalScreens}, timing array: ${screenDelays.length}`);
			const multipliers = screenDelays.map((counts) => counts * this.timing.baseDelay / originalBaseDuration);
			console.log('LocalForecast: Screen multipliers:', multipliers);
			console.log('LocalForecast: Expected durations (ms):', screenDelays.map((counts) => counts * this.timing.baseDelay));
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
		DayName: text.name.toUpperCase(),
		Text: text.detailedForecast,
	}));
};
// register display
registerDisplay(new LocalForecast(8, 'local-forecast'));

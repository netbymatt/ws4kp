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
		this.layoutScreens();	// measure + pack + fillTemplate + calcNavTiming
		this.resyncScreenIndex();
	}

	// set the paging and screen timings for the text forecasts
	layoutScreens() {
		// parse raw data and filter out expired periods
		const conditions = parse(this.data, this.weatherParameters.forecast);
		const periodTexts = conditions.map((condition) => `${condition.DayName}...${condition.Text.replaceAll('...', ' ')}`);

		const forecastsElem = this.elem.querySelector('.forecasts');
		const forecastContainer = this.elem.querySelector('.local-forecast .container');

		// render each period on its own so its line count can be measured
		const periodTemplates = periodTexts.map((text) => this.fillTemplate('forecast', { text }));
		forecastsElem.innerHTML = '';
		forecastsElem.append(...periodTemplates);

		if (periodTemplates.length === 0) {
			// nothing to measure or paginate, hold one minimum-length screen
			this.pageHeight = forecastContainer?.offsetHeight ?? 0;
			this.timing.delay = secondsToCounts(MIN_SCREEN_SECONDS);
			this.calcNavTiming();
			this.setStatus(STATUS.loaded);
			return;
		}

		const lineHeight = parseInt(window.getComputedStyle(periodTemplates[0]).lineHeight, 10);

		// Page geometry is measured from the rendered container so it cannot drift from the
		// stylesheet, then snapped down to a whole number of lines. A page height that is not an
		// exact multiple of the line height puts the page boundary partway through a wrapped line.
		let linesPerPage = Math.floor((forecastContainer?.offsetHeight ?? 0) / lineHeight);
		if (!Number.isFinite(linesPerPage) || linesPerPage < 1) {
			console.error(`LocalForecast: could not measure the forecast container, falling back to ${FALLBACK_PAGE_LINES} lines per page`);
			linesPerPage = FALLBACK_PAGE_LINES;
		}
		this.pageHeight = linesPerPage * lineHeight;

		const periodLines = periodTemplates.map((template) => Math.max(1, Math.round(template.offsetHeight / lineHeight)));
		// portrait enhanced keeps its limit of two periods per screen
		const maxPeriods = (settings.portrait?.value && settings.enhanced?.value) ? 2 : Infinity;
		const groups = packPeriods(periodLines, linesPerPage, maxPeriods);

		// render one template per group, padded to a whole number of pages
		const screenTemplates = groups.map((group) => {
			const text = group.periods.map((index) => periodTexts[index]).join('<br/><br/>');
			const template = this.fillTemplate('forecast', { text });
			template.style.height = `${Math.ceil(group.lines / linesPerPage) * this.pageHeight}px`;
			return template;
		});
		forecastsElem.innerHTML = '';
		forecastsElem.append(...screenTemplates);

		// Hold each screen in proportion to how much text it carries so the reading rate is the same
		// on a sparse standard page and a dense portrait one. Only text lines count, not the blank
		// line between periods. These are normal-speed durations; the user's speed setting is
		// applied downstream when the base count interval is scheduled.
		const screenLines = groups.flatMap((group) => pageTextLines(group, periodLines, linesPerPage));
		this.timing.delay = screenLines.map((lines) => secondsToCounts(screenSeconds(lines)));

		if (debugFlag('localforecast')) {
			console.log(`LocalForecast: page holds ${linesPerPage} lines (${this.pageHeight}px at ${lineHeight}px line-height)`);
			console.log('LocalForecast: period lines', periodLines, 'groups', groups.map((group) => group.periods));
			console.log('LocalForecast: Screen durations (s at normal speed):', screenLines.map(screenSeconds));
		}

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

// Group consecutive periods onto shared screens. A period joins the previous group only when it
// fits entirely, after a one line gap, in the space left on that group's last page, and the group
// holds fewer than maxPeriods periods.
const packPeriods = (periodLines, linesPerPage, maxPeriods = Infinity) => {
	const groups = [];
	let current = null;
	periodLines.forEach((lines, index) => {
		const lastPageLines = current ? ((current.lines - 1) % linesPerPage) + 1 : linesPerPage;
		if (current && current.periods.length < maxPeriods && linesPerPage - lastPageLines >= lines + 1) {
			current.periods.push(index);
			current.lines += 1 + lines;
		} else {
			current = { periods: [index], lines };
			groups.push(current);
		}
	});
	return groups;
};

// count the text lines on each page of a group, skipping the blank line between periods
const pageTextLines = (group, periodLines, linesPerPage) => {
	const pages = new Array(Math.ceil(group.lines / linesPerPage)).fill(0);
	let line = 0;
	group.periods.forEach((index, position) => {
		if (position > 0) line += 1; // blank separator line
		for (let i = 0; i < periodLines[index]; i += 1) {
			pages[Math.floor(line / linesPerPage)] += 1;
			line += 1;
		}
	});
	return pages;
};

// register display
registerDisplay(new LocalForecast(7, 'local-forecast'));

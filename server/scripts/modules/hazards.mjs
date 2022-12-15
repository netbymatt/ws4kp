// hourly forecast list

import STATUS from './status.mjs';
import { json } from './utils/fetch.mjs';
import WeatherDisplay from './weatherdisplay.mjs';
import { registerDisplay } from './navigation.mjs';

const hazardLevels = {
	Extreme: 10,
	Severe: 5,
};

class Hazards extends WeatherDisplay {
	constructor(navId, elemId, defaultActive) {
		// special height and width for scrolling
		super(navId, elemId, 'Hazards', defaultActive);
		this.showOnProgress = false;

		// 0 screens skips this during "play"
		this.timing.totalScreens = 0;
	}

	async getData(weatherParameters) {
		// super checks for enabled
		const superResult = super.getData(weatherParameters);

		const alert = this.checkbox.querySelector('.alert');
		alert.classList.remove('show');

		try {
			// get the forecast
			const url = new URL('https://api.weather.gov/alerts/active');
			url.searchParams.append('point', `${this.weatherParameters.latitude},${this.weatherParameters.longitude}`);
			url.searchParams.append('limit', 5);
			const alerts = await json(url, { retryCount: 3, stillWaiting: () => this.stillWaiting() });
			const unsortedAlerts = alerts.features ?? [];
			const sortedAlerts = unsortedAlerts.sort((a, b) => (hazardLevels[b.properties.severity] ?? 0) - (hazardLevels[a.properties.severity] ?? 0));
			const filteredAlerts = sortedAlerts.filter((hazard) => hazard.properties.severity !== 'Unknown');
			this.data = filteredAlerts;

			// show alert indicator
			if (this.data.length > 0) alert.classList.add('show');
		} catch (e) {
			console.error('Get hourly forecast failed');
			console.error(e.status, e.responseJSON);
			if (this.isEnabled) this.setStatus(STATUS.failed);
			// return undefined to other subscribers
			this.getDataCallback(undefined);
			return;
		}

		this.getDataCallback();

		if (!superResult) return;
		this.drawLongCanvas();
	}

	async drawLongCanvas() {
		// get the list element and populate
		const list = this.elem.querySelector('.hazard-lines');
		list.innerHTML = '';

		const lines = this.data.map((data) => {
			const fillValues = {};
			// text
			fillValues['hazard-text'] = `${data.properties.event}<br/><br/>${data.properties.description.replace('\n', '<br/><br/>')}`;

			return this.fillTemplate('hazard', fillValues);
		});

		list.append(...lines);

		// no alerts, skip this display by setting timing to zero
		if (lines.length === 0) {
			this.timing.totalScreens = 0;
			this.setStatus(STATUS.loaded);
			return;
		}

		// update timing
		// set up the timing
		this.timing.baseDelay = 20;
		// 24 hours = 6 pages
		const pages = Math.ceil(list.scrollHeight / 390); // first page is already displayed, last page doesn't happen
		const timingStep = 75 * 4;
		this.timing.delay = [150 + timingStep];
		// add additional pages
		for (let i = 0; i < pages; i += 1) this.timing.delay.push(timingStep);
		// add the final 3 second delay
		this.timing.delay.push(150);
		this.calcNavTiming();
		this.setStatus(STATUS.loaded);
	}

	drawCanvas() {
		super.drawCanvas();
		this.finishDraw();
	}

	showCanvas() {
		// special to hourly to draw the remainder of the canvas
		this.drawCanvas();
		super.showCanvas();
	}

	// screen index change callback just runs the base count callback
	screenIndexChange() {
		this.baseCountChange(this.navBaseCount);
	}

	// base count change callback
	baseCountChange(count) {
		// calculate scroll offset and don't go past end
		let offsetY = Math.min(this.elem.querySelector('.hazard-lines').getBoundingClientRect().height - 390, (count - 150));

		// don't let offset go negative
		if (offsetY < 0) offsetY = 0;

		// copy the scrolled portion of the canvas
		this.elem.querySelector('.main').scrollTo(0, offsetY);
	}

	// make data available outside this class
	// promise allows for data to be requested before it is available
	async getCurrentData(stillWaiting) {
		if (stillWaiting) this.stillWaitingCallbacks.push(stillWaiting);
		return new Promise((resolve) => {
			if (this.data) resolve(this.data);
			// data not available, put it into the data callback queue
			this.getDataCallbacks.push(() => resolve(this.data));
		});
	}
}

// register display
registerDisplay(new Hazards(0, 'hazards', true));

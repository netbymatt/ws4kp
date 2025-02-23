// base weather display class

import STATUS, { calcStatusClass, statusClasses } from './status.mjs';
import { DateTime } from '../vendor/auto/luxon.mjs';
import {
	msg, displayNavMessage, isPlaying, updateStatus, timeZone,
} from './navigation.mjs';
import { parseQueryString } from './share.mjs';
import settings from './settings.mjs';

class WeatherDisplay {
	constructor(navId, elemId, name, defaultEnabled) {
		// navId is used in messaging and sort order
		this.navId = navId;
		this.elemId = undefined;
		this.data = undefined;
		this.loadingStatus = STATUS.loading;
		this.name = name ?? elemId;
		this.getDataCallbacks = [];
		this.stillWaitingCallbacks = [];
		this.defaultEnabled = defaultEnabled;
		this.okToDrawCurrentConditions = true;
		this.okToDrawCurrentDateTime = true;
		this.showOnProgress = true;

		// default navigation timing
		this.timing = {
			totalScreens: 1,
			baseDelay: 9000, // 5 seconds
			delay: 1, // 1*1second = 1 second total display time
		};
		this.navBaseCount = 0;
		this.screenIndex = -1;	// special starting condition

		// store elemId once
		this.storeElemId(elemId);

		if (this.isEnabled) {
			this.setStatus(STATUS.loading);
		} else {
			this.setStatus(STATUS.disabled);
		}
		this.startNavCount();

		// get any templates
		document.addEventListener('DOMContentLoaded', () => {
			this.loadTemplates();
		});
	}

	generateCheckbox(defaultEnabled = true) {
		// no checkbox if progress
		if (this.elemId === 'progress') return false;

		// get url provided state
		const urlValue = parseQueryString()?.[`${this.elemId}-checkbox`];
		let urlState;
		if (urlValue !== undefined) {
			urlState = urlValue === 'true';
		}

		// get the saved status of the checkbox, but defer to a value set in the url
		let savedStatus = urlState ?? window.localStorage.getItem(`display-enabled: ${this.elemId}`);
		if (savedStatus === null) savedStatus = defaultEnabled;
		this.isEnabled = !!((savedStatus === 'true' || savedStatus === true));

		// refresh (or initially store the state of the checkbox)
		window.localStorage.setItem(`display-enabled: ${this.elemId}`, this.isEnabled);

		// create a checkbox in the selected displays area
		const label = document.createElement('label');
		label.for = `${this.elemId}-checkbox`;
		label.id = `${this.elemId}-label`;
		const checkbox = document.createElement('input');
		checkbox.type = 'checkbox';
		checkbox.value = true;
		checkbox.id = `${this.elemId}-checkbox`;
		checkbox.name = `${this.elemId}-checkbox`;
		checkbox.checked = this.isEnabled;
		checkbox.addEventListener('change', (e) => this.checkboxChange(e));
		const span = document.createElement('span');
		span.innerHTML = this.name;
		const alert = document.createElement('span');
		alert.innerHTML = '!!!';
		alert.classList.add('alert');

		label.append(checkbox, span, alert);

		this.checkbox = label;

		return label;
	}

	checkboxChange(e) {
		// update the state
		this.isEnabled = e.target.checked;
		// store the value for the next load
		window.localStorage.setItem(`display-enabled: ${this.elemId}`, this.isEnabled);
		// calling get data will update the status and actually get the data if we're set to enabled
		this.getData();
	}

	// set data status and send update to navigation module
	setStatus(value) {
		this.status = value;
		updateStatus({
			id: this.navId,
			status: this.status,
		});

		// update coloring of checkbox at bottom of page
		if (!this.checkbox) return;
		this.checkbox.classList.remove(...statusClasses);
		this.checkbox.classList.add(calcStatusClass(value));
	}

	get status() {
		return this.loadingStatus;
	}

	set status(state) {
		this.loadingStatus = state;
	}

	storeElemId(elemId) {
		// only create it once
		if (this.elemId) return;
		this.elemId = elemId;
	}

	// get necessary data for this display
	getData(weatherParameters) {
		// clear current data
		this.data = undefined;

		// store weatherParameters locally in case we need them later
		if (weatherParameters) this.weatherParameters = weatherParameters;

		// set status
		if (this.isEnabled) {
			this.setStatus(STATUS.loading);
		} else {
			this.setStatus(STATUS.disabled);
			return false;
		}

		// recalculate navigation timing (in case it was modified in the constructor)
		this.calcNavTiming();
		return true;
	}

	// return any data requested before it was available
	getDataCallback() {
		// call each callback
		this.getDataCallbacks.forEach((fxn) => fxn(this.data));
		// clear the callbacks
		this.getDataCallbacks = [];
	}

	drawCanvas() {
		// clean up the first-run flag in screen index
		if (this.screenIndex < 0) this.screenIndex = 0;
		if (this.okToDrawCurrentDateTime) this.drawCurrentDateTime();
	}

	finishDraw() {
		// draw date and time
		if (this.okToDrawCurrentDateTime) {
			this.drawCurrentDateTime();
			// auto clock refresh
			if (!this.dateTimeInterval) {
				// only draw if canvas is active to conserve battery
				this.dateTimeInterval = setInterval(() => this.active && this.drawCurrentDateTime(), 100);
			}
		}
	}

	drawCurrentDateTime() {
		// Get the current date and time.
		const now = DateTime.local().setZone(timeZone());

		// time = "11:35:08 PM";
		const time = now.toLocaleString(DateTime.TIME_WITH_SECONDS).padStart(11, ' ');
		const date = now.toFormat(' ccc LLL ') + now.day.toString().padStart(2, ' ');

		const dateElem = this.elem.querySelector('.date-time.date');
		const timeElem = this.elem.querySelector('.date-time.time');

		if (timeElem && this.lastTime !== time) {
			timeElem.innerHTML = time.toUpperCase();
		}
		this.lastTime = time;

		if (dateElem && this.lastDate !== date) {
			dateElem.innerHTML = date.toUpperCase();
		}
		this.lastDate = date;
	}

	// show/hide the canvas and start/stop the navigation timer
	showCanvas(navCmd) {
		// reset timing if enabled
		// if a nav command is present call it to set the screen index
		if (navCmd === msg.command.firstFrame) this.navNext(navCmd);
		if (navCmd === msg.command.lastFrame) this.navPrev(navCmd);

		this.startNavCount();

		this.elem.classList.add('show');
		document.querySelector('#divTwc').classList.add(this.elemId);
	}

	hideCanvas() {
		this.resetNavBaseCount();
		this.elem.classList.remove('show');
		// used to change backgrounds for widescreen
		document.querySelector('#divTwc').classList.remove(this.elemId);
	}

	get active() {
		return this.elem.offsetHeight !== 0;
	}

	get enabled() {
		return this.isEnabled;
	}

	// navigation timings
	// totalScreens = total number of screens that are available
	// baseDelay = ms to delay before re-evaluating screenIndex
	// delay: three options
	//	integer = each screen will display for this number of baseDelays
	//	[integer, integer, ...] = screenIndex 0 displays for integer[0]*baseDelay, etc.
	//	[{time, si}, ...] = time as above, si is specific screen index to display during this interval
	//	if the array forms are used totalScreens is overwritten by the size of the array
	navBaseTime() {
		// see if play is active and screen is active
		if (!isPlaying() || !this.active) return;
		// increment the base count
		this.navBaseCount += 1;

		// call base count change if available for this function
		if (this.baseCountChange) this.baseCountChange(this.navBaseCount);

		// handle base count/screen index changes
		this.updateScreenFromBaseCount();
	}

	async updateScreenFromBaseCount() {
		// get the next screen index
		const nextScreenIndex = this.screenIndexFromBaseCount();

		// special cases for first and last frame
		// must compare with false as nextScreenIndex could be 0 which is valid
		if (nextScreenIndex === false) {
			this.sendNavDisplayMessage(msg.response.next);
			return;
		}

		// test for no change and exit early
		if (nextScreenIndex === this.screenIndex) return;

		// test for -1 (no screen displayed yet)
		this.screenIndex = nextScreenIndex === -1 ? 0 : nextScreenIndex;

		// call the appropriate screen index change method
		if (this.screenIndexChange) {
			this.screenIndexChange(this.screenIndex);
		} else {
			await this.drawCanvas();
		}
		this.showCanvas();
	}

	// take the three timing formats shown above and break them into arrays for consistent usage in navigation functions
	// this.timing.fullDelay = [end of screen index 0 in base counts, end of screen index 1...]
	// this.timing.screenIndexes = [screen index to use during this.timing.fullDelay[0], screen index to use during this.timing.fullDelay[1], ...]
	calcNavTiming() {
		if (this.timing === false) return;
		// update total screens
		if (Array.isArray(this.timing.delay)) this.timing.totalScreens = this.timing.delay.length;

		// if the delay is provided as a single value, expand it to a series of the same value
		let intermediateDelay = [];
		if (typeof this.timing.delay === 'number') {
			for (let i = 0; i < this.timing.totalScreens; i += 1) intermediateDelay.push(this.timing.delay);
		} else {
			// map just the delays to the intermediate block
			intermediateDelay = this.timing.delay.map((delay) => {
				if (typeof delay === 'object') return delay.time;
				return delay;
			});
		}

		// calculate the cumulative end point of each delay
		let sum = 0;
		this.timing.fullDelay = intermediateDelay.map((val) => {
			const calc = sum + val;
			sum += val;
			return calc;
		});

		// generate a list of screen either sequentially if not provided in an object or from the object
		if (Array.isArray(this.timing.delay) && typeof this.timing.delay[0] === 'object') {
			// extract screen indexes from objects
			this.timing.screenIndexes = this.timing.delay.map((delay) => delay.si);
		} else {
			// generate sequential screen indexes
			this.timing.screenIndexes = [];
			for (let i = 0; i < this.timing.totalScreens; i += 1) this.timing.screenIndexes.push(i);
		}
	}

	// navigate to next screen
	navNext(command) {
		// check for special 'first frame' command
		if (command === msg.command.firstFrame) {
			this.resetNavBaseCount();
		} else {
			// set the base count to the next available frame
			const newBaseCount = this.timing.fullDelay.find((delay) => delay > this.navBaseCount);
			this.navBaseCount = newBaseCount;
		}
		this.updateScreenFromBaseCount();
	}

	// navigate to previous screen
	navPrev(command) {
		// check for special 'last frame' command
		if (command === msg.command.lastFrame) {
			this.navBaseCount = this.timing.fullDelay[this.timing.totalScreens - 1] - 1;
		} else {
			// find the highest fullDelay that is less than the current base count
			const newBaseCount = this.timing.fullDelay.reduce((acc, delay) => {
				if (delay < this.navBaseCount) return delay;
				return acc;
			}, 0);
			// if the new base count is zero then we're already at the first screen
			if (newBaseCount === 0 && this.navBaseCount === 0) {
				this.sendNavDisplayMessage(msg.response.previous);
				return;
			}
			this.navBaseCount = newBaseCount;
		}
		this.updateScreenFromBaseCount();
	}

	// get the screen index for the current base count, returns false if past end of timing array (go to next screen, stop timing)
	screenIndexFromBaseCount() {
		// test for timing enabled
		if (!this.timing) return 0;
		if (this.timing.totalScreens === 0) return false;
		// find the first timing in the timing array that is greater than the base count
		if (this.timing && !this.timing.fullDelay) this.calcNavTiming();
		const timingIndex = this.timing.fullDelay.findIndex((delay) => delay > this.navBaseCount);
		if (timingIndex === -1) return false;
		return this.timing.screenIndexes[timingIndex];
	}

	// start and stop base counter
	startNavCount() {
		if (!this.navInterval) this.navInterval = setInterval(() => this.navBaseTime(), this.timing.baseDelay * settings.speed.value);
	}

	resetNavBaseCount() {
		this.navBaseCount = 0;
		this.screenIndex = -1;
		// reset the timing so we don't short-change the first screen
		if (this.navInterval) {
			clearInterval(this.navInterval);
			this.navInterval = undefined;
		}
	}

	sendNavDisplayMessage(message) {
		displayNavMessage({
			id: this.navId,
			type: message,
		});
	}

	loadTemplates() {
		this.templates = {};
		this.elem = document.querySelector(`#${this.elemId}-html`);
		if (!this.elem) return;
		const templates = this.elem.querySelectorAll('.template');
		templates.forEach((template) => {
			const className = template.classList[0];
			const node = template.cloneNode(true);
			node.classList.remove('template');
			this.templates[className] = node;
			template.remove();
		});
	}

	fillTemplate(name, fillValues) {
		// get the template
		const templateNode = this.templates[name];
		if (!templateNode) return false;

		// clone it
		const template = templateNode.cloneNode(true);

		Object.entries(fillValues).forEach(([key, value]) => {
			// get the specified element
			const elem = template.querySelector(`.${key}`);
			if (!elem) return;

			// fill based on type provided
			if (typeof value === 'string' || typeof value === 'number') {
				// string and number fill the first found selector
				elem.innerHTML = value;
			} else if (value?.type === 'img') {
				// fill the image source
				elem.querySelector('img').src = value.src;
			}
		});

		return template;
	}

	// still waiting for data (retries triggered)
	stillWaiting() {
		if (this.isEnabled) this.setStatus(STATUS.retrying);
		// handle still waiting callbacks
		this.stillWaitingCallbacks.forEach((callback) => callback());
		this.stillWaitingCallbacks = [];
	}
}

export default WeatherDisplay;

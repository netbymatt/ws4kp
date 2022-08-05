// base weather display class

/* globals navigation, utils, luxon, currentWeatherScroll */

const STATUS = {
	loading: Symbol('loading'),
	loaded: Symbol('loaded'),
	failed: Symbol('failed'),
	noData: Symbol('noData'),
	disabled: Symbol('disabled'),
};

// eslint-disable-next-line no-unused-vars
class WeatherDisplay {
	constructor(navId, elemId, name, defaultEnabled, isHtml) {
		// navId is used in messaging
		this.navId = navId;
		this.elemId = undefined;
		this.gifs = [];
		this.data = undefined;
		this.loadingStatus = STATUS.loading;
		this.name = name ?? elemId;
		this.getDataCallbacks = [];
		this.isHtml = isHtml;

		// default navigation timing
		this.timing = {
			totalScreens: 1,
			baseDelay: 9000, // 5 seconds
			delay: 1, // 1*1second = 1 second total display time
		};
		this.navBaseCount = 0;
		this.screenIndex = -1;	// special starting condition

		// create the canvas, also stores this.elemId
		this.createCanvas(elemId);

		if (elemId !== 'progress') this.addCheckbox(defaultEnabled);
		if (this.enabled) {
			this.setStatus(STATUS.loading);
		} else {
			this.setStatus(STATUS.disabled);
		}
		this.startNavCount();

		// get any templates
		this.loadTemplates();
	}

	addCheckbox(defaultEnabled = true) {
		// get the saved status of the checkbox
		let savedStatus = window.localStorage.getItem(`${this.elemId}Enabled`);
		if (savedStatus === null) savedStatus = defaultEnabled;
		if (savedStatus === 'true' || savedStatus === true) {
			this.enabled = true;
		} else {
			this.enabled = false;
		}

		// refresh (or initially store the state of the checkbox)
		window.localStorage.setItem(`${this.elemId}Enabled`, this.enabled);

		// create a checkbox in the selected displays area
		const checkbox = document.createElement('template');
		checkbox.innerHTML = `<label for="${this.elemId}Enabled">
							<input type="checkbox" value="true" id="${this.elemId}Enabled" name="${this.elemId}Enabled"${this.enabled ? ' checked' : ''}/>
						  ${this.name}</label>`;
		checkbox.content.firstChild.addEventListener('change', (e) => this.checkboxChange(e));
		const availableDisplays = document.getElementById('enabledDisplays');
		availableDisplays.appendChild(checkbox.content.firstChild);
	}

	checkboxChange(e) {
		// update the state
		this.enabled = e.target.checked;
		// store the value for the next load
		window.localStorage.setItem(`${this.elemId}Enabled`, this.enabled);
		// calling get data will update the status and actually get the data if we're set to enabled
		this.getData();
	}

	// set data status and send update to navigation module
	setStatus(value) {
		this.status = value;
		navigation.updateStatus({
			id: this.navId,
			status: this.status,
		});
	}

	get status() {
		return this.loadingStatus;
	}

	set status(state) {
		this.loadingStatus = state;
	}

	createCanvas(elemId, width = 640, height = 480) {
		// only create it once
		if (this.elemId) return;
		this.elemId = elemId;

		// no additional work if this is HTML
		if (this.isHtml) return;

		// create a canvas
		const canvas = document.createElement('template');
		canvas.innerHTML = `<canvas id='${`${elemId}Canvas`}' width='${width}' height='${height}' style='display: none;' />`;

		// add to the page
		const container = document.getElementById('container');
		container.appendChild(canvas.content.firstChild);
	}

	// get necessary data for this display
	getData(weatherParameters) {
		// clear current data
		this.data = undefined;

		// store weatherParameters locally in case we need them later
		if (weatherParameters) this.weatherParameters = weatherParameters;

		// set status
		if (this.enabled) {
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
		if (!this.isHtml) {
		// stop all gifs
			this.gifs.forEach((gif) => gif.pause());
			// delete the gifs
			this.gifs.length = 0;
			// refresh the canvas
			this.canvas = document.getElementById(`${this.elemId}Canvas`);
			this.context = this.canvas.getContext('2d');
		}

		// clean up the first-run flag in screen index
		if (this.screenIndex < 0) this.screenIndex = 0;
	}

	finishDraw() {
		let OkToDrawCurrentConditions = true;
		let OkToDrawNoaaImage = true;
		let OkToDrawCurrentDateTime = true;
		let OkToDrawLogoImage = true;
		// let OkToDrawCustomScrollText = false;
		let bottom;

		// visibility tests
		// if (_ScrollText !== '') OkToDrawCustomScrollText = true;
		if (this.elemId === 'almanac') OkToDrawNoaaImage = false;
		if (this.elemId === 'travelForecast') OkToDrawNoaaImage = false;
		if (this.elemId === 'regionalForecast') OkToDrawNoaaImage = false;
		if (this.elemId === 'progress') {
			OkToDrawCurrentConditions = false;
			OkToDrawNoaaImage = false;
		}
		if (this.elemId === 'radar') {
			OkToDrawCurrentConditions = false;
			OkToDrawCurrentDateTime = false;
			OkToDrawNoaaImage = false;
			// OkToDrawCustomScrollText = false;
		}
		if (this.elemId === 'hazards') {
			OkToDrawNoaaImage = false;
			bottom = true;
			OkToDrawLogoImage = false;
		}
		// draw functions
		if (OkToDrawCurrentDateTime) {
			this.drawCurrentDateTime(bottom);
			// auto clock refresh
			if (!this.dateTimeInterval) {
				setInterval(() => this.drawCurrentDateTime(bottom), 100);
			}
		}
		if (OkToDrawLogoImage) this.drawLogoImage();
		if (OkToDrawNoaaImage) this.drawNoaaImage();
		if (OkToDrawCurrentConditions) {
			currentWeatherScroll.start(this.context);
		} else {
			// cause a reset if the progress screen is displayed
			currentWeatherScroll.stop(this.elemId === 'progress');
		}
		// TODO: add custom scroll text
		// if (OkToDrawCustomScrollText) DrawCustomScrollText(WeatherParameters, context);
	}

	drawCurrentDateTime() {
		// only draw if canvas is active to conserve battery
		if (!this.isActive()) return;
		const { DateTime } = luxon;
		// Get the current date and time.
		const now = DateTime.local();

		// time = "11:35:08 PM";
		const time = now.toLocaleString(DateTime.TIME_WITH_SECONDS).padStart(11, ' ');

		if (this.lastTime !== time) {
			utils.elem.forEach('.date-time.time', (elem) => { elem.innerHTML = time.toUpperCase(); });
		}
		this.lastTime = time;

		const date = now.toFormat(' ccc LLL ') + now.day.toString().padStart(2, ' ');

		if (this.lastDate !== date) {
			utils.elem.forEach('.date-time.date', (elem) => { elem.innerHTML = date.toUpperCase(); });
		}
		this.lastDate = date;
	}

	async drawNoaaImage() {
		if (this.isHtml) return;
		// load the image and store locally
		if (!this.drawNoaaImage.image) {
			this.drawNoaaImage.image = utils.image.load('images/noaa5.gif');
		}
		// wait for the image to load completely
		const img = await this.drawNoaaImage.image;
		this.context.drawImage(img, 356, 39);
	}

	async drawLogoImage() {
		if (this.isHtml) return;
		// load the image and store locally
		if (!this.drawLogoImage.image) {
			this.drawLogoImage.image = utils.image.load('images/Logo3.png');
		}
		// wait for the image load completely
		const img = await this.drawLogoImage.image;
		this.context.drawImage(img, 50, 30, 85, 67);
	}

	// show/hide the canvas and start/stop the navigation timer
	showCanvas(navCmd) {
		// reset timing if enabled
		// if a nav command is present call it to set the screen index
		if (navCmd === navigation.msg.command.firstFrame) this.navNext(navCmd);
		if (navCmd === navigation.msg.command.lastFrame) this.navPrev(navCmd);

		this.startNavCount();

		if (!this.isHtml) {
		// see if the canvas is already showing
			if (this.canvas.style.display === 'block') return;

			// show the canvas
			this.canvas.style.display = 'block';
		} else {
			this.elem.classList.add('show');
		}
	}

	hideCanvas() {
		this.resetNavBaseCount();

		if (this.canvas) {
			this.canvas.style.display = 'none';
		}
		if (this.isHtml) {
			this.elem.classList.remove('show');
		}
	}

	isActive() {
		if (!this.isHtml)	return document.getElementById(`${this.elemId}Canvas`).offsetParent !== null;
		return this.elem.offsetHeight !== 0;
	}

	isEnabled() {
		return this.enabled;
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
		if (!navigation.isPlaying() || !this.isActive()) return;
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
			this.sendNavDisplayMessage(navigation.msg.response.next);
			return;
		}

		// test for no change and exit early
		if (nextScreenIndex === this.screenIndex) return;

		// test for -1 (no screen displayed yet)
		if (nextScreenIndex === -1) {
			this.screenIndex = 0;
		} else {
			this.screenIndex = nextScreenIndex;
		}

		// call the appropriate screen index change method
		if (!this.screenIndexChange) {
			await this.drawCanvas();
			this.showCanvas();
		} else {
			this.screenIndexChange(this.screenIndex);
		}
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
		if (command === navigation.msg.command.firstFrame) {
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
		if (command === navigation.msg.command.lastFrame) {
			this.navBaseCount = this.timing.fullDelay[this.timing.totalScreens - 1] - 1;
		} else {
			// find the highest fullDelay that is less than the current base count
			const newBaseCount = this.timing.fullDelay.reduce((acc, delay) => {
				if (delay < this.navBaseCount) return delay;
				return acc;
			}, 0);
			// if the new base count is zero then we're already at the first screen
			if (newBaseCount === 0 && this.navBaseCount === 0) {
				this.sendNavDisplayMessage(navigation.msg.response.previous);
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
		// find the first timing in the timing array that is greater than the base count
		if (this.timing && !this.timing.fullDelay) this.calcNavTiming();
		const timingIndex = this.timing.fullDelay.findIndex((delay) => delay > this.navBaseCount);
		if (timingIndex === -1) return false;
		return this.timing.screenIndexes[timingIndex];
	}

	// start and stop base counter
	startNavCount() {
		if (!this.navInterval) this.navInterval = setInterval(() => this.navBaseTime(), this.timing.baseDelay);
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
		navigation.displayNavMessage({
			id: this.navId,
			type: message,
		});
	}

	loadTemplates() {
		this.templates = {};
		this.elem = document.getElementById(`${this.elemId}-html`);
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
}

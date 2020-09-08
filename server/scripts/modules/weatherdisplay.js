// base weather display class

/* globals navigation, utils, draw, UNITS, luxon */

const STATUS = {
	loading: Symbol('loading'),
	loaded: Symbol('loaded'),
	failed: Symbol('failed'),
	noData: Symbol('noData'),
};

// eslint-disable-next-line no-unused-vars
class WeatherDisplay {
	constructor(navId, elemId, name) {
		// navId is used in messaging
		this.navId = navId;
		this.elemId = undefined;
		this.gifs = [];
		this.data = undefined;
		this.loadingStatus = STATUS.loading;
		this.name = name?name:elemId;

		// default navigation timing
		this.timing = {
			totalScreens: 1,
			baseDelay: 5000, // 5 seconds
			delay: 1, // 1*1second = 1 second total display time
		};
		this.navBaseCount = 0;
		this.screenIndex = 0;

		this.setStatus(STATUS.loading);
		this.createCanvas(elemId);
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
		const container = document.getElementById('container');
		container.innerHTML += `<canvas id='${elemId+'Canvas'}' width='${width}' height='${height}'/ style='display: none;'>`;
	}

	// get necessary data for this display
	getData() {
		// clear current data
		this.data = undefined;
		// set status
		this.setStatus(STATUS.loading);

		// set up the timing delays
		if (Array.isArray(this.timing.delay) && typeof this.timing.delay[0] === 'number') {
			// array is defined as how long each screen should be displayed. This needs to be converted into total time for use here
			if (!this.timing.fullDelay) {
				let sum = 0;
				this.timing.fullDelay = this.timing.delay.map(val => {
					const calc = sum + val;
					sum += val;
					return calc;
				});
			}
		}

		// update total screens
		if (Array.isArray(this.timing.delay)) this.timing.totalScreens = this.timing.delay.length;
	}

	drawCanvas() {
		// stop all gifs
		this.gifs.forEach(gif => gif.pause());
		// delete the gifs
		this.gifs.length = 0;
		// refresh the canvas
		this.canvas = document.getElementById(this.elemId+'Canvas');
		this.context = this.canvas.getContext('2d');
		// clear the canvas
		this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
	}

	finishDraw() {
		let OkToDrawCurrentConditions = true;
		let OkToDrawNoaaImage = true;
		let OkToDrawCurrentDateTime = true;
		let OkToDrawLogoImage = true;
		// let OkToDrawCustomScrollText = false;
		let bottom = undefined;

		// visibility tests
		// if (_ScrollText !== '') OkToDrawCustomScrollText = true;
		if (this.elemId === 'almanac') OkToDrawNoaaImage = false;
		if (this.elemId === 'travelForecast') OkToDrawNoaaImage = false;
		if (this.elemId === 'regionalForecast0') OkToDrawNoaaImage = false;
		if (this.elemId === 'regionalForecast1') OkToDrawNoaaImage = false;
		if (this.elemId === 'regionalForecast2') OkToDrawNoaaImage = false;
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
		// TODO: fix current conditions scroll
		// if (OkToDrawCurrentConditions) DrawCurrentConditions(WeatherParameters, this.context);
		// TODO: add custom scroll text
		// if (OkToDrawCustomScrollText) DrawCustomScrollText(WeatherParameters, context);
	}

	// TODO: update clock automatically
	drawCurrentDateTime(bottom) {
		// only draw if canvas is active to conserve battery
		if (!this.isActive()) return;
		const {DateTime} = luxon;
		const font = 'Star4000 Small';
		const size = '24pt';
		const color = '#ffffff';
		const shadow = 2;

		// on the first pass store the background for the date and time
		if (!this.dateTimeBackground) {
			const bg = this.context.getImageData(410, 30, 175, 60);
			// test background draw complete and skip drawing if there is no background yet
			if (bg.data[0] === 0) return;
			// store the background
			this.dateTimeBackground = bg;
		}

		// Clear the date and time area.
		if (bottom) {
			draw.box(this.context, 'rgb(25, 50, 112)', 0, 389, 640, 16);
		} else {
			this.context.putImageData(this.dateTimeBackground, 410, 30);
		}

		// Get the current date and time.
		const now = DateTime.local();

		//time = "11:35:08 PM";
		const time = now.toLocaleString(DateTime.TIME_WITH_SECONDS).padStart(11,' ');

		let x,y;
		if (bottom) {
			x = 400;
			y = 402;
		} else {
			x = 410;
			y = 65;
		}
		if (navigation.units() === UNITS.metric) {
			x += 45;
		}

		draw.text(this.context, font, size, color, x, y, time.toUpperCase(), shadow); //y += 20;

		const date = now.toFormat(' ccc LLL ') + now.day.toString().padStart(2,' ');

		if (bottom) {
			x = 55;
			y = 402;
		} else {
			x = 410;
			y = 85;
		}
		draw.text(this.context, font, size, color, x, y, date.toUpperCase(), shadow);
	}

	async drawNoaaImage () {
		// load the image and store locally
		if (!this.drawNoaaImage.image) {
			this.drawNoaaImage.image = utils.image.load('images/noaa5.gif');
		}
		// wait for the image to load completely
		const img = await this.drawNoaaImage.image;
		this.context.drawImage(img, 356, 39);
	}

	async drawLogoImage () {
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
		// if a nav command is present call it to set the screen index
		if (navCmd === navigation.msg.command.firstFrame) this.navNext(navCmd);
		if (navCmd === navigation.msg.command.lastFrame) this.navPrev(navCmd);

		// see if the canvas is already showing
		if (this.canvas.style.display === 'block') return false;

		// show the canvas
		this.canvas.style.display = 'block';

		// reset timing
		this.startNavCount(navigation.isPlaying());

		// if there was a command the canvas has already been drawn
		if (navCmd) return;

		// refresh the canvas (incase the screen index changed)
		if (navCmd) this.drawCanvas();
	}
	hideCanvas() {
		this.stopNavBaseCount(true);

		if (!this.canvas) return;
		this.canvas.style.display = 'none';
	}

	isActive() {
		return document.getElementById(this.elemId+'Canvas').offsetParent !== null;
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
		this.navBaseCount++;

		// call base count change if available for this function
		if (this.baseCountChange) this.baseCountChange(this.navBaseCount);

		// determine type of timing
		// simple delay
		if (typeof this.timing.delay === 'number') {
			this.navNext();
			return;
		}

		// array of timing integers
		if (Array.isArray(this.timing.delay) && typeof this.timing.delay[0] === 'number') {
			// scan the array for a matching number and calculate new screen index from the number
			const timingMatch = this.timing.fullDelay.indexOf(this.navBaseCount);
			// if not found return
			if (timingMatch < 0 && this.navBaseCount <= this.timing.fullDelay[this.timing.totalScreens-1]) return;
			// navigate to the next screen
			this.navNext();
		}
	}

	// navigate to next screen
	navNext(command) {
		// check for special 'first frame' command
		if (command === navigation.msg.command.firstFrame) {
			this.resetNavBaseCount();
		} else {
			// increment screen index
			this.screenIndex++;
		}
		// test for end reached
		if (this.screenIndex >= this.timing.totalScreens) {
			this.screenIndex = this.timing.totalScreens - 1;
			this.sendNavDisplayMessage(navigation.msg.response.next);
			this.stopNavBaseCount();
			return;
		}
		this.baseCountFromScreenIndex();
		// if the end was not reached, update the canvas (typical), or run a callback (atypical)
		if (!this.screenIndexChange) {
			this.drawCanvas();
		} else {
			this.screenIndexChange(this.screenIndex);
		}
	}

	// navigate to previous screen
	navPrev(command) {
		// check for special 'last frame' command
		if (command === navigation.msg.command.lastFrame) {
			this.screenIndex = this.timing.totalScreens-1;
		} else {
			// decrement screen index
			this.screenIndex--;
		}

		// test for end reached
		if (this.screenIndex < 0) {
			this.screenIndex = 0;
			this.sendNavDisplayMessage(navigation.msg.response.previous);
			return;
		}
		this.baseCountFromScreenIndex();
		// if the end was not reached, update the canvas (typical), or run a callback (atypical)
		if (!this.screenIndexChange) {
			this.drawCanvas();
		} else {
			this.screenIndexChange(this.screenIndex);
		}
	}

	// calculate a baseCount from the screen index for the array timings
	baseCountFromScreenIndex() {
		if (!Array.isArray(this.timing.delay)) return;
		// first screen starts at zero
		if (this.screenIndex === 0) {
			this.navBaseCount = 0;
			return;
		}
		// otherwise return one more than the previous sum
		this.navBaseCount = this.timing.fullDelay[this.screenIndex];
	}

	// start and stop base counter
	startNavCount(reset) {
		if (reset) this.resetNavBaseCount();
		if (!this.navInterval) this.navInterval = setInterval(()=>this.navBaseTime(), this.timing.baseDelay);
	}
	stopNavBaseCount(reset) {
		clearInterval(this.navInterval);
		this.navInterval = undefined;
		if (reset) this.resetNavBaseCount();
	}
	resetNavBaseCount() {
		this.navBaseCount = 0;
		this.screenIndex = 0;
	}

	sendNavDisplayMessage(message) {
		navigation.displayNavMessage({
			id: this.navId,
			type: message,
		});
	}
}
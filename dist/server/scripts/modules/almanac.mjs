// display sun and moon data
import { loadImg, preloadImg } from './utils/image.mjs';
import { DateTime } from '../vendor/auto/luxon.mjs';
import STATUS from './status.mjs';
import WeatherDisplay from './weatherdisplay.mjs';
import { registerDisplay } from './navigation.mjs';

class Almanac extends WeatherDisplay {
	constructor(navId, elemId) {
		super(navId, elemId, 'Almanac', true);

		// pre-load background images (returns promises)
		this.backgroundImage0 = loadImg('images/BackGround3_1.png');

		// preload the moon images
		preloadImg('images/2/Full-Moon.gif');
		preloadImg('images/2/Last-Quarter.gif');
		preloadImg('images/2/New-Moon.gif');
		preloadImg('images/2/First-Quarter.gif');

		this.timing.totalScreens = 1;
	}

	async getData(_weatherParameters) {
		const superResponse = super.getData(_weatherParameters);
		const weatherParameters = _weatherParameters ?? this.weatherParameters;

		// get sun/moon data
		const { sun, moon } = this.calcSunMoonData(weatherParameters);

		// store the data
		this.data = {
			sun,
			moon,
		};
		// share data
		this.getDataCallback();

		if (!superResponse) return;

		// update status
		this.setStatus(STATUS.loaded);
	}

	calcSunMoonData(weatherParameters) {
		const sun = [
			SunCalc.getTimes(new Date(), weatherParameters.latitude, weatherParameters.longitude),
			SunCalc.getTimes(DateTime.local().plus({ days: 1 }).toJSDate(), weatherParameters.latitude, weatherParameters.longitude),
		];

		// brute force the moon phases by scanning the next 30 days
		const moon = [];
		// start with yesterday
		let moonDate = DateTime.local().minus({ days: 1 });
		let { phase } = SunCalc.getMoonIllumination(moonDate.toJSDate());
		let iterations = 0;
		do {
			// get yesterday's moon info
			const lastPhase = phase;
			// calculate new values
			moonDate = moonDate.plus({ days: 1 });
			phase = SunCalc.getMoonIllumination(moonDate.toJSDate()).phase;
			// check for 4 cases
			if (lastPhase < 0.25 && phase >= 0.25) moon.push(this.getMoonTransition(0.25, 'First', moonDate));
			if (lastPhase < 0.50 && phase >= 0.50) moon.push(this.getMoonTransition(0.50, 'Full', moonDate));
			if (lastPhase < 0.75 && phase >= 0.75) moon.push(this.getMoonTransition(0.75, 'Last', moonDate));
			if (lastPhase > phase) moon.push(this.getMoonTransition(0.00, 'New', moonDate));

			// stop after 30 days or 4 moon phases
			iterations += 1;
		} while (iterations <= 30 && moon.length < 4);

		return {
			sun,
			moon,
		};
	}

	// get moon transition from one phase to the next by drilling down by hours, minutes and seconds
	getMoonTransition(threshold, phaseName, start, iteration = 0) {
		let moonDate = start;
		let { phase } = SunCalc.getMoonIllumination(moonDate.toJSDate());
		let iterations = 0;
		const step = {
			hours: iteration === 0 ? -1 : 0,
			minutes: iteration === 1 ? 1 : 0,
			seconds: iteration === 2 ? -1 : 0,
			milliseconds: iteration === 3 ? 1 : 0,
		};

		// increasing test
		let test = (lastPhase, testPhase) => lastPhase < threshold && testPhase >= threshold;
		// decreasing test
		if (iteration % 2 === 0) test = (lastPhase, testPhase) => lastPhase > threshold && testPhase <= threshold;

		do {
			// store last phase
			const lastPhase = phase;
			// calculate new phase after step
			moonDate = moonDate.plus(step);
			phase = SunCalc.getMoonIllumination(moonDate.toJSDate()).phase;
			// wrap phases > 0.9 to -0.1 for ease of detection
			if (phase > 0.9) phase -= 1.0;
			// compare
			if (test(lastPhase, phase)) {
				// last iteration is three, return value
				if (iteration >= 3) break;
				// iterate recursively
				return this.getMoonTransition(threshold, phaseName, moonDate, iteration + 1);
			}
			iterations += 1;
		} while (iterations < 1000);

		return { phase: phaseName, date: moonDate };
	}

	async drawCanvas() {
		super.drawCanvas();
		const info = this.data;
		const Today = DateTime.local();
		const Tomorrow = Today.plus({ days: 1 });

		// sun and moon data
		this.elem.querySelector('.day-1').innerHTML = Today.toLocaleString({ weekday: 'long' });
		this.elem.querySelector('.day-2').innerHTML = Tomorrow.toLocaleString({ weekday: 'long' });
		this.elem.querySelector('.rise-1').innerHTML = DateTime.fromJSDate(info.sun[0].sunrise).toLocaleString(DateTime.TIME_SIMPLE).toLowerCase();
		this.elem.querySelector('.rise-2').innerHTML = DateTime.fromJSDate(info.sun[1].sunrise).toLocaleString(DateTime.TIME_SIMPLE).toLowerCase();
		this.elem.querySelector('.set-1').innerHTML = DateTime.fromJSDate(info.sun[0].sunset).toLocaleString(DateTime.TIME_SIMPLE).toLowerCase();
		this.elem.querySelector('.set-2').innerHTML = DateTime.fromJSDate(info.sun[1].sunset).toLocaleString(DateTime.TIME_SIMPLE).toLowerCase();

		const days = info.moon.map((MoonPhase) => {
			const fill = {};

			const date = MoonPhase.date.toLocaleString({ month: 'short', day: 'numeric' });

			fill.date = date;
			fill.type = MoonPhase.phase;
			fill.icon = { type: 'img', src: imageName(MoonPhase.phase) };

			return this.fillTemplate('day', fill);
		});

		const daysContainer = this.elem.querySelector('.moon .days');
		daysContainer.innerHTML = '';
		daysContainer.append(...days);

		this.finishDraw();
	}

	// make sun and moon data available outside this class
	// promise allows for data to be requested before it is available
	async getSun() {
		return new Promise((resolve) => {
			if (this.data) resolve(this.data);
			// data not available, put it into the data callback queue
			this.getDataCallbacks.push(resolve);
		});
	}
}

const imageName = (type) => {
	switch (type) {
		case 'Full':
			return 'images/2/Full-Moon.gif';
		case 'Last':
			return 'images/2/Last-Quarter.gif';
		case 'New':
			return 'images/2/New-Moon.gif';
		case 'First':
		default:
			return 'images/2/First-Quarter.gif';
	}
};

// register display
const display = new Almanac(9, 'almanac');
registerDisplay(display);

export default display.getSun.bind(display);

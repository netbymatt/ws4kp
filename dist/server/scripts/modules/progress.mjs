// regional forecast and observations
import { loadImg } from './utils/image.mjs';
import STATUS, { calcStatusClass, statusClasses } from './status.mjs';
import WeatherDisplay from './weatherdisplay.mjs';
import {
	registerProgress, message, getDisplay, msg,
} from './navigation.mjs';

class Progress extends WeatherDisplay {
	constructor(navId, elemId) {
		super(navId, elemId, '', false);

		// pre-load background image (returns promise)
		this.backgroundImage = loadImg('images/BackGround1_1.png');

		// disable any navigation timing
		this.timing = false;

		// setup event listener for dom-required initialization
		document.addEventListener('DOMContentLoaded', () => {
			this.version = document.querySelector('#version').innerHTML;
			this.elem.querySelector('.container').addEventListener('click', this.lineClick.bind(this));
		});

		this.okToDrawCurrentConditions = false;
	}

	async drawCanvas(displays, loadedCount) {
		if (!this.elem) return;
		super.drawCanvas();

		// get the progress bar cover (makes percentage)
		if (!this.progressCover) this.progressCover = this.elem.querySelector('.scroll .cover');

		// if no displays provided just draw the backgrounds (above)
		if (!displays) return;
		const lines = displays.map((display, index) => {
			if (display.showOnProgress === false) return false;
			const fill = {
				name: display.name,
			};

			const statusClass = calcStatusClass(display.status);

			// make the line
			const line = this.fillTemplate('item', fill);
			// because of timing, this might get called before the template is loaded
			if (!line) return false;

			// update the status
			const links = line.querySelector('.links');
			links.classList.remove(...statusClasses);
			links.classList.add(statusClass);
			links.dataset.index = index;
			return line;
		}).filter((d) => d);

		// get the container and update
		const container = this.elem.querySelector('.container');
		container.innerHTML = '';
		container.append(...lines);

		this.finishDraw();

		// calculate loaded percent
		const loadedPercent = (loadedCount / displays.length);

		this.progressCover.style.width = `${(1.0 - loadedPercent) * 100}%`;
		if (loadedPercent < 1.0) {
			// show the progress bar and set width
			this.progressCover.parentNode.classList.add('show');
		} else {
			// hide the progressbar after 1 second (lines up with with width transition animation)
			setTimeout(() => this.progressCover.parentNode.classList.remove('show'), 1000);
		}
	}

	lineClick(e) {
		// get index
		const indexRaw = e.target?.parentNode?.dataset?.index;
		if (indexRaw === undefined) return;
		const index = +indexRaw;

		// stop playing
		message('navButton');
		// use the y value to determine an index
		const display = getDisplay(index);
		if (display && display.status === STATUS.loaded) {
			display.showCanvas(msg.command.firstFrame);
			this.elem.classList.remove('show');
		}
	}
}

// register our own display
const progress = new Progress(-1, 'progress');
registerProgress(progress);

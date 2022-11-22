// regional forecast and observations
/* globals WeatherDisplay, navigation */
import { loadImg } from './utils/image.mjs';
import STATUS from './status.mjs';

class Progress extends WeatherDisplay {
	constructor(navId, elemId) {
		super(navId, elemId, '', false);

		// pre-load background image (returns promise)
		this.backgroundImage = loadImg('images/BackGround1_1.png');

		// disable any navigation timing
		this.timing = false;

		this.version = document.getElementById('version').innerHTML;

		// setup event listener
		this.elem.querySelector('.container').addEventListener('click', this.lineClick.bind(this));
	}

	async drawCanvas(displays, loadedCount) {
		super.drawCanvas();

		// get the progress bar cover (makes percentage)
		if (!this.progressCover) this.progressCover = this.elem.querySelector('.scroll .cover');

		// if no displays provided just draw the backgrounds (above)
		if (!displays) return;
		const lines = displays.map((display, index) => {
			const fill = {};

			fill.name = display.name;

			let statusClass;
			switch (display.status) {
			case STATUS.loading:
				statusClass = 'loading';
				break;
			case STATUS.loaded:
				statusClass = 'press-here';
				break;
			case STATUS.failed:
				statusClass = 'failed';
				break;
			case STATUS.noData:
				statusClass = 'no-data';
				break;
			case STATUS.disabled:
				statusClass = 'disabled';
				break;
			default:
			}

			// make the line
			const line = this.fillTemplate('item', fill);
			// because of timing, this might get called before the template is loaded
			if (!line) return false;

			// update the status
			const links = line.querySelector('.links');
			links.classList.remove('loading');
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
		navigation.message('navButton');
		// use the y value to determine an index
		const display = navigation.getDisplay(index);
		if (display && display.status === STATUS.loaded) {
			display.showCanvas(navigation.msg.command.firstFrame);
			this.elem.classList.remove('show');
		}
	}
}

window.Progress = Progress;

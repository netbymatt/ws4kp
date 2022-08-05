// regional forecast and observations

/* globals WeatherDisplay, utils, STATUS, navigation */

// eslint-disable-next-line no-unused-vars
class Progress extends WeatherDisplay {
	constructor(navId, elemId) {
		super(navId, elemId, '', false, true);

		// pre-load background image (returns promise)
		this.backgroundImage = utils.image.load('images/BackGround1_1.png');

		// disable any navigation timing
		this.timing = false;

		this.version = document.getElementById('version').innerHTML;

		// setup event listener
		this.elem.querySelector('.container').addEventListener('click', this.lineClick.bind(this));
	}

	async drawCanvas(displays, loadedCount) {
		super.drawCanvas();

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

		if (loadedPercent < 1.0) {
			// Draw a box for the progress.

		} else {
			// restore the background

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
			if (this.canvas) {
				this.canvas.style.display = 'none';
			}
			if (this.isHtml) {
				this.elem.classList.remove('show');
			}
		}
	}
}

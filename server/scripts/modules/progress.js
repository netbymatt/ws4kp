// regional forecast and observations

/* globals WeatherDisplay, utils, STATUS, draw, navigation */

// eslint-disable-next-line no-unused-vars
class Progress extends WeatherDisplay {
	constructor(navId, elemId) {
		super(navId, elemId);

		// pre-load background image (returns promise)
		this.backgroundImage = utils.image.load('images/BackGround1_1.png');

		// disable any navigation timing
		this.timing = false;

		this.version = document.getElementById('version').innerHTML;
	}

	async drawCanvas(displays, loadedCount) {
		super.drawCanvas();
		// set up an event listener
		if (!this.eventListener) {
			this.eventListener = true;
			this.canvas.addEventListener('click', (e) => this.canvasClick(e), false);
		}

		// get the background image
		const backgroundImage = await this.backgroundImage;

		// only draw the background once
		if (!this.backgroundDrawn) {
			this.context.drawImage(backgroundImage, 0, 0, 640, 480, 0, 0, 640, 480);
			draw.horizontalGradientSingle(this.context, 0, 90, 52, 399, draw.sideColor1, draw.sideColor2);
			draw.horizontalGradientSingle(this.context, 584, 90, 640, 399, draw.sideColor1, draw.sideColor2);
			draw.horizontalGradientSingle(this.context, 0, 30, 500, 90, draw.topColor1, draw.topColor2);
			draw.triangle(this.context, 'rgb(28, 10, 87)', 500, 30, 450, 90, 500, 90);
			draw.titleText(this.context, 'WeatherStar', `4000+ ${this.version}`);
		}

		this.finishDraw();
		// if no displays provided just draw the backgrounds (above)
		if (!displays) return;
		displays.forEach((display, idx) => {
			const y = 120 + idx * 29;
			const dots = Array(120 - Math.floor(display.name.length * 2.5)).join('.');
			draw.text(this.context, 'Star4000 Extended', '19pt', '#ffffff', 70, y, display.name + dots, 2);

			let statusText;
			let statusColor;
			switch (display.status) {
			case STATUS.loading:
				statusText = 'Loading';
				statusColor = '#ffff00';
				break;
			case STATUS.loaded:
				statusText = 'Press Here';
				statusColor = '#00ff00';
				this.context.drawImage(backgroundImage, 440, y - 20, 75, 25, 440, y - 20, 75, 25);
				break;
			case STATUS.failed:
				statusText = 'Failed';
				statusColor = '#ff0000';
				break;
			case STATUS.noData:
				statusText = 'No Data';
				statusColor = '#C0C0C0';
				draw.box(this.context, 'rgb(33, 40, 90)', 475, y - 15, 75, 15);
				break;
			case STATUS.disabled:
				statusText = 'Disabled';
				statusColor = '#C0C0C0';
				this.context.drawImage(backgroundImage, 470, y - 20, 45, 25, 470, y - 20, 45, 25);
				break;
			default:
			}
			// Erase any dots that spill into the status text.
			this.context.drawImage(backgroundImage, 475, y - 20, 165, 30, 475, y - 20, 165, 30);
			draw.text(this.context, 'Star4000 Extended', '19pt', statusColor, 565, y, statusText, 2, 'end');
		});

		// calculate loaded percent
		const loadedPercent = (loadedCount / displays.length);

		if (loadedPercent < 1.0) {
			// Draw a box for the progress.
			draw.box(this.context, '#000000', 51, 428, 534, 22);
			draw.box(this.context, '#ffffff', 53, 430, 530, 18);
			// update the progress gif
			draw.box(this.context, '#1d7fff', 55, 432, 526 * loadedPercent, 14);
		} else {
			// restore the background
			this.context.drawImage(backgroundImage, 51, 428, 534, 22, 51, 428, 534, 22);
		}
	}

	canvasClick(e) {
		// un-scale
		const scale = e.target.getBoundingClientRect().width / e.target.width;
		const x = e.offsetX / scale;
		const y = e.offsetY / scale;
		// eliminate off canvas and outside area clicks
		if (!this.isActive()) return;
		if (y < 100 || y > 410) return;
		if (x < 440 || x > 570) return;

		// stop playing
		navigation.message('navButton');
		// use the y value to determine an index
		const index = Math.floor((y - 100) / 29);
		const display = navigation.getDisplay(index);
		if (display && display.status === STATUS.loaded) {
			display.showCanvas(navigation.msg.command.firstFrame);
			this.hideCanvas();
		}
	}
}

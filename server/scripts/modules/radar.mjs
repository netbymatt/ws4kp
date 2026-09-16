// current weather conditions display
import STATUS from './status.mjs';
import { DateTime } from '../vendor/auto/luxon.mjs';
import getRecentRadars from './radar/get-recent.mjs';
import WeatherDisplay from './weatherdisplay.mjs';
import { registerDisplay, timeZone } from './navigation.mjs';
import setTiles from './radar/tiles.mjs';
import createProjection from './utils/map-projection.mjs';
import {
	RADAR_FINAL_SIZE, TILE_FULL_SIZE, PX, PY,
} from './radar/constants.mjs';

class Radar extends WeatherDisplay {
	constructor(navId, elemId) {
		super(navId, elemId, 'Local Radar');

		this.okToDrawCurrentConditions = false;
		this.okToDrawCurrentDateTime = false;

		// set max images
		this.dopplerRadarImageMax = 6;
		// update timing
		this.timing.baseDelay = 350;
		this.timing.delay = [
			{ time: 4, si: 5 },
			{ time: 1, si: 0 },
			{ time: 1, si: 1 },
			{ time: 1, si: 2 },
			{ time: 1, si: 3 },
			{ time: 1, si: 4 },
			{ time: 4, si: 5 },
			{ time: 1, si: 0 },
			{ time: 1, si: 1 },
			{ time: 1, si: 2 },
			{ time: 1, si: 3 },
			{ time: 1, si: 4 },
			{ time: 4, si: 5 },
			{ time: 1, si: 0 },
			{ time: 1, si: 1 },
			{ time: 1, si: 2 },
			{ time: 1, si: 3 },
			{ time: 1, si: 4 },
			{ time: 12, si: 5 },
		];
	}

	async getData(weatherParameters, refresh) {
		if (!super.getData(weatherParameters, refresh)) return;

		// ALASKA AND HAWAII AREN'T SUPPORTED!
		if (this.weatherParameters.state === 'AK' || this.weatherParameters.state === 'HI') {
			this.setStatus(STATUS.noData);
			return;
		}

		// calculate offsets and sizes
		const radarFinalSize = RADAR_FINAL_SIZE();
		const projection = createProjection('radar-conus', radarFinalSize);
		const user = projection.forward([this.weatherParameters.longitude, this.weatherParameters.latitude]);

		// adjust the user's location to not run off the map
		if (user[PX] < (radarFinalSize.width / 2)) {
			user[PX] = radarFinalSize.width / 2;
		}
		if (user[PX] > (TILE_FULL_SIZE.width - (radarFinalSize.width / 2))) {
			user[PX] = TILE_FULL_SIZE.width - (radarFinalSize.width / 2);
		}
		if (user[PY] < (radarFinalSize.height / 2)) {
			user[PY] = radarFinalSize.height / 2;
		}
		if (user[PY] > (TILE_FULL_SIZE.height - (radarFinalSize.height / 2))) {
			user[PY] = TILE_FULL_SIZE.height - (radarFinalSize.height / 2);
		}

		const imagePromise = getRecentRadars(6, user, projection);

		// set up the base map and overlay tiles
		setTiles({
			user,
			elemId: this.elemId,
		});

		const images = await imagePromise;

		// if no images were found return no-data
		if (images.length === 0) {
			// Radar fetch failed - skip this display in animation by setting totalScreens = 0
			this.timing.totalScreens = 0;
			if (this.isEnabled) this.setStatus(STATUS.failed);
			return;
		}

		const radarInfo = images.map((radar) => {
			const elem = this.fillTemplate('frame', { map: { type: 'canvas', canvas: radar.canvas } });
			const time = radar.timestamp.setZone(timeZone());
			return {
				time,
				elem,
			};
		});

		// put the elements in the container
		const scrollArea = this.elem.querySelector('.scroll-area');
		scrollArea.innerHTML = '';
		scrollArea.append(...radarInfo.map((r) => r.elem));

		// set max length
		this.timing.totalScreens = radarInfo.length;

		this.times = radarInfo.map((radar) => radar.time);
		this.setStatus(STATUS.loaded);
	}

	async drawCanvas() {
		super.drawCanvas();
		const time = this.times[this.screenIndex].toLocaleString(DateTime.TIME_SIMPLE);
		const timePadded = time.length >= 8 ? time : `&nbsp;${time} `;
		this.elem.querySelector('.header .right .time').innerHTML = timePadded;

		// get image offset calculation
		// is slides slightly because of scaling so we have to take a measurement from the rendered page
		const actualFrameHeight = this.elem.querySelector('.frame').scrollHeight;

		// scroll to image
		this.elem.querySelector('.scroll-area').style.top = `${-this.screenIndex * actualFrameHeight}px`;

		this.finishDraw();
	}
}

// register display
registerDisplay(new Radar(11, 'radar'));

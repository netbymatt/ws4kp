// shared behavior for displays that show a loop of map frames (radar and future radar) as a filmstrip:
// one canvas per frame stacked in a column, scrolled a frame at a time behind the base map and overlay tiles
//
// subclasses provide the per-display pieces:
//   getImages({ user, projection, radarFinalSize }) -> promise of the frames to show, oldest first, as
//     [{ canvas, timestamp }] where timestamp is a luxon DateTime. Resolve to a falsy value instead when the
//     subclass has already reported its own status and there is nothing more to do.
//
// and describe the loop through the constructor options:
//   imageMax          -> number of frames in the loop, the screen indexes in the timing are built from it
//   startOnLastFrame  -> true opens the loop on the last frame before playing from the first, false opens on the first

import STATUS from './status.mjs';
import { DateTime } from '../vendor/auto/luxon.mjs';
import WeatherDisplay from './weatherdisplay.mjs';
import { timeZone } from './navigation.mjs';
import { debugFlag } from './utils/debug.mjs';
import setTiles from './radar/tiles.mjs';
import { coerce } from './utils/calc.mjs';
import createProjection from './utils/map-projection.mjs';
import {
	RADAR_FINAL_SIZE, TILE_FULL_SIZE, PX, PY,
} from './radar/constants.mjs';

// The loop plays three times over, holding the last frame at the end of each pass with the longest hold
// at the very end. The first pass opens on either the last frame or the first: opening on the last frame
// shows the newest image immediately, opening on the first plays a forecast forward from its start.
// Delays are in multiples of timing.baseDelay.
const buildDelay = (imageMax, startOnLastFrame) => {
	const last = imageMax - 1;
	const hold = (time, si) => ({ time, si });
	// one frame each from `from` up to, but not including, the last frame
	const pass = (from) => Array.from({ length: last - from }, (_, index) => hold(1, from + index));

	return [
		hold(4, startOnLastFrame ? last : 0),
		...pass(startOnLastFrame ? 0 : 1),
		hold(4, last),
		...pass(0),
		hold(4, last),
		...pass(0),
		hold(12, last),
	];
};

class FilmstripWeatherDisplay extends WeatherDisplay {
	constructor(navId, elemId, name, options = {}) {
		super(navId, elemId, name);

		this.okToDrawCurrentConditions = false;
		this.okToDrawCurrentDateTime = false;

		// set max images
		this.imageMax = options.imageMax;
		// update timing
		this.timing.baseDelay = 350;
		this.timing.delay = buildDelay(this.imageMax, options.startOnLastFrame);
	}

	async getData(weatherParameters, refresh) {
		if (!super.getData(weatherParameters, refresh)) return;

		// ALASKA AND HAWAII AREN'T SUPPORTED!
		if (this.weatherParameters.state === 'AK' || this.weatherParameters.state === 'HI') {
			if (debugFlag('verbose-failures')) {
				console.warn(`${this.constructor.name}: not available for state ${this.weatherParameters.state}`);
			}
			this.setStatus(STATUS.noData);
			return;
		}

		// calculate offsets and sizes
		const radarFinalSize = RADAR_FINAL_SIZE();
		const projection = createProjection('radar-conus');
		const user = projection.forward([this.weatherParameters.longitude, this.weatherParameters.latitude]);
		const projected = [...user];

		// adjust the user's location to not run off the map
		user[PX] = coerce(user[PX], radarFinalSize.width / 2, TILE_FULL_SIZE.width - (radarFinalSize.width / 2));
		user[PY] = coerce(user[PY], radarFinalSize.height / 2, TILE_FULL_SIZE.height - (radarFinalSize.height / 2));

		if (debugFlag(this.elemId)) {
			console.log(`${this.constructor.name}: ${this.weatherParameters.latitude},${this.weatherParameters.longitude} is map pixel ${projected.map(Math.round).join(',')} of ${TILE_FULL_SIZE.width}x${TILE_FULL_SIZE.height}, `
				+ `${radarFinalSize.width}x${radarFinalSize.height} view centred on ${user.map(Math.round).join(',')} after keeping it on the map`);
		}

		const imagePromise = this.getImages({ user, projection, radarFinalSize });

		// set up the base map and overlay tiles
		setTiles({
			user,
			elemId: this.elemId,
		});

		const images = await imagePromise;

		// the subclass has already set the status
		if (!images) return;

		// if no images were found return no-data
		if (images.length === 0) {
			if (debugFlag('verbose-failures')) {
				console.warn(`${this.constructor.name}: no frames were produced, ${this.imageMax} were requested`);
			}
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

		if (debugFlag(this.elemId)) {
			console.log(`${this.constructor.name}: showing ${radarInfo.length} of ${this.imageMax} frames`);
			radarInfo.forEach(({ time }, index) => {
				console.log(`${this.constructor.name}: frame ${index} is ${images[index].timestamp.toUTC().toISO({ suppressMilliseconds: true })}, shown as ${time.toLocaleString(DateTime.TIME_SIMPLE)} ${time.zoneName}`);
			});
		}

		// put the elements in the container
		const scrollArea = this.elem.querySelector('.scroll-area');
		scrollArea.innerHTML = '';
		scrollArea.append(...radarInfo.map((r) => r.elem));

		// set max length
		this.timing.totalScreens = radarInfo.length;

		this.times = radarInfo.map((radar) => radar.time);
		this.setStatus(STATUS.loaded);
	}

	// hook that produces the frames, see the description at the top of the file
	getImages() {
		throw new Error(`${this.constructor.name} must implement getImages()`);
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

		if (debugFlag(this.elemId)) {
			console.log(`${this.constructor.name}: drawing screen ${this.screenIndex} of ${this.times.length}, ${timePadded.replace('&nbsp;', '').trim()}, frame height ${actualFrameHeight}px, scrolled to ${-this.screenIndex * actualFrameHeight}px`);
		}

		this.finishDraw();
	}
}

export default FilmstripWeatherDisplay;

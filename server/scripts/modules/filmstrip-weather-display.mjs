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
import { timeZone } from './location.mjs';
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
		const view = this.calcView();
		this.view = view;
		const { user, radarFinalSize, projected } = view;

		if (debugFlag(this.elemId)) {
			console.log(`${this.constructor.name}: ${this.weatherParameters.latitude},${this.weatherParameters.longitude} is map pixel ${projected.map(Math.round).join(',')} of ${TILE_FULL_SIZE.width}x${TILE_FULL_SIZE.height}, `
				+ `${radarFinalSize.width}x${radarFinalSize.height} view centred on ${user.map(Math.round).join(',')} after keeping it on the map`);
		}

		const imagePromise = this.getImages(view);

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
		// these frames match the current view, so drop any offset left over from a change of mode
		scrollArea.style.transform = '';

		// set max length
		this.timing.totalScreens = radarInfo.length;

		this.times = radarInfo.map((radar) => radar.time);
		this.setStatus(STATUS.loaded);
	}

	// hook that produces the frames, see the description at the top of the file
	getImages() {
		throw new Error(`${this.constructor.name} must implement getImages()`);
	}

	// the view the frames are built for: the size of the finished image, the projection and the
	// user's location in map pixels, kept on the display so drawCanvas() never has to work it out.
	// this is arithmetic only, no network and no rendering
	calcView() {
		const radarFinalSize = RADAR_FINAL_SIZE();
		const projection = createProjection('radar-conus');
		const user = projection.forward([this.weatherParameters.longitude, this.weatherParameters.latitude]);
		const projected = [...user];

		// adjust the user's location to not run off the map
		user[PX] = coerce(user[PX], radarFinalSize.width / 2, TILE_FULL_SIZE.width - (radarFinalSize.width / 2));
		user[PY] = coerce(user[PY], radarFinalSize.height / 2, TILE_FULL_SIZE.height - (radarFinalSize.height / 2));

		return {
			user, projection, radarFinalSize, projected,
		};
	}

	// the frames are rendered for one view size, so a change of display mode has to rebuild them.
	// the cheap parts (the view itself and the base map tiles) are done here and immediately, the
	// frames are rebuilt through the normal data path
	async modeChanged() {
		if (this.status !== STATUS.loaded) return;

		const previous = this.view;
		const view = this.calcView();

		// switching between standard and widescreen does not resize the radar, so there is
		// nothing to rebuild
		if (previous
			&& previous.radarFinalSize.width === view.radarFinalSize.width
			&& previous.radarFinalSize.height === view.radarFinalSize.height) return;

		this.view = view;

		// the base map is made of static images, so it is correct for the new mode right away
		setTiles({
			user: view.user,
			elemId: this.elemId,
		});
		this.offsetFrames(previous);

		// rebuild the frames at the new size. the source images are cached, so this re-projects
		// what is already in memory rather than downloading it again
		await this.getData(this.weatherParameters, true);
		if (this.active) this.drawCanvas();
	}

	// the frames on screen were rendered for the previous view. both views use the same projection
	// and scale, so shifting them by the change in the top-left corner of the view keeps them
	// registered to the new base map until the rebuilt frames replace them
	offsetFrames(previous) {
		if (!previous) return;
		const topLeft = (view) => [
			view.user[PX] - (view.radarFinalSize.width / 2),
			view.user[PY] - (view.radarFinalSize.height / 2),
		];
		const previousTopLeft = topLeft(previous);
		const currentTopLeft = topLeft(this.view);

		this.elem.querySelector('.scroll-area').style.transform = `translate(${previousTopLeft[PX] - currentTopLeft[PX]}px, ${previousTopLeft[PY] - currentTopLeft[PY]}px)`;
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

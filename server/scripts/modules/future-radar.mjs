// future radar loop display
import STATUS from './status.mjs';
import { DateTime } from '../vendor/auto/luxon.mjs';

import WeatherDisplay from './weatherdisplay.mjs';
import { registerDisplay, timeZone } from './navigation.mjs';
import setTiles from './radar/tiles.mjs';
import { coerce } from './utils/calc.mjs';
import createProjection from './utils/map-projection.mjs';
import { solveWindow, chunksForWindow, assembleWindow } from './future-radar/grid.mjs';
import { RUN } from './future-radar/config.mjs';
import { findLatestRun, fetchChunks, clearChunkCache } from './future-radar/zarr.mjs';
import { fieldToImageData, paintToCanvas, getSampleMap } from './future-radar/render.mjs';
import {
	RADAR_FINAL_SIZE, TILE_FULL_SIZE, PX, PY,
} from './radar/constants.mjs';

/**
 * Forecast-hour index (0-based, where 0 is F01) of the first full hour that
 * lies in the future relative to the wall clock right now.
 *
 * An hour boundary is the same instant everywhere, so this needs no time
 * zone — timeZone() only affects how frame times are displayed, not which
 * frames are chosen.
 */
const firstFutureForecastIndex = (runDate) => {
	const nextFullHourMs = (Math.floor(Date.now() / 3600000) + 1) * 3600000;

	// Forecast cubes start at F01 (run + 1h), so frame index 0 covers hour 1.
	const hoursFromRun = Math.round((nextFullHourMs - runDate.getTime()) / 3600000);
	return hoursFromRun - 1;
};

/**
 * Build one ImageData per forecast hour from the already-fetched chunks.
 *
 * Every forecast hour is already in memory: a forecast chunk is a 3-D cube, so
 * the requests above returned all hours at once. This loop is pure CPU.
 *
 * `startIndex` lets playback begin partway into the cube — see
 * `firstFutureForecastIndex()` — rather than always from F01.
 *
 * The reprojection comes from one sample map shared by every frame (and
 * cached across refreshes; see getSampleMap()), so each frame here is only a
 * stitch and a colour lookup.
 */
const buildFrames = (chunks, window, projection, outputSize, startIndex, hourCount, user) => {
	const frames = [];
	const sampleMap = getSampleMap(window, projection, outputSize, user);

	for (let hour = startIndex; hour < startIndex + hourCount; hour += 1) {
		const field = assembleWindow(chunks, window, hour);
		frames.push(paintToCanvas(fieldToImageData(field, sampleMap, outputSize)));
	}

	return frames;
};

/**
 * Local wall-clock time of a forecast frame, in timeZone(), padded for the
 * header's time display.
 *
 * Forecast cubes start at F01, so frame index 0 is one hour after the run.
 */
const frameLocalTime = (runDate, frameIndex) => {
	const frameTime = DateTime.fromJSDate(runDate).plus({ hour: frameIndex + 1 }).setZone(timeZone()).toLocaleString(DateTime.TIME_SIMPLE);
	const timePadded = frameTime.length >= 8 ? frameTime : `&nbsp;${frameTime} `;
	return timePadded;
};

class FutureRadar extends WeatherDisplay {
	constructor(navId, elemId) {
		super(navId, elemId, 'Future Radar');

		// don't display on progress/navigation screen
		this.showOnProgress = false;

		this.okToDrawCurrentConditions = false;
		this.okToDrawCurrentDateTime = false;

		// set max images
		this.futureRadarImageMax = 6;
		// update timing
		this.timing.baseDelay = 350;
		this.timing.delay = [
			{ time: 4, si: 0 },
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
		const projection = createProjection('radar-conus');
		const user = projection.forward([this.weatherParameters.longitude, this.weatherParameters.latitude]);

		// adjust the user's location to not run off the map
		user[PX] = coerce(user[PX], radarFinalSize.width / 2, TILE_FULL_SIZE.width - (radarFinalSize.width / 2));
		user[PY] = coerce(user[PY], radarFinalSize.height / 2, TILE_FULL_SIZE.height - (radarFinalSize.height / 2));

		// set up the base map and overlay tiles
		setTiles({
			user,
			elemId: this.elemId,
		});

		// the finished image is the radarFinalSize crop of the conus map centred on
		// the user, so its corners give the exact bounds the reflectivity must
		// land in — no separate scale constant to keep in step with the tiles
		const halfWidth = radarFinalSize.width / 2;
		const halfHeight = radarFinalSize.height / 2;
		const [west, north] = projection.inverse([user[PX] - halfWidth, user[PY] - halfHeight]);
		const [east, south] = projection.inverse([user[PX] + halfWidth, user[PY] + halfHeight]);
		const bounds = { x: [west, east], y: [north, south] };
		const hrrrProjection = createProjection('radar-conus', bounds, radarFinalSize);

		const window = solveWindow(radarFinalSize, hrrrProjection);
		if (!window.insideDomain) {
			console.error('User is outside the conus domain');
			this.setStatus(STATUS.noData);
			return;
		}
		const chunkIds = chunksForWindow(window);

		// get the latest run
		const run = await findLatestRun();
		if (!run) {
			console.warn(`No published run found in the last ${RUN.maxLookbackHours + 1} hours. `
				+ 'Reflectivity is temporarily unavailable.');
			this.setStatus(STATUS.noData);
			return;
		}
		const { runDate, meta } = run;
		if (this.runDate?.getTime() !== runDate.getTime()) clearChunkCache();
		this.runDate = runDate;

		// fetch the chunks
		const { chunks, errors } = await fetchChunks(this.runDate, chunkIds, meta);

		if (!chunks.length) {
			console.error(`Every chunk failed. ${errors.join('; ')}`);
			this.setStatus(STATUS.noData);
			return;
		}

		// Cube depth varies by run; never ask for more hours than exist.
		const available = Math.min(...chunks.map((c) => c.timeSteps));

		// Playback starts at the first forecast hour still in the future, not
		// always at F01 — a run found via lookback can already be partway past.
		this.startIndex = Math.max(0, firstFutureForecastIndex(this.runDate));
		if (this.startIndex >= available) {
			console.error('This run has no forecast hours left in the future.');
			this.setStatus(STATUS.noData);
			return;
		}

		const hourCount = Math.min(this.futureRadarImageMax, available - this.startIndex);

		const images = buildFrames(chunks, window, hrrrProjection, radarFinalSize, this.startIndex, hourCount, user);

		const radarCanvases = images.map((radar) => {
			const elem = this.fillTemplate('frame', { map: { type: 'canvas', canvas: radar } });

			return elem;
		});

		// put the elements in the container
		const scrollArea = this.elem.querySelector('.scroll-area');
		scrollArea.innerHTML = '';
		scrollArea.append(...radarCanvases);

		// set max length
		this.timing.totalScreens = radarCanvases.length;

		this.times = radarCanvases.map((radar, frameIndex) => frameLocalTime(this.runDate, frameIndex + this.startIndex));
		this.setStatus(STATUS.loaded);
	}

	async drawCanvas() {
		super.drawCanvas();
		const time = this.times[this.screenIndex];
		this.elem.querySelector('.header .right .time').innerHTML = time;

		// get image offset calculation
		// is slides slightly because of scaling so we have to take a measurement from the rendered page
		const actualFrameHeight = this.elem.querySelector('.frame').scrollHeight;

		// scroll to image
		this.elem.querySelector('.scroll-area').style.top = `${-this.screenIndex * actualFrameHeight}px`;

		this.finishDraw();
	}
}

// register display
registerDisplay(new FutureRadar(12, 'future-radar'));

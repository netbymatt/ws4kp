// future radar loop display
import STATUS from './status.mjs';
import { DateTime } from '../vendor/auto/luxon.mjs';
import FilmstripWeatherDisplay from './filmstrip-weather-display.mjs';
import { registerDisplay } from './navigation.mjs';
import createProjection from './utils/map-projection.mjs';
import { paintToCanvas } from './utils/create-canvas.mjs';
import { shiftPixelForUserGenerator } from './radar/positions.mjs';
import { solveWindow, chunksForWindow, assembleWindow } from './future-radar/grid.mjs';
import { RUN } from './future-radar/config.mjs';
import { findLatestRun, fetchChunks, clearChunkCache } from './future-radar/zarr.mjs';
import { fieldToImageData, getSampleMap } from './future-radar/render.mjs';

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
 * Build one canvas per forecast hour from the already-fetched chunks.
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

class FutureRadar extends FilmstripWeatherDisplay {
	constructor(navId, elemId) {
		super(navId, elemId, 'Future Radar', {
			imageMax: 6,
			startOnLastFrame: false,
		});

		// don't display on progress/navigation screen
		this.showOnProgress = false;
	}

	async getImages({ user, projection, radarFinalSize }) {
		// the finished image is the radarFinalSize crop of the conus map centred on
		// the user, so its corners give the exact bounds the reflectivity must
		// land in — no separate scale constant to keep in step with the tiles
		const shiftPixelForUser = shiftPixelForUserGenerator(user);
		const [west, north] = projection.inverse(shiftPixelForUser([0, 0]));
		const [east, south] = projection.inverse(shiftPixelForUser([radarFinalSize.width, radarFinalSize.height]));
		const bounds = { x: [west, east], y: [north, south] };
		const hrrrProjection = createProjection('radar-conus', bounds, radarFinalSize);

		const window = solveWindow(radarFinalSize, hrrrProjection);
		if (!window.insideDomain) {
			console.error('User is outside the conus domain');
			this.setStatus(STATUS.noData);
			return null;
		}
		const chunkIds = chunksForWindow(window);

		// get the latest run
		const run = await findLatestRun();
		if (!run) {
			console.warn(`No published run found in the last ${RUN.maxLookbackHours + 1} hours. `
				+ 'Reflectivity is temporarily unavailable.');
			this.setStatus(STATUS.noData);
			return null;
		}
		const { runDate, meta } = run;
		if (this.runDate?.getTime() !== runDate.getTime()) clearChunkCache();
		this.runDate = runDate;

		// fetch the chunks
		const { chunks, errors } = await fetchChunks(runDate, chunkIds, meta);

		if (!chunks.length) {
			console.error(`Every chunk failed. ${errors.join('; ')}`);
			this.setStatus(STATUS.noData);
			return null;
		}

		// Cube depth varies by run; never ask for more hours than exist.
		const available = Math.min(...chunks.map((c) => c.timeSteps));

		// Playback starts at the first forecast hour still in the future, not
		// always at F01 — a run found via lookback can already be partway past.
		const startIndex = Math.max(0, firstFutureForecastIndex(runDate));
		if (startIndex >= available) {
			console.error('This run has no forecast hours left in the future.');
			this.setStatus(STATUS.noData);
			return null;
		}

		const hourCount = Math.min(this.imageMax, available - startIndex);
		const canvases = buildFrames(chunks, window, hrrrProjection, radarFinalSize, startIndex, hourCount, user);

		// Forecast cubes start at F01, so frame index 0 is one hour after the run.
		return canvases.map((canvas, index) => ({
			canvas,
			timestamp: DateTime.fromJSDate(runDate).plus({ hours: startIndex + index + 1 }),
		}));
	}
}

// register display
registerDisplay(new FutureRadar(12, 'future-radar'));

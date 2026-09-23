// future radar loop display
import STATUS from './status.mjs';
import { DateTime } from '../vendor/auto/luxon.mjs';
import FilmstripWeatherDisplay from './filmstrip-weather-display.mjs';
import { registerDisplay } from './navigation.mjs';
import createProjection from './utils/map-projection.mjs';
import { debugFlag } from './utils/debug.mjs';
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
// model run information for the headend tab
const setHeadendRun = (text) => {
	document.querySelector('#spanFutureRadarRun').textContent = text;
};

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
		const started = performance.now();

		// the finished image is the radarFinalSize crop of the conus map centred on
		// the user, so its corners give the exact bounds the reflectivity must
		// land in — no separate scale constant to keep in step with the tiles
		const shiftPixelForUser = shiftPixelForUserGenerator(user);
		const [west, north] = projection.inverse(shiftPixelForUser([0, 0]));
		const [east, south] = projection.inverse(shiftPixelForUser([radarFinalSize.width, radarFinalSize.height]));
		const bounds = { x: [west, east], y: [north, south] };
		const hrrrProjection = createProjection('radar-conus', bounds, radarFinalSize);

		if (debugFlag('future-radar')) {
			console.log(`FutureRadar: view bounds west ${west.toFixed(3)}, east ${east.toFixed(3)}, north ${north.toFixed(3)}, south ${south.toFixed(3)}`);
		}

		const window = solveWindow(radarFinalSize, hrrrProjection);

		if (debugFlag('future-radar')) {
			console.log(`FutureRadar: grid window ${window.width}x${window.height} cells at i ${window.i0}, j ${window.j0}, clipped to the domain ${window.clippedToDomain}, centre inside the domain ${window.insideDomain}`);
		}

		if (!window.insideDomain) {
			if (debugFlag('verbose-failures')) {
				console.warn('FutureRadar: the view is centred outside the HRRR (CONUS) domain');
			}
			setHeadendRun('outside coverage');
			this.setStatus(STATUS.noData);
			return null;
		}
		const chunkIds = chunksForWindow(window);

		if (debugFlag('future-radar')) {
			console.log(`FutureRadar: window needs ${chunkIds.length} chunks [${chunkIds.join(', ')}]`);
		}

		// get the latest run
		const run = await findLatestRun();
		if (!run) {
			if (debugFlag('verbose-failures')) {
				console.warn(`FutureRadar: no published run found in the last ${RUN.maxLookbackHours + 1} hours, reflectivity is temporarily unavailable`);
			}
			setHeadendRun('none available');
			this.setStatus(STATUS.noData);
			return null;
		}
		const { runDate, meta } = run;

		if (debugFlag('future-radar')) {
			const { compressor } = meta;
			console.log(`FutureRadar: using run ${runDate.toISOString()}, ${((Date.now() - runDate.getTime()) / 3600000).toFixed(1)} hours old, `
				+ `${meta.dtype} ${meta.shape.join('x')} in chunks of ${meta.chunks.join('x')}, ${compressor?.id} ${compressor?.cname} level ${compressor?.clevel} shuffle ${compressor?.shuffle}`);
		}

		if (this.runDate?.getTime() !== runDate.getTime()) {
			const cleared = clearChunkCache();
			if (debugFlag('future-radar')) {
				console.log(`FutureRadar: run changed from ${this.runDate?.toISOString() ?? 'none'}, dropped ${cleared} cached chunks`);
			}
		}
		this.runDate = runDate;
		const runLabel = DateTime.fromJSDate(runDate).toUTC().toFormat("HH'Z' LLL d");
		setHeadendRun(runLabel);

		// fetch the chunks
		const { chunks, errors } = await fetchChunks(runDate, chunkIds, meta);

		if (!chunks.length) {
			if (debugFlag('verbose-failures')) {
				console.error(`FutureRadar: every chunk failed. ${errors.join('; ')}`);
			}
			setHeadendRun(`${runLabel}, download failed`);
			this.setStatus(STATUS.noData);
			return null;
		}

		// Cube depth varies by run; never ask for more hours than exist.
		const available = Math.min(...chunks.map((c) => c.timeSteps));

		if (debugFlag('future-radar')) {
			console.log(`FutureRadar: ${chunks.length} of ${chunkIds.length} chunks ready, time steps per chunk [${chunks.map((chunk) => chunk.timeSteps).join(', ')}], ${available} forecast hours available`);
		}

		// Playback starts at the first forecast hour still in the future, not
		// always at F01 — a run found via lookback can already be partway past.
		const startIndex = Math.max(0, firstFutureForecastIndex(runDate));

		if (debugFlag('future-radar')) {
			console.log(`FutureRadar: first future forecast hour is F${String(startIndex + 1).padStart(2, '0')} (index ${startIndex})`);
		}

		if (startIndex >= available) {
			if (debugFlag('verbose-failures')) {
				console.error(`FutureRadar: run ${runDate.toISOString()} has no forecast hours left in the future, the first future hour is index ${startIndex} but only ${available} are available`);
			}
			setHeadendRun(`${runLabel}, no future hours`);
			this.setStatus(STATUS.noData);
			return null;
		}

		const hourCount = Math.min(this.imageMax, available - startIndex);
		const canvases = buildFrames(chunks, window, hrrrProjection, radarFinalSize, startIndex, hourCount, user);

		if (debugFlag('future-radar')) {
			console.log(`FutureRadar: built ${canvases.length} frames F${String(startIndex + 1).padStart(2, '0')} to F${String(startIndex + canvases.length).padStart(2, '0')} (up to ${this.imageMax}), ${Math.round(performance.now() - started)} ms since the view was solved`);
		}

		// Forecast cubes start at F01, so frame index 0 is one hour after the run.
		return canvases.map((canvas, index) => ({
			canvas,
			timestamp: DateTime.fromJSDate(runDate).plus({ hours: startIndex + index + 1 }),
		}));
	}
}

// register display
registerDisplay(new FutureRadar(12, 'future-radar'));

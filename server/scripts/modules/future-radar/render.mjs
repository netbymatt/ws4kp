/**
 * Colour mapping and reprojection of a stitched field into ImageData.
 */

import { RENDER } from './config.mjs';
import { debugFlag } from '../utils/debug.mjs';
import { lonLatToGridIndex } from './grid.mjs';
import { PX, PY } from '../radar/constants.mjs';

/**
 * Reflectivity scale stops, in dBZ.
 * From 20 dBZ up, each colour is what the lookup in radar/filter-noise.mjs
 * outputs for the matching radar colour, so the render looks like the
 * post-processed composite. The original colour is kept in the trailing
 * comment. 5-15 dBZ stay as they were: the lookup would make them
 * transparent, but they are meant to show. 70 and 75 dBZ have no entry in the
 * lookup, so they are unchanged too.
 */
const DBZ_STOPS = [
	[5, [4, 233, 231]],
	[10, [1, 159, 244]],
	[15, [3, 0, 244]],
	[20, [49, 210, 22]], // was [2, 253, 2]
	[25, [0, 142, 0]], // was [1, 197, 1]
	[30, [20, 90, 15]], // was [0, 142, 0]
	[35, [10, 40, 10]], // was [253, 248, 2]
	[40, [196, 179, 70]], // was [229, 188, 0]
	[45, [190, 72, 19]], // was [253, 149, 0]
	[50, [171, 14, 14]], // was [253, 0, 0]
	[55, [171, 14, 14]], // was [212, 0, 0]
	[60, [115, 31, 4]], // was [188, 0, 0]
	[65, [115, 31, 4]], // was [248, 0, 253]
	[70, [152, 84, 198]],
	[75, [253, 253, 253]],
];
const LUT_MIN_DBZ = -35;
const LUT_MAX_DBZ = 85;

/**
 * Build a lookup table once, indexed by whole dBZ.
 *
 * Precomputing this matters: the alternative is running the stop search and
 * interpolation for every pixel of every frame, and the table is only a few
 * hundred entries.
 */
const buildColorTable = () => {
	const size = LUT_MAX_DBZ - LUT_MIN_DBZ + 1;
	const table = new Uint8ClampedArray(size * 4);

	for (let index = 0; index < size; index += 1) {
		const dbz = LUT_MIN_DBZ + index;
		const offset = index * 4;

		// Below the floor, leave RGBA at 0 — transparent.
		if (dbz >= RENDER.floorDbz) {
			// Find the bracketing stops.
			let lower = DBZ_STOPS[0];
			let upper = DBZ_STOPS[DBZ_STOPS.length - 1];

			for (let s = 0; s < DBZ_STOPS.length - 1; s += 1) {
				if (dbz >= DBZ_STOPS[s][0] && dbz <= DBZ_STOPS[s + 1][0]) {
					lower = DBZ_STOPS[s];
					upper = DBZ_STOPS[s + 1];
					break;
				}
			}

			const span = upper[0] - lower[0];
			const t = span === 0 ? 0 : (dbz - lower[0]) / span;

			table[offset] = lower[1][0] + (upper[1][0] - lower[1][0]) * t;
			table[offset + 1] = lower[1][1] + (upper[1][1] - lower[1][1]) * t;
			table[offset + 2] = lower[1][2] + (upper[1][2] - lower[1][2]) * t;
			table[offset + 3] = 255;
		}
	}

	return table;
};

const COLOR_TABLE = buildColorTable();

/**
 * Output pixels between exact projection samples along a row.
 *
 * Lambert Conformal maps a row of output pixels to a circular arc, not a
 * straight line, so interpolating a whole row at once is off by 1.4 cells and
 * lands 79% of pixels on the wrong cell. The error falls with the square of
 * the segment length: at 8 px it is 0.0002 cells (under a metre on a 3 km
 * grid) and 41 of 234,880 pixels round to a different cell than exact maths
 * gives. Set this to 1 for an exact map, at roughly 7x the build cost.
 */
const SAMPLE_STEP = 8;

/**
 * Precompute, for every output pixel, the index into the window's value array
 * that feeds it — or -1 where the pixel falls outside the fetched window.
 *
 * This is the whole reprojection, and it depends only on the view, never on
 * the data, so one map serves every forecast hour. The projection is built by
 * utils/map-projection.mjs, the same code that positions the base map tiles:
 * the image lands on exactly the same pixels as the base map, and the
 * north/south flip and any stretch fall out of the projection rather than
 * being applied by hand.
 *
 * Two facts about Mercator make a row cheap. A row of output pixels is a
 * single Mercator y, so latitude is constant along it, and x is a linear
 * function of longitude, so longitude runs exactly linearly with px. Two
 * inverse calls therefore fix the row exactly; only the Lambert Conformal step
 * still curves, and that is what SAMPLE_STEP interpolates across.
 */
const buildSampleMap = (window, projection, outputSize) => {
	const { width, height } = outputSize;
	const map = new Int32Array(width * height);

	for (let py = 0; py < height; py += 1) {
		const row = py * width;

		const [lonStart, lat] = projection.inverse([0.5, py + 0.5]);
		const [lonEnd] = projection.inverse([width - 0.5, py + 0.5]);
		const lonStep = (lonEnd - lonStart) / (width - 1);

		for (let x0 = 0; x0 < width; x0 += SAMPLE_STEP) {
			const x1 = Math.min(x0 + SAMPLE_STEP, width - 1);
			const start = lonLatToGridIndex(lonStart + x0 * lonStep, lat);
			const end = lonLatToGridIndex(lonStart + x1 * lonStep, lat);

			const span = (x1 - x0) || 1;
			const stepI = (end.i - start.i) / span;
			const stepJ = (end.j - start.j) / span;
			const limit = Math.min(x0 + SAMPLE_STEP, width);

			for (let px = x0; px < limit; px += 1) {
				const k = px - x0;
				const i = Math.round(start.i + k * stepI) - window.i0;
				const j = Math.round(start.j + k * stepJ) - window.j0;

				map[row + px] = i >= 0 && i < window.width && j >= 0 && j < window.height
					? j * window.width + i
					: -1;
			}
		}
	}

	return map;
};

const sampleMapCache = { key: null, map: null };

/**
 * The sample map for a view, rebuilt only when the view changes.
 *
 * Building it is tens of thousands of proj4 calls, and the view is normally
 * identical from one refresh to the next. The key covers the window as well
 * as the user's position: every entry is an offset into the window, so a map
 * built for a window of a different origin or width would read the wrong
 * cells.
 */
const getSampleMap = (window, projection, outputSize, user) => {
	const key = `${user[PX]}-${user[PY]}-${outputSize.width}x${outputSize.height}`
		+ `-${window.i0}-${window.j0}-${window.width}x${window.height}`;
	if (key !== sampleMapCache.key) {
		const started = performance.now();
		sampleMapCache.key = key;
		sampleMapCache.map = buildSampleMap(window, projection, outputSize);
		if (debugFlag('future-radar')) {
			console.log(`FutureRadar: sample map rebuilt in ${Math.round(performance.now() - started)} ms for ${key}`);
		}
	} else if (debugFlag('future-radar')) {
		console.log(`FutureRadar: sample map reused for ${key}`);
	}
	return sampleMapCache.map;
};

/**
 * Colour a stitched field into ImageData at the output pixels.
 *
 * This walks the *output* image, looking up each pixel's source cell in the
 * precomputed sample map (see buildSampleMap), so the reprojection itself
 * costs nothing per frame; only the colour lookup runs here.
 *
 * Pixels whose lon/lat falls outside the fetched window (should only happen at
 * the domain edge) are left transparent, same as missing/below-floor data.
 */
const fieldToImageData = (field, sampleMap, outputSize) => {
	const { width, height } = outputSize;
	const { values } = field;

	const image = new ImageData(width, height);
	const pixels = image.data;

	for (let p = 0; p < sampleMap.length; p += 1) {
		const source = sampleMap[p];

		if (source >= 0) {
			const value = values[source];

			if (Number.isFinite(value) && value > RENDER.missingBelowDbz) {
				const index = Math.round(value) - LUT_MIN_DBZ;

				if (index >= 0 && index < COLOR_TABLE.length / 4) {
					const from = index * 4;
					const to = p * 4;

					pixels[to] = COLOR_TABLE[from];
					pixels[to + 1] = COLOR_TABLE[from + 1];
					pixels[to + 2] = COLOR_TABLE[from + 2];
					pixels[to + 3] = COLOR_TABLE[from + 3];
				}
			}
		}
	}

	return image;
};

export {
	getSampleMap,
	fieldToImageData,
};

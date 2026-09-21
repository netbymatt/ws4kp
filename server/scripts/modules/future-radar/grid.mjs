/**
 * Grid window solving, chunk selection and assembly.
 *
 * Everything here works in "grid order", meaning row 0 is the SOUTHERNMOST row,
 * matching both the chunk numbering (0.0 is the south-west corner) and the
 * underlying HRRR array. The flip to screen order (north at top) happens once,
 * in the sample map built by render.mjs.
 */

import { GRID } from './config.mjs';

const toGrid = proj4('EPSG:4326', GRID.proj);

/* ------------------------------------------------------------------ *
 * Projection
 * ------------------------------------------------------------------ */

/**
 * Projected (metres) coordinates of native grid point (0, 0).
 * Derived from the grid's south-west corner lat/lon rather than hard-coding a
 * raw metre value, so the two cannot drift apart.
 */
const ORIGIN = (() => {
	const [x, y] = toGrid.forward(GRID.originLonLat);
	return { x, y };
})();

/** Convert a lat/lon to fractional native grid indices. */
const lonLatToGridIndex = (lon, lat) => {
	const [x, y] = toGrid.forward([lon, lat]);
	return {
		i: (x - ORIGIN.x) / GRID.cellSizeMeters,
		j: (y - ORIGIN.y) / GRID.cellSizeMeters,
	};
};

/* ------------------------------------------------------------------ *
 * Window solving
 * ------------------------------------------------------------------ */

/** How many segments to split each edge of the output map into when sampling. */
const EDGE_SAMPLES = 8;

/**
 * Sample points around the perimeter of the output map, in pixel coordinates.
 *
 * The native grid is Lambert Conformal, so the straight edges of the
 * (Mercator) output map map to curved lines on the native grid. Sampling only
 * the four corners could therefore miss the widest or tallest point of that
 * curve. Sampling along every edge is cheap — these are plain proj4
 * conversions — and removes the need to reason about which way the curvature
 * bows.
 */
const samplePerimeter = ({ width, height }) => {
	const points = [];

	for (let s = 0; s <= EDGE_SAMPLES; s += 1) {
		const t = s / EDGE_SAMPLES;
		points.push([width * t, 0], [width * t, height], [0, height * t], [width, height * t]);
	}

	return points;
};

/**
 * Work out the native grid window needed to fill a finished image.
 *
 * Inputs are what the host already has once its projection is built:
 *  - finalSize: { width, height } of the output map, in pixels
 *  - projection: the createProjection() result; its `inverse` turns output
 *    pixels back into lon/lat
 *
 * Output is a rectangle in native grid coordinates covering the whole output
 * map (including any letterboxed area the projection adds), with a one-cell
 * margin so nearest-neighbour sampling at the edges never reaches just past
 * the fetched window.
 *
 * The window is clamped to the model domain. A view that reaches outside
 * CONUS will therefore be clipped rather than producing an out-of-range read,
 * and `clippedToDomain` reports whether that happened so the caller can react.
 * `insideDomain` reports whether the centre of the output map — the user's
 * own location, after it has been clamped onto the base map — is inside the
 * model domain.
 */
const solveWindow = (finalSize, projection) => {
	const samples = samplePerimeter(finalSize).map((pixel) => {
		const [lon, lat] = projection.inverse(pixel);
		return lonLatToGridIndex(lon, lat);
	});

	const iValues = samples.map((p) => p.i);
	const jValues = samples.map((p) => p.j);

	const minI = Math.min(...iValues);
	const maxI = Math.max(...iValues);
	const minJ = Math.min(...jValues);
	const maxJ = Math.max(...jValues);

	const margin = 1;
	const requestedI0 = Math.floor(minI) - margin;
	const requestedJ0 = Math.floor(minJ) - margin;
	const requestedI1 = Math.ceil(maxI) + margin;
	const requestedJ1 = Math.ceil(maxJ) + margin;

	const i0 = Math.max(0, requestedI0);
	const j0 = Math.max(0, requestedJ0);
	const i1 = Math.min(GRID.nx, requestedI1);
	const j1 = Math.min(GRID.ny, requestedJ1);

	const width = Math.max(0, i1 - i0);
	const height = Math.max(0, j1 - j0);

	const [centerLon, centerLat] = projection.inverse([finalSize.width / 2, finalSize.height / 2]);
	const centerIndex = lonLatToGridIndex(centerLon, centerLat);

	return {
		i0,
		j0,
		width,
		height,
		clippedToDomain:
			i0 !== requestedI0 || j0 !== requestedJ0 || i1 !== requestedI1 || j1 !== requestedJ1,
		insideDomain:
			width > 0 && height > 0 && centerIndex.i >= 0 && centerIndex.i < GRID.nx
			&& centerIndex.j >= 0 && centerIndex.j < GRID.ny,
	};
};

/** The chunk IDs, in "row.col" form, that cover a window. */
const chunksForWindow = (window) => {
	const { chunkSize } = GRID;

	const minCol = Math.floor(window.i0 / chunkSize);
	const maxCol = Math.floor((window.i0 + window.width - 1) / chunkSize);
	const minRow = Math.floor(window.j0 / chunkSize);
	const maxRow = Math.floor((window.j0 + window.height - 1) / chunkSize);

	const chunkIds = [];
	for (let row = minRow; row <= maxRow; row += 1) {
		for (let col = minCol; col <= maxCol; col += 1) {
			chunkIds.push(`${row}.${col}`);
		}
	}

	return chunkIds;
};

/* ------------------------------------------------------------------ *
 * Assembly
 * ------------------------------------------------------------------ */

/** Parse "row.col" into numbers. */
const parseChunkId = (chunkId) => {
	const [row, col] = chunkId.split('.').map(Number);
	return { row, col };
};

/**
 * Assemble one forecast hour directly into the window.
 *
 * Stitching and cropping happen in a single pass: each chunk is intersected
 * with the window and only the overlapping part is copied. That avoids
 * building the full chunk block and then throwing most of it away, which
 * matters because a 3x2 block is 450x300 cells to fill a 320x155 window.
 */
const assembleWindow = (chunks, window, timeIndex) => {
	const { chunkSize } = GRID;
	const values = new Float32Array(window.width * window.height);

	// Mark everything missing up front, so gaps from a failed chunk read as
	// "no data" rather than as 0 dBZ.
	values.fill(NaN);

	chunks.forEach((chunk) => {
		const { row, col } = parseChunkId(chunk.chunkId);

		// This chunk's span in native grid coordinates.
		const chunkI0 = col * chunkSize;
		const chunkJ0 = row * chunkSize;

		// Intersection of chunk and window, in native grid coordinates.
		const startI = Math.max(window.i0, chunkI0);
		const endI = Math.min(window.i0 + window.width, chunkI0 + chunk.chunkX);
		const startJ = Math.max(window.j0, chunkJ0);
		const endJ = Math.min(window.j0 + window.height, chunkJ0 + chunk.chunkY);

		if (startI >= endI || startJ >= endJ) return;

		// Forecast cubes are (time, y, x); analysis is (y, x) with one step.
		const sliceStart = timeIndex * chunk.chunkY * chunk.chunkX;

		for (let j = startJ; j < endJ; j += 1) {
			const sourceRow = sliceStart + (j - chunkJ0) * chunk.chunkX - chunkI0;
			const targetRow = (j - window.j0) * window.width - window.i0;

			for (let i = startI; i < endI; i += 1) {
				values[targetRow + i] = chunk.values[sourceRow + i];
			}
		}
	});

	return { values, width: window.width, height: window.height };
};

export {
	lonLatToGridIndex,
	solveWindow,
	chunksForWindow,
	assembleWindow,
};

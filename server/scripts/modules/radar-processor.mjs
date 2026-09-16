import { filterRadarNoise, radarSourceXyFromLonLat, shiftPixelForUserGenerator } from './radar-utils.mjs';
import {
	RADAR_FULL_SIZE, RADAR_FINAL_SIZE, PX, PY,
} from './radar-constants.mjs';
import fetchImageBlob from './utils/fetch-image-blob.mjs';

const projectionCache = {
	key: null,
	rows: [],
};

// pre-compute the projection by providing pixel locations for each row
// and a y=mx+b regression for each column in the source row
// this removes the need to call proj4 for every pixel in the destination image
const projectRadar = (projection, user) => {
	const radarFinalSize = RADAR_FINAL_SIZE();
	const rows = [];

	const shiftPixelForUser = shiftPixelForUserGenerator(user);

	for (let y = 0; y < radarFinalSize.height; y += 1) {
		const lonLatLeft = projection.inverse(shiftPixelForUser([0, y]));
		const lonLatRight = projection.inverse(shiftPixelForUser([radarFinalSize.width - 1, y]));
		const sourcePxLeft = radarSourceXyFromLonLat(lonLatLeft);
		const sourcePxRight = radarSourceXyFromLonLat(lonLatRight);

		// calculate m, b for regression
		const m = (sourcePxRight[PX] - sourcePxLeft[PX]) / ((radarFinalSize.width - 1) - 0);
		const b = sourcePxRight[PX] - (m * (radarFinalSize.width - 1));

		// store the regression for this row
		// eslint-disable-next-line no-bitwise
		const xRegression = ((xSource) => (xSource * m) + b | 0);// faster than Math.floor();

		rows.push({
			// eslint-disable-next-line no-bitwise
			sourceY: sourcePxLeft[PY] | 0, // faster than Math.floor();
			xRegression,
			m,
			b,
		});
	}

	return rows;
};

// process a single radar image and place it on the provided canvas
const processRadar = async (data) => {
	const {
		url,
		RADAR_HOST,
		user,
		projection,
	} = data;
	const radarFinalSize = RADAR_FINAL_SIZE();

	// get the image
	const modifiedRadarUrl = OVERRIDES.RADAR_HOST ? url.replace(RADAR_HOST, OVERRIDES.RADAR_HOST) : url;
	const radarBlobPromise = fetchImageBlob(modifiedRadarUrl);

	// create radar context for destination image
	const sourceCanvas = document.createElement('canvas');
	sourceCanvas.width = RADAR_FULL_SIZE.width;
	sourceCanvas.height = RADAR_FULL_SIZE.height;
	const sourceCtx = sourceCanvas.getContext('2d');
	sourceCtx.imageSmoothingEnabled = false;

	// create the destination canvas
	const destCanvas = document.createElement('canvas');
	destCanvas.width = radarFinalSize.width;
	destCanvas.height = radarFinalSize.height;
	const destCtx = destCanvas.getContext('2d');
	destCtx.imageSmoothingEnabled = false;
	const destData = destCtx.createImageData(radarFinalSize.width, radarFinalSize.height);

	// calculate the cache key from unique values for how the radar is drawn
	const cacheKey = `${user[PX].toFixed(0)}-${user[PY].toFixed(0)}-${radarFinalSize.width}x${radarFinalSize.height}`;

	// see if the cache key matches and if not invalidate the cache
	if (cacheKey !== projectionCache.key) {
		projectionCache.key = cacheKey;
		projectionCache.rows = projectRadar(projection, user);
	}

	// get the blob
	const radarSourceBlob = await radarBlobPromise;

	// load radar into source canvas
	const radarSourceBitmap = await createImageBitmap(radarSourceBlob);
	// draw the entire image
	sourceCtx.drawImage(radarSourceBitmap, 0, 0, RADAR_FULL_SIZE.width, RADAR_FULL_SIZE.height);
	const sourceData = sourceCtx.getImageData(0, 0, RADAR_FULL_SIZE.width, RADAR_FULL_SIZE.height);

	// loop through all destination pixels and lookup and get the inverse projected source data pixel
	for (let y = 0; y < radarFinalSize.height; y += 1) {
		const row = projectionCache.rows[y]; // faster than Math.floor();
		for (let x = 0; x < radarFinalSize.width; x += 1) {
			// project the dest pixel location to the source location
			// eslint-disable-next-line no-bitwise
			const sourceCol = (x * row.m + row.b) | 0; // not using row.xRegression saves a function call and closure on each pixel

			const sourceIndex = ((row.sourceY * RADAR_FULL_SIZE.width) + sourceCol) * 4;
			const destIndex = ((y * radarFinalSize.width) + x) * 4;

			// pass through the noise removal function which also makes black transparent
			const {
				R, G, B, A,
			} = filterRadarNoise(
				sourceData.data[sourceIndex],
				sourceData.data[sourceIndex + 1],
				sourceData.data[sourceIndex + 2],
			);

			// copy 4 data points [r,g,b,a]
			destData.data[destIndex] = R;
			destData.data[destIndex + 1] = G;
			destData.data[destIndex + 2] = B;
			destData.data[destIndex + 3] = A;
		}
	}

	// final copy to dest canvas
	destCtx.putImageData(destData, 0, 0);

	return destCanvas.toDataURL();
};

export default processRadar;

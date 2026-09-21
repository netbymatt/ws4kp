import projectRadar from './projector.mjs';
import filterRadarNoise from './filter-noise.mjs';
import {
	RADAR_FULL_SIZE, RADAR_FINAL_SIZE, PX, PY,
} from './constants.mjs';
import createCanvas, { paintToCanvas } from '../utils/create-canvas.mjs';

const projectionCache = {
	key: null,
	rows: [],
};

// process a single radar image and place it on the provided canvas
const processRadar = async (data) => {
	const {
		user,
		projection,
		radarBlob,
	} = data;
	const radarFinalSize = RADAR_FINAL_SIZE();

	// get the image

	// create radar context for destination image
	const [, sourceCtx] = createCanvas(RADAR_FULL_SIZE);

	// create the destination image
	const destData = new ImageData(radarFinalSize.width, radarFinalSize.height);

	// calculate the cache key from unique values for how the radar is drawn
	const cacheKey = `${user[PX].toFixed(0)}-${user[PY].toFixed(0)}-${radarFinalSize.width}x${radarFinalSize.height}`;

	// see if the cache key matches and if not invalidate the cache
	if (cacheKey !== projectionCache.key) {
		projectionCache.key = cacheKey;
		projectionCache.rows = projectRadar(projection, user);
	}

	// load radar into source canvas
	const radarSourceBitmap = await createImageBitmap(radarBlob);
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

	// final copy to a dest canvas
	return paintToCanvas(destData);
};

export default processRadar;

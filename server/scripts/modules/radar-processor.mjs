import { removeDopplerRadarImageNoise, radarSourceXyFromLonLat, shiftPixelForUser } from './radar-utils.mjs';
import {
	RADAR_FULL_SIZE, RADAR_FINAL_SIZE, PX, PY,
} from './radar-constants.mjs';

// process a single radar image and place it on the provided canvas
const processRadar = async (data) => {
	const {
		url,
		RADAR_HOST,
		user,
		projection,
	} = data;

	// get the image
	const modifiedRadarUrl = OVERRIDES.RADAR_HOST ? url.replace(RADAR_HOST, OVERRIDES.RADAR_HOST) : url;
	const radarResponsePromise = fetch(modifiedRadarUrl);

	// create radar context for destination image
	const sourceCanvas = document.createElement('canvas');
	sourceCanvas.width = RADAR_FULL_SIZE.width;
	sourceCanvas.height = RADAR_FULL_SIZE.height;
	const sourceCtx = sourceCanvas.getContext('2d');
	sourceCtx.imageSmoothingEnabled = false;

	// test response
	const radarResponse = await radarResponsePromise;
	if (!radarResponse.ok) throw new Error(`Unable to fetch radar error ${radarResponse.status} ${radarResponse.statusText} from ${radarResponse.url}`);

	// get the blob
	const radarSourceBlob = await radarResponse.blob();

	// assign to an html image element
	const radarSourceBitmap = await createImageBitmap(radarSourceBlob);
	// draw the entire image
	sourceCtx.clearRect(0, 0, RADAR_FULL_SIZE.width, RADAR_FULL_SIZE.height);
	sourceCtx.drawImage(radarSourceBitmap, 0, 0, RADAR_FULL_SIZE.width, RADAR_FULL_SIZE.height);
	const sourceData = sourceCtx.getImageData(0, 0, RADAR_FULL_SIZE.width, RADAR_FULL_SIZE.height);

	const radarFinalSize = RADAR_FINAL_SIZE();

	// create the destination canvas
	const destCanvas = document.createElement('canvas');
	destCanvas.width = radarFinalSize.width;
	destCanvas.height = radarFinalSize.height;
	const destCtx = destCanvas.getContext('2d');
	destCtx.imageSmoothingEnabled = false;
	const destData = destCtx.createImageData(radarFinalSize.width, radarFinalSize.height);

	// loop through all destination pixels and lookup and get the inverse projected source data pixel
	for (let y = 0; y < radarFinalSize.height; y += 1) {
		for (let x = 0; x < radarFinalSize.width; x += 1) {
			// project the dest pixel location to the source location
			const lonLat = projection.inverse(shiftPixelForUser([x, y], user));
			const sourcePx = radarSourceXyFromLonLat(lonLat);

			// eslint-disable-next-line no-bitwise
			const sourceRow = sourcePx[PY] | 0; // faster than Math.floor();
			// eslint-disable-next-line no-bitwise
			const sourceCol = sourcePx[PX] | 0;

			const sourceIndex = ((sourceRow * RADAR_FULL_SIZE.width) + sourceCol) * 4;
			const destIndex = ((y * radarFinalSize.width) + x) * 4;

			// pass through the noise removal function which also makes black transparent
			const {
				R, G, B, A,
			} = removeDopplerRadarImageNoise(
				sourceData.data[sourceIndex],
				sourceData.data[sourceIndex + 1],
				sourceData.data[sourceIndex + 2],
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

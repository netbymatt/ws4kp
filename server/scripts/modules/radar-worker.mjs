import { removeDopplerRadarImageNoise } from './radar-utils.mjs';
import { RADAR_FULL_SIZE, RADAR_FINAL_SIZE } from './radar-constants.mjs';

onmessage = async (e) => {
	try {
		const {
			url, radarSourceXY, debug,
		} = e.data;

		if (debug) {
			console.log('[RADAR-WORKER] Message received at:', new Date().toISOString(), 'File:', url.split('/').pop());
		}

		// get the image (URL is already rewritten for caching by radar.mjs)
		const radarResponsePromise = fetch(url);

		// calculate offsets and sizes
		const radarSource = {
			width: 240,
			height: 163,
			x: Math.round(radarSourceXY.x / 2),
			y: Math.round(radarSourceXY.y / 2),
		};

		// create radar context for manipulation
		const radarCanvas = new OffscreenCanvas(RADAR_FULL_SIZE.width, RADAR_FULL_SIZE.height);
		const radarContext = radarCanvas.getContext('2d');
		if (!radarContext) {
			throw new Error('Failed to get radar canvas context');
		}

		radarContext.imageSmoothingEnabled = false;

		// test response
		const radarResponse = await radarResponsePromise;
		if (!radarResponse.ok) throw new Error(`Unable to fetch radar image: got ${radarResponse.status} ${radarResponse.statusText} from ${radarResponse.url}`);

		// get the blob
		const radarImgBlob = await radarResponse.blob();

		// assign to an html image element
		const radarImgElement = await createImageBitmap(radarImgBlob);
		// draw the entire image
		radarContext.clearRect(0, 0, RADAR_FULL_SIZE.width, RADAR_FULL_SIZE.height);
		radarContext.drawImage(radarImgElement, 0, 0, RADAR_FULL_SIZE.width, RADAR_FULL_SIZE.height);

		// crop the radar image without scaling
		const croppedRadarCanvas = new OffscreenCanvas(radarSource.width, radarSource.height);
		const croppedRadarContext = croppedRadarCanvas.getContext('2d');
		if (!croppedRadarContext) {
			throw new Error('Failed to get cropped radar canvas context');
		}

		croppedRadarContext.imageSmoothingEnabled = false;
		croppedRadarContext.drawImage(radarCanvas, radarSource.x, radarSource.y, croppedRadarCanvas.width, croppedRadarCanvas.height, 0, 0, croppedRadarCanvas.width, croppedRadarCanvas.height);

		// clean the image
		removeDopplerRadarImageNoise(croppedRadarContext);

		// stretch the radar image
		const stretchCanvas = new OffscreenCanvas(RADAR_FINAL_SIZE.width, RADAR_FINAL_SIZE.height);
		const stretchContext = stretchCanvas.getContext('2d', { willReadFrequently: true });
		if (!stretchContext) {
			throw new Error('Failed to get stretch canvas context');
		}

		stretchContext.imageSmoothingEnabled = false;
		stretchContext.drawImage(croppedRadarCanvas, 0, 0, radarSource.width, radarSource.height, 0, 0, RADAR_FINAL_SIZE.width, RADAR_FINAL_SIZE.height);

		const stretchedRadar = stretchCanvas.transferToImageBitmap();

		if (debug) {
			console.log('[RADAR-WORKER] Sending processed radar at:', new Date().toISOString(), 'Canvas size:', stretchCanvas.width, 'x', stretchCanvas.height, 'File:', url.split('/').pop());
		}

		postMessage(stretchedRadar, [stretchedRadar]);
	} catch (error) {
		console.warn('[RADAR-WORKER] Error at:', new Date().toISOString(), 'Error:', error.message);
		// Handle radar fetch errors by indicating failure to the main thread
		// This allows the radar display to set totalScreens = 0 and skip in animation
		postMessage({ error: true, message: error.message });
	}
};

import {
	radarFinalSize, radarFullSize, modTile, tileSize, removeDopplerRadarImageNoise, mapSizeToFinalSize,
} from './radar-utils.mjs';

onmessage = async (e) => {
	const {
		url, RADAR_HOST, OVERRIDES, radarSourceXY, sourceXY,
	} = e.data;

	// get the image
	const modifiedRadarUrl = OVERRIDES.RADAR_HOST ? url.replace(RADAR_HOST, OVERRIDES.RADAR_HOST) : url;
	const radarResponsePromise = fetch(modifiedRadarUrl);

	// calculate offsets and sizes
	const radarSource = {
		width: 240,
		height: 163,
		x: Math.round(radarSourceXY.x / 2),
		y: Math.round(radarSourceXY.y / 2),
	};

	// create radar context for manipulation
	const radarCanvas = new OffscreenCanvas(radarFullSize.width, radarFullSize.height);
	const radarContext = radarCanvas.getContext('2d');
	radarContext.imageSmoothingEnabled = false;

	// test response
	const radarResponse = await radarResponsePromise;
	if (!radarResponse.ok) throw new Error(`Unable to fetch radar error ${radarResponse.status} ${radarResponse.statusText} from ${radarResponse.url}`);

	// get the blob
	const radarImgBlob = await radarResponse.blob();

	// assign to an html image element
	const radarImgElement = await createImageBitmap(radarImgBlob);
	// draw the entire image
	radarContext.clearRect(0, 0, radarFullSize.width, radarFullSize.height);
	radarContext.drawImage(radarImgElement, 0, 0, radarFullSize.width, radarFullSize.height);

	// crop the radar image without scaling
	const croppedRadarCanvas = new OffscreenCanvas(radarSource.width, radarSource.height);
	const croppedRadarContext = croppedRadarCanvas.getContext('2d');
	croppedRadarContext.imageSmoothingEnabled = false;
	croppedRadarContext.drawImage(radarCanvas, radarSource.x, radarSource.y, croppedRadarCanvas.width, croppedRadarCanvas.height, 0, 0, croppedRadarCanvas.width, croppedRadarCanvas.height);

	// clean the image
	removeDopplerRadarImageNoise(croppedRadarContext);

	// stretch the radar image
	const stretchCanvas = new OffscreenCanvas(radarFinalSize.width, radarFinalSize.height);
	const stretchContext = stretchCanvas.getContext('2d', { willReadFrequently: true });
	stretchContext.imageSmoothingEnabled = false;
	stretchContext.drawImage(croppedRadarCanvas, 0, 0, radarSource.width, radarSource.height, 0, 0, radarFinalSize.width, radarFinalSize.height);

	const stretchedRadar = stretchCanvas.transferToImageBitmap();

	postMessage(stretchedRadar, [stretchedRadar]);
};

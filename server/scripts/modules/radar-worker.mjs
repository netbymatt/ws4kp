import * as utils from './radar-utils.mjs';

const fetchAsBlob = async (url) => {
	const response = await fetch(url);
	return response.blob();
};

onmessage = async (e) => {
	const baseMapImage = createImageBitmap(await fetchAsBlob('/images/maps/radar.webp'));

	const {
		url, index, RADAR_HOST, OVERRIDES, radarSourceXY, sourceXY, offsetX, offsetY,
	} = e.data;

	// calculate offsets and sizes
	const width = 2550;
	const height = 1600;
	const radarOffsetX = 120;
	const radarOffsetY = 70;
	const radarSourceX = Math.round(radarSourceXY.x / 2);
	const radarSourceY = Math.round(radarSourceXY.y / 2);

	// create destination context
	const baseCanvas = new OffscreenCanvas(640, 367);
	const baseContext = baseCanvas.getContext('2d', { alpha: false });
	baseContext.imageSmoothingEnabled = false;

	// create working context for manipulation
	const radarCanvas = new OffscreenCanvas(width, height);
	const radarContext = radarCanvas.getContext('2d', { alpha: false });
	radarContext.imageSmoothingEnabled = false;

	// get the image
	const modifiedUrl = OVERRIDES.RADAR_HOST ? url.replace(RADAR_HOST, OVERRIDES.RADAR_HOST) : url;
	console.time(`Radar-${index}-fetch`);
	const response = await fetch(modifiedUrl);
	console.timeEnd(`Radar-${index}-fetch`);

	// test response
	if (!response.ok) throw new Error(`Unable to fetch radar error ${response.status} ${response.statusText} from ${response.url}`);

	// get the blob
	console.time(`Radar-${index}-blob`);
	const radarImgBlob = await response.blob();
	console.timeEnd(`Radar-${index}-blob`);

	// assign to an html image element
	console.time(`Radar-${index}-loadimg-element`);
	const radarImgElement = await createImageBitmap(radarImgBlob);
	console.timeEnd(`Radar-${index}-loadimg-element`);
	// draw the entire image
	radarContext.clearRect(0, 0, width, 1600);
	console.time(`Radar-${index}-drawimage`);
	radarContext.drawImage(radarImgElement, 0, 0, width, 1600);
	console.timeEnd(`Radar-${index}-drawimage`);
	// get the base map
	console.time(`Radar-${index}-drawbasemap`);
	baseContext.drawImage(await baseMapImage, sourceXY.x, sourceXY.y, offsetX * 2, offsetY * 2, 0, 0, 640, 367);
	console.timeEnd(`Radar-${index}-drawbasemap`);
	// crop the radar image
	const cropCanvas = new OffscreenCanvas(640, 367);
	const cropContext = cropCanvas.getContext('2d', { willReadFrequently: true });
	cropContext.imageSmoothingEnabled = false;
	console.time(`Radar-${index}-copy-radar`);
	cropContext.drawImage(radarCanvas, radarSourceX, radarSourceY, (radarOffsetX * 2), Math.round(radarOffsetY * 2.33), 0, 0, 640, 367);
	console.timeEnd(`Radar-${index}-copy-radar`);
	// clean the image
	console.time(`Radar-${index}-clean-image`);
	utils.removeDopplerRadarImageNoise(cropContext);
	console.timeEnd(`Radar-${index}-clean-image`);

	// merge the radar and map
	console.time(`Radar-${index}-merge`);
	utils.mergeDopplerRadarImage(baseContext, cropContext);
	console.timeEnd(`Radar-${index}-merge`);

	const processedRadar = baseCanvas.transferToImageBitmap();

	postMessage(processedRadar, [processedRadar]);
};

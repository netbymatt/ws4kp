import * as utils from './radar-utils.mjs';

const radarFullSize = { width: 2550, height: 1600 };
const radarFinalSize = { width: 640, height: 367 };

const fetchAsBlob = async (url) => {
	const response = await fetch(url);
	return response.blob();
};

const baseMapImages = new Promise((resolve) => {
	fetchAsBlob('/images/maps/radar.webp').then((blob) => {
		createImageBitmap(blob).then((imageBitmap) => {
			// extract the black pixels to overlay on to the final image (boundaries)
			const canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
			const context = canvas.getContext('2d');
			context.drawImage(imageBitmap, 0, 0);
			const imageData = context.getImageData(0, 0, imageBitmap.width, imageBitmap.height);

			// go through the image data and preserve the black pixels, making the rest transparent
			for (let i = 0; i < imageData.data.length; i += 4) {
				if (imageData.data[i + 0] >= 116 || imageData.data[i + 1] >= 116 || imageData.data[i + 2] >= 116) {
					// make it transparent
					imageData.data[i + 3] = 0;
				}
			}
			// write the image data back
			context.putImageData(imageData, 0, 0);

			resolve({
				fullMap: imageBitmap,
				overlay: canvas,
			});
		});
	});
});

onmessage = async (e) => {
	const {
		url, RADAR_HOST, OVERRIDES, radarSourceXY, sourceXY, offsetX, offsetY,
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

	// create destination context
	const baseCanvas = new OffscreenCanvas(radarFinalSize.width, radarFinalSize.height);
	const baseContext = baseCanvas.getContext('2d');
	baseContext.imageSmoothingEnabled = false;

	// create working context for manipulation
	const radarCanvas = new OffscreenCanvas(radarFullSize.width, radarFullSize.height);
	const radarContext = radarCanvas.getContext('2d');
	radarContext.imageSmoothingEnabled = false;

	// get the base map
	const baseMaps = await baseMapImages;
	baseContext.drawImage(baseMaps.fullMap, sourceXY.x, sourceXY.y, offsetX * 2, offsetY * 2, 0, 0, radarFinalSize.width, radarFinalSize.height);

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
	utils.removeDopplerRadarImageNoise(croppedRadarContext);

	// stretch the radar image
	const stretchCanvas = new OffscreenCanvas(radarFinalSize.width, radarFinalSize.height);
	const stretchContext = stretchCanvas.getContext('2d', { willReadFrequently: true });
	stretchContext.imageSmoothingEnabled = false;
	stretchContext.drawImage(croppedRadarCanvas, 0, 0, radarSource.width, radarSource.height, 0, 0, radarFinalSize.width, radarFinalSize.height);

	// put the radar on the base map
	baseContext.drawImage(stretchCanvas, 0, 0);
	// put the road/boundaries overlay on the map
	baseContext.drawImage(baseMaps.overlay, sourceXY.x, sourceXY.y, offsetX * 2, offsetY * 2, 0, 0, radarFinalSize.width, radarFinalSize.height);

	const processedRadar = baseCanvas.transferToImageBitmap();

	postMessage(processedRadar, [processedRadar]);
};

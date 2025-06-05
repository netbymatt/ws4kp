import {
	radarFinalSize, radarFullSize, pixelToFile, modTile, tileSize, removeDopplerRadarImageNoise, mapSizeToFinalSize,
} from './radar-utils.mjs';

const fetchAsBlob = async (url) => {
	const response = await fetch(url);
	return response.blob();
};

const baseMapImages = (tile) => new Promise((resolve) => {
	if (tile === false) resolve(false);
	fetchAsBlob(`/images/maps/radar-tiles/${tile}.webp`).then((blob) => {
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
				base: imageBitmap,
				overlay: canvas,
			});
		});
	});
});

const drawOnBasemap = (baseContext, drawImage, positions) => {
	baseContext.drawImage(drawImage, positions.sx, positions.sy, positions.sw, positions.sh, positions.dx, positions.dy, positions.dw, positions.dh);
};

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

	// determine the basemap images needed
	const baseMapTiles = [
		pixelToFile(sourceXY.x, sourceXY.y),
		pixelToFile(sourceXY.x + offsetX * 2, sourceXY.y),
		pixelToFile(sourceXY.x, sourceXY.y + offsetY * 2),
		pixelToFile(sourceXY.x + offsetX * 2, sourceXY.y + offsetY * 2),
	];

	// get the base maps
	const baseMapsPromise = Promise.allSettled(baseMapTiles.map(baseMapImages));

	// do some more calculations for assembling the tiles
	// the tiles are arranged as follows, with the horizontal axis as x, and correlating with the second set of digits in the image file number
	// T[0] T[1]
	// T[2] T[3]
	// tile 0 gets special treatment, it's placement is the basis for all downstream calculations
	const t0Source = modTile(sourceXY.x, sourceXY.y);
	const t0Width = tileSize.x - t0Source.x;
	const t0Height = tileSize.y - t0Source.y;
	const t0FinalSize = mapSizeToFinalSize(t0Width, t0Height);

	// these will all be used again for the overlay, calculate them once here
	const mapCoordinates = [];
	// t[0]
	mapCoordinates.push({
		sx: t0Source.x,
		sw: t0Width,
		dx: 0,
		dw: t0FinalSize.x,

		sy: t0Source.y,
		sh: t0Height,
		dy: 0,
		dh: t0FinalSize.y,
	});
	// t[1]
	mapCoordinates.push({
		sx: 0,
		sw: tileSize.x - t0Width,
		dx: t0FinalSize.x,
		dw: mapSizeToFinalSize(tileSize.x - t0Width, 0).x,

		sy: t0Source.y,
		sh: t0Height,
		dy: 0,
		dh: t0FinalSize.y,
	});
	// t[2]
	mapCoordinates.push({
		sx: t0Source.x,
		sw: t0Width,
		dx: 0,
		dw: t0FinalSize.x,

		sy: 0,
		sh: tileSize.y - t0Height,
		dy: t0FinalSize.y,
		dh: mapSizeToFinalSize(0, tileSize.y - t0Height).y,
	});
	// t[3]
	mapCoordinates.push({
		sx: 0,
		sw: tileSize.x - t0Width,
		dx: t0FinalSize.x,
		dw: mapSizeToFinalSize(tileSize.x - t0Width, 0).x,

		sy: 0,
		sh: tileSize.y - t0Height,
		dy: t0FinalSize.y,
		dh: mapSizeToFinalSize(0, tileSize.y - t0Height).y,
	});

	// wait for the basemaps to arrive
	const baseMaps = (await baseMapsPromise).map((map) => map.value ?? false);

	// draw each tile if needed
	drawOnBasemap(baseContext, baseMaps[0].base, mapCoordinates[0]);
	if (mapCoordinates[1].dx < radarFinalSize.width && baseMaps[1]) {
		drawOnBasemap(baseContext, baseMaps[1].base, mapCoordinates[1]);
	}
	if (mapCoordinates[2].dy < radarFinalSize.height && baseMaps[2]) {
		drawOnBasemap(baseContext, baseMaps[2].base, mapCoordinates[2]);
		if (mapCoordinates[1].dx < radarFinalSize.width && baseMaps[3]) {
			drawOnBasemap(baseContext, baseMaps[3].base, mapCoordinates[3]);
		}
	}
	// baseContext.drawImage(baseMaps.fullMap, sourceXY.x, sourceXY.y, offsetX * 2, offsetY * 2, 0, 0, radarFinalSize.width, radarFinalSize.height);

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

	// put the radar on the base map
	baseContext.drawImage(stretchCanvas, 0, 0);
	// put the road/boundaries overlay on the map as needed
	drawOnBasemap(baseContext, baseMaps[0].overlay, mapCoordinates[0]);
	if (mapCoordinates[1].dx < radarFinalSize.width && baseMaps[1]) {
		drawOnBasemap(baseContext, baseMaps[1].overlay, mapCoordinates[1]);
	}
	if (mapCoordinates[2].dy < radarFinalSize.height && baseMaps[2]) {
		drawOnBasemap(baseContext, baseMaps[2].overlay, mapCoordinates[2]);
		if (mapCoordinates[1].dx < radarFinalSize.width && baseMaps[3]) {
			drawOnBasemap(baseContext, baseMaps[3].overlay, mapCoordinates[3]);
		}
	}

	const processedRadar = baseCanvas.transferToImageBitmap();

	postMessage(processedRadar, [processedRadar]);
};

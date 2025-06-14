import {
	radarFinalSize, pixelToFile, modTile, tileSize, mapSizeToFinalSize, fetchAsBlob,
} from './radar-utils.mjs';

// creates the radar background map image and overlay transparency
// which remain fixed on the page as the radar image changes in layered divs
// it returns 4 ImageBitmaps that represent the base map, and 4 ImageBitmaps that are the overlay
// the main thread pushes these ImageBitmaps into the image placeholders on the page

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
				overlay: canvas.transferToImageBitmap(),
			});
		});
	});
});

onmessage = async (e) => {
	const {
		sourceXY, offsetX, offsetY,
	} = e.data;

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

	// build the response
	const t0Base = baseMaps[0].base;
	const t0Overlay = baseMaps[0].overlay;
	let t1Base; let t1Overlay; let t2Base; let t2Overlay; let t3Base; let t3Overlay;
	if (mapCoordinates[1].dx < radarFinalSize.width && baseMaps[1]) {
		t1Base = baseMaps[1].base;
		t1Overlay = baseMaps[1].overlay;
	}
	if (mapCoordinates[2].dy < radarFinalSize.height && baseMaps[2]) {
		t2Base = baseMaps[2].base;
		t2Overlay = baseMaps[2].overlay;
		if (mapCoordinates[1].dx < radarFinalSize.width && baseMaps[3]) {
			t3Base = baseMaps[3].base;
			t3Overlay = baseMaps[3].overlay;
		}
	}
	// baseContext.drawImage(baseMaps.fullMap, sourceXY.x, sourceXY.y, offsetX * 2, offsetY * 2, 0, 0, radarFinalSize.width, radarFinalSize.height);

	postMessage({
		t0Base, t0Overlay, t1Base, t1Overlay, t2Base, t2Overlay, t3Base, t3Overlay,
	}, [t0Base, t0Overlay, t1Base, t1Overlay, t2Base, t2Overlay, t3Base, t3Overlay]);
};

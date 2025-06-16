import { RADAR_FINAL_SIZE, TILE_SIZE, TILE_COUNT } from './radar-constants.mjs';
import { elemForEach } from './utils/elem.mjs';

// convert a pixel location to a file/tile combination
const pixelToFile = (xPixel, yPixel) => {
	const xTile = Math.floor(xPixel / TILE_SIZE.x);
	const yTile = Math.floor(yPixel / TILE_SIZE.y);
	if (xTile < 0 || xTile > TILE_COUNT.x || yTile < 0 || yTile > TILE_COUNT.y) return false;
	return `${yTile}-${xTile}`;
};

// convert a pixel location in the overall map to a pixel location on the tile
const modTile = (xPixel, yPixel) => {
	const x = Math.round(xPixel) % TILE_SIZE.x;
	const y = Math.round(yPixel) % TILE_SIZE.y;
	return { x, y };
};

// creates the radar background map image and overlay transparency
// which remain fixed on the page as the radar image changes in layered divs
// it returns 4 ImageBitmaps that represent the base map, and 4 ImageBitmaps that are the overlay
// the main thread pushes these ImageBitmaps into the image placeholders on the page
const setTiles = (data) => {
	const {
		sourceXY,
		elemId,
	} = data;
	const elemIdFull = `${elemId}-html`;

	// determine the basemap images needed
	const baseMapTiles = [
		pixelToFile(sourceXY.x, sourceXY.y),
		pixelToFile(sourceXY.x + TILE_SIZE.x, sourceXY.y),
		pixelToFile(sourceXY.x, sourceXY.y + TILE_SIZE.y),
		pixelToFile(sourceXY.x + TILE_SIZE.x, sourceXY.y + TILE_SIZE.y),
	];

	// do some calculations
	// the tiles are arranged as follows, with the horizontal axis as x, and correlating with the second set of digits in the image file number
	// T[0] T[1]
	// T[2] T[3]
	// tile 0 gets special treatment, it's placement is the basis for all downstream calculations
	const t0Source = modTile(sourceXY.x, sourceXY.y);
	const t0Width = TILE_SIZE.x - t0Source.x;
	const t0Height = TILE_SIZE.y - t0Source.y;
	const t0FinalSize = { x: t0Width, y: t0Height };

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
		sw: TILE_SIZE.x - t0Width,
		dx: t0FinalSize.x,
		dw: TILE_SIZE.x - t0Width,

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
		sh: TILE_SIZE.y - t0Height,
		dy: t0FinalSize.y,
		dh: TILE_SIZE.y - t0Height,
	});
	// t[3]
	mapCoordinates.push({
		sx: 0,
		sw: TILE_SIZE.x - t0Width,
		dx: t0FinalSize.x,
		dw: TILE_SIZE.x - t0Width,

		sy: 0,
		sh: TILE_SIZE.y - t0Height,
		dy: t0FinalSize.y,
		dh: TILE_SIZE.y - t0Height,
	});

	// determine which tiles are used
	const usedTiles = [
		true,
		mapCoordinates[1].dx < RADAR_FINAL_SIZE.width,
		mapCoordinates[2].dy < RADAR_FINAL_SIZE.height,
		mapCoordinates[2].dy < RADAR_FINAL_SIZE.height && mapCoordinates[1].dx < RADAR_FINAL_SIZE.width,
	];

	// helper function for populating tiles
	const populateTile = (tileName) => (elem, index) => {
		// check if the tile is used
		if (!usedTiles[index]) return;

		// set the image source and size
		elem.src = `/images/maps/radar/${tileName}-${baseMapTiles[index]}.webp`;
		elem.width = TILE_SIZE.x;
		elem.height = TILE_SIZE.y;
	};

	// populate the map and overlay tiles
	// fill the tiles with the map
	elemForEach(`#${elemIdFull} .map-tiles img`, populateTile('map'));
	elemForEach(`#${elemIdFull} .overlay-tiles img`, populateTile('overlay'));

	// fill the tiles with the overlay
	// shift the map tile containers
	const tileShift = modTile(sourceXY.x, sourceXY.y);
	const mapTileContainer = document.querySelector(`#${elemIdFull} .map-tiles`);
	mapTileContainer.style.top = `${-tileShift.y}px`;
	mapTileContainer.style.left = `${-tileShift.x}px`;
	// and the same for the overlay
	const overlayTileContainer = document.querySelector(`#${elemIdFull} .overlay-tiles`);
	overlayTileContainer.style.top = `${-tileShift.y}px`;
	overlayTileContainer.style.left = `${-tileShift.x}px`;

	// return some useful data
	return {
		usedTiles,
		baseMapTiles,
	};
};

export default setTiles;

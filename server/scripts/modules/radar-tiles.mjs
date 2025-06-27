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

	// calculate the shift of tile 0 (upper left)
	const tileShift = modTile(sourceXY.x, sourceXY.y);

	// determine which tiles are used
	const usedTiles = [
		true,
		TILE_SIZE.x - tileShift.x < RADAR_FINAL_SIZE.width,
		TILE_SIZE.y - tileShift.y < RADAR_FINAL_SIZE.width,
	];
	// if we need t[1] and t[2] then we also need t[3]
	usedTiles.push(usedTiles[1] && usedTiles[2]);

	// helper function for populating tiles
	const populateTile = (tileName) => (elem, index) => {
		// always set the size to flow the images correctly
		elem.width = TILE_SIZE.x;
		elem.height = TILE_SIZE.y;

		// check if the tile is used
		if (!usedTiles[index]) {
			elem.src = '';
			return;
		}

		// set the image source and size
		const newSource = `/images/maps/radar/${tileName}-${baseMapTiles[index]}.webp`;
		if (elem.src === newSource) return;
		elem.src = newSource;
	};

	// populate the map and overlay tiles
	// fill the tiles with the map
	elemForEach(`#${elemIdFull} .map-tiles img`, populateTile('map'));
	elemForEach(`#${elemIdFull} .overlay-tiles img`, populateTile('overlay'));

	// fill the tiles with the overlay
	// shift the map tile containers
	const mapTileContainer = document.querySelector(`#${elemIdFull} .map-tiles`);
	mapTileContainer.style.top = `${-tileShift.y}px`;
	mapTileContainer.style.left = `${-tileShift.x}px`;
	// and the same for the overlay
	const overlayTileContainer = document.querySelector(`#${elemIdFull} .overlay-tiles`);
	overlayTileContainer.style.top = `${-tileShift.y}px`;
	overlayTileContainer.style.left = `${-tileShift.x}px`;
};

export default setTiles;

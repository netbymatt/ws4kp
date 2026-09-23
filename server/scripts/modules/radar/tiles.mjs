import {
	RADAR_FINAL_SIZE, TILE_SIZE, TILE_COUNT, PX, PY, TILE_GRID,
} from './constants.mjs';
import elemForEach from '../utils/elem-for-each.mjs';
import { debugFlag } from '../utils/debug.mjs';
import { shiftPixelForUserGenerator } from './positions.mjs';

// convert a pixel location to a file/tile combination
const pixelToFile = (xPixel, yPixel) => {
	const xTile = Math.floor(xPixel / TILE_SIZE.x);
	const yTile = Math.floor(yPixel / TILE_SIZE.y);
	if (xTile < 0 || xTile >= TILE_COUNT.x || yTile < 0 || yTile >= TILE_COUNT.y) return false;
	return `${xTile.toString().padStart(2, '0')}-${yTile.toString().padStart(2, '0')}`;
};

// create the tile placeholders on first run and size the container to hold TILE_GRID.x of them
// per row, so neither the markup nor the stylesheet has to match the grid
const fillContainer = (container, count) => {
	container.style.width = `${TILE_GRID.x * TILE_SIZE.x}px`;
	while (container.children.length < count) {
		container.append(document.createElement('img'));
	}
};

// convert a pixel location in the overall map to a pixel location on the tile set
const modTile = (xPixel, yPixel) => {
	// adjust for additional 1 tile when odd
	const x = (Math.floor(xPixel) % (TILE_SIZE.x));
	const y = (Math.floor(yPixel) % (TILE_SIZE.y));

	return { x, y };
};

// sets the radar background map image and overlay transparency
// which remain fixed on the page as the radar image changes in layered divs
// the images that make up the map are placed in the <img> placeholders on the page, and the
// containers holding them are shifted to center the map on the user
const setTiles = (data) => {
	const {
		user,
		elemId,
	} = data;
	const elemIdFull = `${elemId}-html`;

	// shift the working location to the top-left corner to center the resulting map on the user
	const shiftPixelForUser = shiftPixelForUserGenerator(user);
	const topLeft = shiftPixelForUser([0, 0]);

	// calculate the shift of tile 0 (upper left)
	const tileShift = modTile(topLeft[PX], topLeft[PY]);
	const finalSize = RADAR_FINAL_SIZE();

	// the tiles are laid out row by row, left to right, matching the order of the <img>
	// placeholders on the page:
	// T[0] T[1] T[2]
	// T[3] T[4] T[5]
	// ...and so on for TILE_GRID.y rows
	//
	// a tile is used when its leading edge falls inside the visible area once the container has
	// been shifted by tileShift; the first row and column always qualify because the shift is
	// never more than one tile
	const tiles = Array.from({ length: TILE_GRID.x * TILE_GRID.y }, (value, index) => {
		const col = index % TILE_GRID.x;
		const row = Math.floor(index / TILE_GRID.x);
		return {
			file: pixelToFile(topLeft[PX] + TILE_SIZE.x * col, topLeft[PY] + TILE_SIZE.y * row),
			used: (TILE_SIZE.x * col) - tileShift.x < finalSize.width
				&& (TILE_SIZE.y * row) - tileShift.y < finalSize.height,
		};
	});

	if (debugFlag(elemId)) {
		const used = tiles.filter((tile) => tile.used).map((tile) => tile.file);
		console.log(`Radar tiles (${elemId}): top-left map pixel ${topLeft.map(Math.round).join(',')}, shifted ${tileShift.x},${tileShift.y}, using ${used.length} of ${tiles.length} tiles [${used.join(', ')}]`);
	}

	// helper function for populating tiles
	const populateTile = (tileName) => (elem, index) => {
		const tile = tiles[index];

		// always set the size to flow the images correctly
		elem.width = TILE_SIZE.x;
		elem.height = TILE_SIZE.y;

		// check if the tile is used, this also covers any placeholder beyond the tile grid
		if (!tile?.used) {
			elem.removeAttribute('src');
			return;
		}

		if (!tile.file && debugFlag('verbose-failures')) {
			console.warn(`Radar tiles (${elemId}): tile ${index} is outside the ${TILE_COUNT.x}x${TILE_COUNT.y} map, its ${tileName} image will not load`);
		}

		// set the image source and size
		// compare the attribute, not elem.src, which reports a fully qualified url and would
		// never match the relative path below
		const newSource = `/images/maps/radar-conus/${tileName}/${tile.file}.webp`;
		if (elem.getAttribute('src') === newSource) return;
		elem.src = newSource;
	};

	// make sure both containers have a placeholder for every tile in the grid
	const mapTileContainer = document.querySelector(`#${elemIdFull} .map-tiles`);
	const overlayTileContainer = document.querySelector(`#${elemIdFull} .overlay-tiles`);
	fillContainer(mapTileContainer, tiles.length);
	fillContainer(overlayTileContainer, tiles.length);

	// fill the tiles with the map and the overlay
	elemForEach(`#${elemIdFull} .map-tiles img`, populateTile('base'));
	elemForEach(`#${elemIdFull} .overlay-tiles img`, populateTile('overlay'));

	// shift the map tile container
	mapTileContainer.style.top = `${-tileShift.y}px`;
	mapTileContainer.style.left = `${-tileShift.x}px`;
	// and the same for the overlay
	overlayTileContainer.style.top = `${-tileShift.y}px`;
	overlayTileContainer.style.left = `${-tileShift.x}px`;
};

export default setTiles;

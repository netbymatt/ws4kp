import settings from './settings.mjs';
import createProjection, { OUTPUTSIZES } from './utils/map-projection.mjs';

const radarFinalSize = () => {
	const size = {
		width: 640, height: 367,
	};
	if (settings.enhanced?.value) {
		if (settings.wide?.value) {
			size.width = 854;
		}
		if (settings.portrait?.value) {
			size.height = 1024;
		}
	}
	return size;
};

const radarOffset = () => {
	const offset = {
		x: 240,
		y: 138,
	};
	if (settings.enhanced?.value) {
		if (settings.wide?.value) {
			// 107 is the margins shift, 640/854 is the scaling factor normal => wide, /2 is because of the fixed 2:1 scaling between source radar and map tiles
			offset.x = 240 + ((107 * 640) / 854 / 2); // original size of 640 scaled up to wide at 854;
		}
		if (settings.portrait?.value) {
			// 825 is the margins shift, 367/1024 is the scaling factor normal => portrait, /2 is because of the fixed 2:1 scaling between source radar and map tiles
			offset.y = 138 + ((815 * 367) / 1024 / 2);
		}
	}

	return offset;
};

// shift the base coordinates to align with enhanced radar window sizes
const radarShift = () => {
	const shift = {
		x: 0,
		y: 0,
	};
	if (settings.enhanced?.value) {
		if (settings.wide?.value) {
			shift.x = 107;
		}
		if (settings.portrait?.value) {
			shift.y = 328;
		}
	}
	return shift;
};

// from https://mesonet.agron.iastate.edu/archive/data/yyyy/mm/dd/GIS/uscomp/n0r_yyyymmddhhmm.wld
export const WORLD_TRANSFORM = {
	A: 0.01,
	D: 0.0,
	B: 0.0,
	E: -0.01,
	C: -126.0,
	F: 50,
};

// array indices for reference
export const PX = 0;
export const PY = 1;
export const LAT = 1;
export const LON = 0;

export const TILE_SIZE = { x: 510, y: 320 };
export const TILE_COUNT = { x: 10, y: 10 };
export const TILE_FULL_SIZE = OUTPUTSIZES;
export const RADAR_FULL_SIZE = { width: 6000, height: 2600 };
export const RADAR_FINAL_SIZE = radarFinalSize;
export const RADAR_OFFSET = radarOffset;
export const RADAR_SHIFT = radarShift;

import settings from '../settings.mjs';
import { OUTPUTSIZES } from '../utils/map-projection.mjs';

// the view for each display mode, and the largest of them, which sets the tile grid
const FINAL_SIZES = {
	standard: { width: 640, height: 367 },
	wide: { width: 854, height: 367 },
	portrait: { width: 640, height: 1024 },
};

// a copy is returned so callers can not modify the sizes above
const radarFinalSize = () => {
	if (settings.enhanced?.value) {
		if (settings.wide?.value) return { ...FINAL_SIZES.wide };
		if (settings.portrait?.value) return { ...FINAL_SIZES.portrait };
	}
	return { ...FINAL_SIZES.standard };
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

export const TILE_SIZE = { x: 510, y: 320 };

// enough tiles to cover the largest view, plus one row and column for the shift that centres
// the user's location within tile 0
export const TILE_GRID = {
	x: Math.ceil(Math.max(...Object.values(FINAL_SIZES).map((size) => size.width)) / TILE_SIZE.x) + 1,
	y: Math.ceil(Math.max(...Object.values(FINAL_SIZES).map((size) => size.height)) / TILE_SIZE.y) + 1,
};

// overridable radar host
export const RADAR_HOST = 'mesonet.agron.iastate.edu';

// array indices for reference
export const PX = 0;
export const PY = 1;

export const TILE_COUNT = { x: 10, y: 10 };
export const TILE_FULL_SIZE = OUTPUTSIZES['radar-conus'];
export const RADAR_FULL_SIZE = { width: 6000, height: 2600 };
export const RADAR_FINAL_SIZE = radarFinalSize;

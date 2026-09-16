import settings from '../settings.mjs';
import { OUTPUTSIZES } from '../utils/map-projection.mjs';

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

// from https://mesonet.agron.iastate.edu/archive/data/yyyy/mm/dd/GIS/uscomp/n0r_yyyymmddhhmm.wld
export const WORLD_TRANSFORM = {
	A: 0.01,
	D: 0.0,
	B: 0.0,
	E: -0.01,
	C: -126.0,
	F: 50,
};

// overridable radar host
export const RADAR_HOST = 'mesonet.agron.iastate.edu';

// array indices for reference
export const PX = 0;
export const PY = 1;

export const TILE_SIZE = { x: 510, y: 320 };
export const TILE_COUNT = { x: 10, y: 10 };
export const TILE_FULL_SIZE = OUTPUTSIZES['radar-conus'];
export const RADAR_FULL_SIZE = { width: 6000, height: 2600 };
export const RADAR_FINAL_SIZE = radarFinalSize;

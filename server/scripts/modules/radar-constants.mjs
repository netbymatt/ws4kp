import settings from './settings.mjs';

const radarFinalSize = () => {
	const size = {
		width: 640, height: 367,
	};
	if (settings.wide?.value && settings.enhancedScreens?.value) {
		size.width = 854;
	}
	return size;
};

const radarSourceSize = () => {
	const size = {
		width: 240,
		height: 163,
	};
	if (settings.wide?.value && settings.enhancedScreens?.value) {
		size.width = 240 / 640 * 854; // original size of 640 scaled up to wide at 854
	}
	return size;
};

const radarOffset = () => {
	const offset = {
		x: 240,
		y: 138,
	};
	if (settings.wide?.value && settings.enhancedScreens?.value) {
		// 107 is the margins shift, 640/854 is the scaling factor normal => wide, /2 is because of the fixed 2:1 scaling between source radar and map tiles
		offset.x = 240 + (107 * 640 / 854 / 2); // original size of 640 scaled up to wide at 854;
	}

	return offset;
};

// shift the base coordinates to align with enhanced radar window sizes
const radarShift = () => {
	const shift = {
		x: 0,
		y: 0,
	};
	if (settings.wide?.value && settings.enhancedScreens?.value) {
		shift.x = 107;
	}
	return shift;
};

export const TILE_SIZE = { x: 680, y: 387 };
export const TILE_COUNT = { x: 10, y: 11 };
export const TILE_FULL_SIZE = { x: 6800, y: 4255 };
export const RADAR_FULL_SIZE = { width: 2550, height: 1600 };
export const RADAR_FINAL_SIZE = radarFinalSize;
export const RADAR_SOURCE_SIZE = radarSourceSize;
export const RADAR_OFFSET = radarOffset;
export const RADAR_SHIFT = radarShift;

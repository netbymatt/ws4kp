import {
	TILE_SIZE, TILE_FULL_SIZE, RADAR_OFFSET, RADAR_SHIFT, WORLD_TRANSFORM, RADAR_FINAL_SIZE, PX, PY,
} from './radar-constants.mjs';

// limit a value to within a range
const coerce = (low, value, high) => Math.max(Math.min(value, high), low);

const getXYFromLatitudeLongitudeMap = (pos) => {
	// source values for conversion
	// px		py		lon						lat
	// 589	466		-122.3615246	47.63177832
	// 5288	3638	-80.18297384	25.77018996

	// map position is calculated as a regresion from the above values (+/- a manual adjustment factor) and shifting for enhanced views
	// then shifted by half of the tile size (to center the map)
	// then they are limited to values between 0 and the width or height of the map
	const y = coerce(0, (-145.095 * pos.latitude + 7377.117) - 27 - (TILE_SIZE.y / 2) - RADAR_SHIFT().y, TILE_FULL_SIZE.y - (TILE_SIZE.y));
	const x = coerce(0, (111.407 * pos.longitude + 14220.972) + 4 - (TILE_SIZE.x / 2) - RADAR_SHIFT().x, TILE_FULL_SIZE.x - (TILE_SIZE.x));

	return { x, y };
};

const getXYFromLatitudeLongitudeDoppler = (pos) => {
	const imgHeight = 6000;
	const imgWidth = 2800;

	// map position is calculated as a regresion
	// then shifted by half of the tile size (to center the map)
	// then they are limited to values between 0 and the width or height of the map

	const y = coerce(0, (51 - pos.latitude) * 61.4481 - RADAR_OFFSET().y, imgHeight);
	const x = coerce(0, ((-129.138 - pos.longitude) * 42.1768) * -1 - RADAR_OFFSET().x, imgWidth);

	return { x: x * 2, y: y * 2 };
};

/* eslint-disable no-param-reassign */
const removeDopplerRadarImageNoise = (R, G, B, A) => {
	// is this pixel the old rgb?
	if ((R === 0 && G === 0 && B === 0)
		|| (R === 0 && G === 236 && B === 236)
		|| (R === 1 && G === 160 && B === 246)
		|| (R === 0 && G === 0 && B === 246)) {
		// change to your new rgb

		// Transparent
		R = 0;
		G = 0;
		B = 0;
		A = 0;
	} else if ((R === 0 && G === 255 && B === 0)) {
		// Light Green 1
		R = 49;
		G = 210;
		B = 22;
		A = 255;
	} else if ((R === 0 && G === 200 && B === 0)) {
		// Light Green 2
		R = 0;
		G = 142;
		B = 0;
		A = 255;
	} else if ((R === 0 && G === 144 && B === 0)) {
		// Dark Green 1
		R = 20;
		G = 90;
		B = 15;
		A = 255;
	} else if ((R === 255 && G === 255 && B === 0)) {
		// Dark Green 2
		R = 10;
		G = 40;
		B = 10;
		A = 255;
	} else if ((R === 231 && G === 192 && B === 0)) {
		// Yellow
		R = 196;
		G = 179;
		B = 70;
		A = 255;
	} else if ((R === 255 && G === 144 && B === 0)) {
		// Orange
		R = 190;
		G = 72;
		B = 19;
		A = 255;
	} else if ((R === 214 && G === 0 && B === 0)
		|| (R === 255 && G === 0 && B === 0)) {
		// Red
		R = 171;
		G = 14;
		B = 14;
		A = 255;
	} else if ((R === 192 && G === 0 && B === 0)
		|| (R === 255 && G === 0 && B === 255)) {
		// Brown
		R = 115;
		G = 31;
		B = 4;
		A = 255;
	}

	return {
		R, G, B, A,
	};
	/* eslint-enable no-param-reassign */
};

const radarSourceGenerator = ({
	A, D, B, E, C, F,
}) => {
	const det = A * E - B * D;
	return ([lon, lat]) => {
		const col = (E * (lon - C) - B * (lat - F)) / det;
		const row = (A * (lat - F) - D * (lon - C)) / det;
		return [col, row];
	};
};

const radarSourceXyFromLonLat = radarSourceGenerator(WORLD_TRANSFORM);

const shiftPixelForUser = ([px, py], user) => [
	px + user[PX] - (RADAR_FINAL_SIZE().width / 2),
	py + user[PY] - (RADAR_FINAL_SIZE().height / 2),
];

export {
	radarSourceXyFromLonLat,
	getXYFromLatitudeLongitudeMap,
	removeDopplerRadarImageNoise,
	shiftPixelForUser,
};

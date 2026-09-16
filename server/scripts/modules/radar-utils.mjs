/* eslint-disable no-bitwise */
import {
	WORLD_TRANSFORM, RADAR_FINAL_SIZE, PX, PY,
} from './radar-constants.mjs';

// pre-computed radar noise map to eliminate long comparison chain
// keyed with packed RGB values

const removeNoiseLookup = {
	// Transparent
	0: // ( 0 ,  0 ,  0)
	{
		R: 0, G: 0, B: 0, A: 0,
	},
	60652: // ( 0 ,  236 ,  236)
	{
		R: 0, G: 0, B: 0, A: 0,
	},
	106742: // ( 1 ,  160 ,  246)
	{
		R: 0, G: 0, B: 0, A: 0,
	},
	246: // ( 0 ,  0 ,  246)
	{
		R: 0, G: 0, B: 0, A: 0,
	},

	// Light Green 1
	65280: // ( 0 ,  255 ,  0)
	{
		R: 49, G: 210, B: 22, A: 255,
	},

	// Light Green 2
	51200: // ( 0 ,  200 ,  0)
	{
		R: 0, G: 142, B: 0, A: 255,
	},

	// Dark Green 1
	36864: // ( 0 ,  144 ,  0)
	{
		R: 20, G: 90, B: 15, A: 255,
	},

	// Dark Green 2
	16776960: // ( 255 ,  255 ,  0)
	{
		R: 10, G: 40, B: 10, A: 255,
	},

	// Yellow
	15187968: // ( 231 ,  192 ,  0)
	{
		R: 196, G: 179, B: 70, A: 255,
	},

	// Orange
	16748544: // ( 255 ,  144 ,  0)
	{
		R: 190, G: 72, B: 19, A: 255,
	},

	// Red
	14024704: // ( 214 ,  0 ,  0)
	{
		R: 171, G: 14, B: 14, A: 255,
	},
	16711680: // ( 255 ,  0 ,  0)
	{
		R: 171, G: 14, B: 14, A: 255,
	},
	12582912: // ( 192 ,  0 ,  0)
	{
		R: 115, G: 31, B: 4, A: 255,
	},

	// Brown
	16711935: // ( 255 ,  0 ,  255)
	{
		R: 115, G: 31, B: 4, A: 255,
	},
};

const filterRadarNoise = (R, G, B) => {
	// bit pack the provided color for lookup
	const packedColor = (R << 16) | (G << 8) | B;

	// return the looked up color, or what was provided
	return removeNoiseLookup[packedColor] ?? {
		R, G, B, A: 255,
	};
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

const shiftPixelForUserGenerator = (user) => {
	const radarFinalSize = RADAR_FINAL_SIZE();
	const shiftPixelForUser = ([px, py]) => [
		px + user[PX] - (radarFinalSize.width / 2),
		py + user[PY] - (radarFinalSize.height / 2),
	];
	return shiftPixelForUser;
};

export {
	radarSourceXyFromLonLat,
	filterRadarNoise,
	shiftPixelForUserGenerator,
};

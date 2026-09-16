import {
	WORLD_TRANSFORM, RADAR_FINAL_SIZE, PX, PY,
} from './constants.mjs';

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
	shiftPixelForUserGenerator,
};

import { PX, PY, RADAR_FINAL_SIZE } from './constants.mjs';
import { radarSourceXyFromLonLat, shiftPixelForUserGenerator } from './positions.mjs';

// pre-compute the projection by providing pixel locations for each row
// and a y=mx+b regression for each column in the source row
// this removes the need to call proj4 for every pixel in the destination image
const projectRadar = (projection, user) => {
	const radarFinalSize = RADAR_FINAL_SIZE();
	const rows = [];

	const shiftPixelForUser = shiftPixelForUserGenerator(user);

	for (let y = 0; y < radarFinalSize.height; y += 1) {
		const lonLatLeft = projection.inverse(shiftPixelForUser([0, y]));
		const lonLatRight = projection.inverse(shiftPixelForUser([radarFinalSize.width - 1, y]));
		const sourcePxLeft = radarSourceXyFromLonLat(lonLatLeft);
		const sourcePxRight = radarSourceXyFromLonLat(lonLatRight);

		// calculate m, b for regression
		const m = (sourcePxRight[PX] - sourcePxLeft[PX]) / ((radarFinalSize.width - 1) - 0);
		const b = sourcePxRight[PX] - (m * (radarFinalSize.width - 1));

		// store the regression for this row
		// eslint-disable-next-line no-bitwise
		const xRegression = ((xSource) => (xSource * m) + b | 0);// faster than Math.floor();

		rows.push({
			// eslint-disable-next-line no-bitwise
			sourceY: sourcePxLeft[PY] | 0, // faster than Math.floor();
			xRegression,
			m,
			b,
		});
	}

	return rows;
};

export default projectRadar;

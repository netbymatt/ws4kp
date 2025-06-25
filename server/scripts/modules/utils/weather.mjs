import { safeJson } from './fetch.mjs';
import { debugFlag } from './debug.mjs';

const getPoint = async (lat, lon) => {
	const point = await safeJson(`https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`);
	if (!point) {
		if (debugFlag('verbose-failures')) {
			console.warn(`Unable to get points for ${lat},${lon}`);
		}
		return false;
	}
	return point;
};

export {
	// eslint-disable-next-line import/prefer-default-export
	getPoint,
};

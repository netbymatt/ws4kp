import { json } from './fetch.mjs';
import { debugFlag } from './debug.mjs';

// like getPoint, but reports why the lookup failed so the location search can tell the user
// 'outside': NWS has no forecast grid here (404), usually outside the US
// 'unavailable': timeouts, 5xx after retries, network errors
const lookupPoint = async (lat, lon) => {
	try {
		const point = await json(`https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`);
		// json() returns null when the request was aborted
		if (point) return { point };
	} catch (error) {
		if (error.status === 404) return { reason: 'outside' };
	}
	return { reason: 'unavailable' };
};

const getPoint = async (lat, lon) => {
	const { point } = await lookupPoint(lat, lon);
	if (!point) {
		if (debugFlag('verbose-failures')) {
			console.warn(`Unable to get points for ${lat},${lon}`);
		}
		return false;
	}
	return point;
};

export default getPoint;
export { lookupPoint };

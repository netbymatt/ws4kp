import createProjection from '../utils/map-projection.mjs';
import { coerce } from '../utils/calc.mjs';
import {
	RADAR_FINAL_SIZE, TILE_FULL_SIZE, PX, PY,
} from './constants.mjs';

// the view of the radar base map for a location: the size of the finished image, the projection
// and the user's location in map pixels. this is arithmetic only, no network and no rendering
const calcView = (weatherParameters) => {
	const radarFinalSize = RADAR_FINAL_SIZE();
	const projection = createProjection('radar-conus');
	const user = projection.forward([weatherParameters.longitude, weatherParameters.latitude]);
	const projected = [...user];

	// adjust the user's location to not run off the map
	user[PX] = coerce(user[PX], radarFinalSize.width / 2, TILE_FULL_SIZE.width - (radarFinalSize.width / 2));
	user[PY] = coerce(user[PY], radarFinalSize.height / 2, TILE_FULL_SIZE.height - (radarFinalSize.height / 2));

	return {
		user, projection, radarFinalSize, projected,
	};
};

export default calcView;

import { DateTime } from '../../vendor/auto/luxon.mjs';

const OBS_AGE_LIMIT = 1000 * 60 * 75; // 1 hour 15 minute age limit on observations (allow for slightly behind api updates at 1 hour interval)

// check if an observation is within the fresh window
// takes an ISO date formatted string
const isObsFresh = (obsTime) => (DateTime.now() - DateTime.fromISO(obsTime)) < OBS_AGE_LIMIT;

export default isObsFresh;

export {
	OBS_AGE_LIMIT,
};

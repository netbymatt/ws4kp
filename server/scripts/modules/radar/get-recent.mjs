import { DateTime } from '../../vendor/auto/luxon.mjs';
import { RADAR_HOST } from './constants.mjs';
import fetchImageBlob from '../utils/fetch-image-blob.mjs';
import processRadar from './processor.mjs';

// url patterns as luxon format strings
// https://mesonet.agron.iastate.edu/archive/data/2026/09/16/GIS/uscomp/n0r_202609160300.png
const PATH_FORMAT = 'yyyy/MM/dd';
const FILE_FORMAT = 'yyyyMMddHHmm';

// already processed cache
let processedRadars = [];

// step back produces timestamps at -5 minute intervals from the time it was initialized from
const stepBackGenerator = (initTime) => {
	// internal counter
	let stepsBack = 0;

	// return the function
	return () => {
		// grab the value, then decrement as we start at zero
		const calcStep = stepsBack;
		stepsBack -= 5;
		return initTime.plus({ minutes: calcStep });
	};
};

const imageFetcher = async (stepBack, attempts, user, projection) => {
	if (!attempts || attempts <= 0) throw new Error('Exhausted radar image loading attempts');

	// get this instance's timestamp
	const myTimestamp = stepBack();

	// build the image URL
	const path = `archive/data/${myTimestamp.toFormat(PATH_FORMAT)}/GIS/uscomp/n0r_${myTimestamp.toFormat(FILE_FORMAT)}.png`;
	const url = `https://${RADAR_HOST}/${path}`;
	const modifiedRadarUrl = OVERRIDES.RADAR_HOST ? url.replace(RADAR_HOST, OVERRIDES.RADAR_HOST) : url;

	const key = `${user[0]}-${user[1]}-${path}`;

	// check for pre-processed radar and return early
	const preProcessed = processedRadars.find((radar) => radar.key === key);
	if (preProcessed) {
		// set the used flag for cache cleaning
		preProcessed.used = true;
		return preProcessed;
	}

	// get the radar and process it for this location
	try {
		const radarBlob = await fetchImageBlob(modifiedRadarUrl);

		console.time(`process radar ${path}`);
		const canvas = await processRadar({
			user,
			projection,
			radarBlob,
		});
		console.timeEnd(`process radar ${path}`);

		// store the processed radar
		processedRadars.push({
			key,
			timestamp: myTimestamp,
			canvas,
			used: true,
		});

		// return the structured result
		return {
			key,
			timestamp: myTimestamp,
			canvas,
		};
	} catch {
		// usually a 404 and expected as some images may not be ready yet
		// try again decrementing the attempts (timestamp is decremented at the top of the next call)
		return imageFetcher(stepBack, attempts - 1, user, projection);
	}
};

// get the (max) most recent radars by computing the file name and falling back in time if it's not yet published
// allow up to (attempts) to fall back in time to older images if one is not present
const getRecentRadars = async (max, user, projection, attempts = 2) => {
	// compute the starting timestamp (5 minute rounding)
	const startingTimestamp = DateTime.utc().set({
		minute: Math.round(DateTime.utc().minute / 5) * 5,
		second: 0,
		millisecond: 0,
	}, {
		zone: 'UTC',
	});

	// initialize the back-in-time counter
	const stepBack = stepBackGenerator(startingTimestamp);

	// reset the "used" flag on pre-processed radars
	// items that were not used during this process are deleted (either expired via time or change of location)
	processedRadars.forEach((radar) => {
		radar.used = false;
	});

	// kick off the loop
	const imagePromises = await Promise.allSettled(Array.from({ length: max }, () => imageFetcher(stepBack, attempts, user, projection)));

	// filter for rejected promises (attempts was exceeded)
	const images = imagePromises.filter((image) => image.status === 'fulfilled').map((image) => image.value);

	// sort by timestamp (any 404 image ends up being an older one) and thus can be out of place
	// resulting array is oldest timestamp at [0]
	images.sort((a, b) => a.timestamp - b.timestamp);

	// clean the pre processed cache
	processedRadars = processedRadars.filter((radar) => radar.used === true);

	return images;
};

export default getRecentRadars;

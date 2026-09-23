import { DateTime } from '../../vendor/auto/luxon.mjs';
import { RADAR_HOST, RADAR_FINAL_SIZE } from './constants.mjs';
import fetchImageBlob from '../utils/fetch-image-blob.mjs';
import processRadar from './processor.mjs';
import { debugFlag } from '../utils/debug.mjs';

// url patterns as luxon format strings
// https://mesonet.agron.iastate.edu/archive/data/2026/09/16/GIS/uscomp/n0r_202609160300.png
const PATH_FORMAT = 'yyyy/MM/dd';
const FILE_FORMAT = 'yyyyMMddHHmm';

// already processed cache
let processedRadars = [];

// source images keyed by path, kept so that a change of view size can re-project the same
// images without downloading them again. the processed cache above can not serve that because
// its entries are rendered for one view size only
const radarBlobs = new Map();

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

const imageFetcher = async (stepBack, attempts, user, projection, viewKey) => {
	if (!attempts || attempts <= 0) throw new Error('Exhausted radar image loading attempts');

	// get this instance's timestamp
	const myTimestamp = stepBack();

	// build the image URL
	const path = `archive/data/${myTimestamp.toFormat(PATH_FORMAT)}/GIS/uscomp/n0r_${myTimestamp.toFormat(FILE_FORMAT)}.png`;
	const url = `https://${RADAR_HOST}/${path}`;
	const modifiedRadarUrl = OVERRIDES.RADAR_HOST ? url.replace(RADAR_HOST, OVERRIDES.RADAR_HOST) : url;

	// the processed image is only valid for the location and the view size it was rendered for
	const key = `${viewKey}-${path}`;

	// check for pre-processed radar and return early
	const preProcessed = processedRadars.find((radar) => radar.key === key);
	if (preProcessed) {
		// set the used flag for cache cleaning
		preProcessed.used = true;
		// keep the source image as well, it is needed if the view size changes
		const cachedBlob = radarBlobs.get(path);
		if (cachedBlob) cachedBlob.used = true;
		if (debugFlag('radar')) {
			console.log(`Radar: ${path} reused from the processed cache`);
		}
		return preProcessed;
	}

	// get the radar and process it for this location
	try {
		const started = performance.now();

		// re-use the source image when it has already been downloaded, which is the case when
		// only the view size has changed
		const cachedBlob = radarBlobs.get(path);
		const radarBlob = cachedBlob?.blob ?? (await fetchImageBlob(modifiedRadarUrl));
		radarBlobs.set(path, { blob: radarBlob, used: true });

		const canvas = await processRadar({
			user,
			projection,
			radarBlob,
		});

		if (debugFlag('radar')) {
			const source = cachedBlob ? 're-projected from the source cache' : 'fetched and processed';
			console.log(`Radar: ${path} ${source} in ${Math.round(performance.now() - started)} ms (${radarBlob.size} bytes)`);
		}

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
	} catch (error) {
		// usually a 404 and expected as some images may not be ready yet
		if (debugFlag('verbose-failures')) {
			console.warn(`Radar: ${modifiedRadarUrl} unavailable (${error.message}), ${attempts - 1} attempts left`);
		}
		// try again decrementing the attempts (timestamp is decremented at the top of the next call)
		return imageFetcher(stepBack, attempts - 1, user, projection, viewKey);
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

	if (debugFlag('radar')) {
		console.log(`Radar: requesting ${max} images from ${startingTimestamp.toISO({ suppressMilliseconds: true })}, stepping back 5 minutes each, ${attempts} attempts each, ${processedRadars.length} processed images cached`);
	}

	// initialize the back-in-time counter
	const stepBack = stepBackGenerator(startingTimestamp);

	// reset the "used" flag on pre-processed radars and source images
	// items that were not used during this process are deleted (either expired via time or change of location)
	processedRadars.forEach((radar) => {
		radar.used = false;
	});
	radarBlobs.forEach((entry) => {
		entry.used = false;
	});

	// the processed images are rendered for one location and view size, both of which form the key
	const radarFinalSize = RADAR_FINAL_SIZE();
	const viewKey = `${user[0]}-${user[1]}-${radarFinalSize.width}x${radarFinalSize.height}`;

	// kick off the loop
	const imagePromises = await Promise.allSettled(Array.from({ length: max }, () => imageFetcher(stepBack, attempts, user, projection, viewKey)));

	const rejected = imagePromises.filter((image) => image.status === 'rejected');
	if (rejected.length > 0 && debugFlag('verbose-failures')) {
		console.warn(`Radar: ${rejected.length} of ${max} images failed: ${[...new Set(rejected.map((image) => image.reason.message))].join('; ')}`);
	}

	// filter for rejected promises (attempts was exceeded)
	const images = imagePromises.filter((image) => image.status === 'fulfilled').map((image) => image.value);

	// sort by timestamp (any 404 image ends up being an older one) and thus can be out of place
	// resulting array is oldest timestamp at [0]
	images.sort((a, b) => a.timestamp - b.timestamp);

	// clean the pre processed cache and the source images behind it
	const cachedBefore = processedRadars.length;
	processedRadars = processedRadars.filter((radar) => radar.used === true);
	const blobsBefore = radarBlobs.size;
	radarBlobs.forEach((entry, path) => {
		if (!entry.used) radarBlobs.delete(path);
	});

	if (debugFlag('radar')) {
		console.log(`Radar: ${images.length} of ${max} images ready [${images.map((image) => image.timestamp.toISO({ suppressMilliseconds: true })).join(', ')}], processed cache ${cachedBefore} -> ${processedRadars.length}, source cache ${blobsBefore} -> ${radarBlobs.size}`);
	}

	return images;
};

export default getRecentRadars;

/* eslint-disable no-loop-func */
// list all stations in a single file
// only find stations with 4 letter codes

import { writeFile } from 'node:fs/promises';
import pLimit from 'p-limit';
import { setTimeout } from 'node:timers/promises';
import getHttps from './https.mjs';
import states from './stations-states.mjs';
import chunk from './chunk.mjs';
import overrides from './stations-overrides.mjs';
import postProcessor from './stations-postprocessor.mjs';
import { stationFilter } from '../server/scripts/modules/utils/string.mjs';

// check for cached flag
const USE_CACHE = process.argv.includes('--use-cache');

// chunk the list of states
const chunkStates = chunk(states, 3);

// store output
const output = {};
let completed = 0;

// limit the number of in-flight requests at one time
const limit = pLimit(5);
const HTTPS_GET_INTERVAL = 500; // ms

const httpsGetLimited = async (...args) => {
	// be nice to the api wait
	await setTimeout(HTTPS_GET_INTERVAL);
	return limit(getHttps, ...args);
};

// get data from api if desired
if (!USE_CACHE) {
	// process all chunks
	for (let i = 0; i < chunkStates.length; i += 1) {
		const stateChunk = chunkStates[i];
		// loop through states

		// eslint-disable-next-line no-await-in-loop
		await Promise.allSettled(stateChunk.map(async (state) => {
			try {
				let stations;
				let next = `https://api.weather.gov/stations?state=${state}`;
				let round = 0;
				do {
					console.log(`Getting: ${state}-${round}`);
					// get list and parse the JSON
					// eslint-disable-next-line no-await-in-loop
					const stationsRaw = await httpsGetLimited(next);
					stations = JSON.parse(stationsRaw);
					// filter against starting letter
					const stationsFiltered = stations.features.filter(stationFilter);
					// add each resulting station to the output
					stationsFiltered.forEach((station) => {
						const id = station.properties.stationIdentifier;
						if (output[id]) {
							console.log(`Duplicate station: ${state}-${id}`);
							return;
						}
						if (station.properties.provider === '' && station.properties.subProvider === '') {
							console.log(`No providers for: ${state}\\${id}`);
						}
						output[id] = {
							id,
							city: station.properties.name,
							state,
							lat: station.geometry.coordinates[1],
							lon: station.geometry.coordinates[0],
						};
					});
					next = stations?.pagination?.next;
					round += 1;
					// write the output
					// eslint-disable-next-line no-await-in-loop
					await writeFile('./datagenerators/output/stations-raw.json', JSON.stringify(output, null, 2));
				}
				while (next && stations.features.length > 0);
				completed += 1;
				console.log(`Complete: ${state} ${completed}/${states.length}`);
				return true;
			} catch (e) {
				console.error(`Unable to get state: ${state}`);
				console.error(e);
				return false;
			}
		}));
	}
}

// run the post processor
// data is passed through the file stations-raw.json
const postProcessed = await postProcessor({ writeFile: true });

// apply any overrides
Object.entries(overrides).forEach(([id, values]) => {
	// check for existing value
	if (postProcessed[id]) {
		// apply the overrides
		postProcessed[id] = {
			...postProcessed[id],
			...values,
		};
	}
});

// write final file to disk
await writeFile('./datagenerators/output/stations.json', JSON.stringify(postProcessed, null, 2));

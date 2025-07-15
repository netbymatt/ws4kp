// list all stations in a single file
// only find stations with 4 letter codes

import { writeFileSync } from 'fs';
import https from './https.mjs';
import states from './stations-states.mjs';
import chunk from './chunk.mjs';

// skip stations starting with these letters
const skipStations = ['U', 'C', 'H', 'W', 'Y', 'T', 'S', 'M', 'O', 'L', 'A', 'F', 'B', 'N', 'V', 'R', 'D', 'E', 'I', 'G', 'J'];

// chunk the list of states
const chunkStates = chunk(states, 1);

// store output
const output = {};

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
				const stationsRaw = await https(next);
				stations = JSON.parse(stationsRaw);
				// filter stations for 4 letter identifiers
				const stationsFiltered4 = stations.features.filter((station) => station.properties.stationIdentifier.match(/^[A-Z]{4}$/));
				// filter against starting letter
				const stationsFiltered = stationsFiltered4.filter((station) => !skipStations.includes(station.properties.stationIdentifier.slice(0, 1)));
				// add each resulting station to the output
				stationsFiltered.forEach((station) => {
					const id = station.properties.stationIdentifier;
					if (output[id]) {
						console.log(`Duplicate station: ${state}-${id}`);
						return;
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
				writeFileSync('./datagenerators/output/stations-raw.json', JSON.stringify(output, null, 2));
			}
			while (next && stations.features.length > 0);
			console.log(`Complete: ${state}`);
			return true;
		} catch (e) {
			console.error(`Unable to get state: ${state}`);
			return false;
		}
	}));
}

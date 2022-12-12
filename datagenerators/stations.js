// list all stations in a single file
// only find stations with 4 letter codes

const fs = require('fs');
const path = require('path');
const https = require('./https');
const states = require('./stations-states');
const chunk = require('./chunk');

// immediately invoked function so we can access async/await
const start = async () => {
	// chunk the list of states
	const chunkStates = chunk(states, 5);

	// store output
	const output = {};

	// process all chunks
	for (let i = 0; i < chunkStates.length; i += 1) {
		const stateChunk = chunkStates[i];
		// loop through states

		stateChunk.forEach(async (state) => {
			try {
				let stations;
				let next = `https://api.weather.gov/stations?state=${state}`;
				do {
				// get list and parse the JSON
					// eslint-disable-next-line no-await-in-loop
					const stationsRaw = await https(next);
					stations = JSON.parse(stationsRaw);
					// filter stations for 4 letter identifiers
					const stationsFiltered = stations.features.filter((station) => station.properties.stationIdentifier.match(/^[A-Z]{4}$/));
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
					// write the output
					fs.writeFileSync(path.join(__dirname, 'output/stations.json'), JSON.stringify(output, null, 2));
				}
				while (next && stations.features.length > 0);
				console.log(`Complete: ${state}`);
				return true;
			} catch (e) {
				console.error(`Unable to get state: ${state}`);
				return false;
			}
		});
	}

	// write the output
	fs.writeFileSync(path.join(__dirname, 'output/stations.js'), JSON.stringify(output, null, 2));
};

// immediately invoked function allows access to async
(async () => {
	await start();
})();

// list all stations in a single file
// only find stations with 4 letter codes

const fs = require('fs');
const path = require('path');
const https = require('./https');

// immediately invoked function so we can access async/await
const start = async () => {
	// load the list of states
	const states = ['AK', 'NC', 'VA', 'TX', 'GA', 'PR'];
	// const states = require('./stations-states.js');

	const output = {};
	// loop through states
	await Promise.all(states.map(async (state) => {
		try {
			// get list and parse the JSON
			const stationsRaw = await https(`https://api.weather.gov/stations?state=${state}`);
			const stationsAll = JSON.parse(stationsRaw).features;
			// filter stations for 4 letter identifiers
			const stations = stationsAll.filter((station) => station.properties.stationIdentifier.match(/^[A-Z]{4}$/));
			// add each resulting station to the output
			stations.forEach((station) => {
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
			console.log(`Complete: ${state}`);
		} catch (e) {
			console.error(`Unable to get state: ${state}`);
			return false;
		}
	}));

	// write the output
	fs.writeFileSync(path.join(__dirname, 'output/stations.js'), JSON.stringify(output, null, 2));
};

// immediately invoked function allows access to async
(async () => {
	await start();
})();

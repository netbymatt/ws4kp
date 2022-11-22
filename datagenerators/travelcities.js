// look up points for each travel city
const fs = require('fs/promises');
const chunk = require('./chunk');
const https = require('./https');

(async () => {
	// source data
	const travelCities = JSON.parse(await fs.readFile('./datagenerators/travelcities-raw.json'));

	const result = [];
	const dataChunks = chunk(travelCities, 5);

	// for loop intentional for use of await
	// this keeps the api from getting overwhelmed
	for (let i = 0; i < dataChunks.length; i += 1) {
		const cityChunk = dataChunks[i];

		// eslint-disable-next-line no-await-in-loop
		const chunkResult = await Promise.all(cityChunk.map(async (city) => {
			try {
				const data = await https(`https://api.weather.gov/points/${city.Latitude},${city.Longitude}`);
				const point = JSON.parse(data);
				return {
					...city,
					point: {
						x: point.properties.gridX,
						y: point.properties.gridY,
						wfo: point.properties.gridId,
					},
				};
			} catch (e) {
				console.error(e);
				return city;
			}
		}));

		result.push(...chunkResult);
	}

	await fs.writeFile('./datagenerators/output/travelcities.json', JSON.stringify(result, null, '	'));
})();

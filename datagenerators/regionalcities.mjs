// look up points for each regional city
import fs from 'fs/promises';

import chunk from './chunk.mjs';
import https from './https.mjs';

// source data
const regionalCities = JSON.parse(await fs.readFile('./datagenerators/regionalcities-raw.json'));

const result = [];
const dataChunks = chunk(regionalCities, 5);

// for loop intentional for use of await
// this keeps the api from getting overwhelmed
for (let i = 0; i < dataChunks.length; i += 1) {
	const cityChunk = dataChunks[i];

	// eslint-disable-next-line no-await-in-loop
	const chunkResult = await Promise.all(cityChunk.map(async (city) => {
		try {
			const data = await https(`https://api.weather.gov/points/${city.lat},${city.lon}`);
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

await fs.writeFile('./datagenerators/output/regionalcities.json', JSON.stringify(result, null, '	'));

// look up points for each regional city
import fs from 'fs/promises';
import pLimit from 'p-limit';

import https from './https.mjs';

// source data
const regionalCities = JSON.parse(await fs.readFile('./datagenerators/regionalcities-raw.json'));

const limit = pLimit(9);

const pointLookup = async (city) => {
	console.log(`lookup: ${city.city}`);
	try {
		const data = await https(`https://api.weather.gov/points/${city.lon.toFixed(4)},${city.lat.toFixed(4)}`);
		const point = JSON.parse(data);
		return {
			city: city.city,
			lat: city.lon.toFixed(4),
			lon: city.lat.toFixed(4),
			point: {
				x: point.properties.gridX,
				y: point.properties.gridY,
				wfo: point.properties.gridId,
			},
		};
	} catch (e) {
		console.error(e);
		return {
			city: city.city,
			lat: city.lon.toFixed(4),
			lon: city.lat.toFixed(4),
		};
	}
};

const result = await Promise.all(regionalCities.map((city) => limit(pointLookup, city)));

await fs.writeFile('./datagenerators/output/regionalcities.json', JSON.stringify(result, null, '	'));

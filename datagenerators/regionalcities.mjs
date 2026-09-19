// look up points for each regional city
import fs from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';
import pLimit from 'p-limit';

import getHttps from './https.mjs';

// source data
const regionalCities = JSON.parse(await fs.readFile('./datagenerators/regionalcities-raw.json'));

const limit = pLimit(9);

const pointLookup = async (city) => {
	console.log(`lookup: ${city.city}`);
	try {
		const data = await getHttps(`https://api.weather.gov/points/${city.lon.toFixed(4)},${city.lat.toFixed(4)}`);
		const point = JSON.parse(data);
		// also get the first station to speed up regional cities page
		const stationsRaw = await getHttps(`${point.properties.observationStations}?limit=10`);
		const stations = JSON.parse(stationsRaw);
		const station = stations?.features?.find((s) => s?.properties?.stationIdentifier?.length === 4);
		const id = station?.properties?.stationIdentifier;
		const result = {
			city: city.city,
			lat: city.lon.toFixed(4),
			lon: city.lat.toFixed(4),
			point: {
				x: point.properties.gridX,
				y: point.properties.gridY,
				wfo: point.properties.gridId,
			},
		};
		// add the id if it was found
		if (id) result.id = id;
		// be nice to the api
		await setTimeout(500);
		return result;
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

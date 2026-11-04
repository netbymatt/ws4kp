/* eslint-disable no-await-in-loop, no-restricted-syntax, no-continue, n/no-process-exit, n/no-sync, n/no-unsupported-features/node-builtins -- CLI build script (Node 22) */
// ATV fork: generate the app's geographic data from custom/region.config.mjs
//
// Writes (overwrites) the three files the app serves:
//   datagenerators/output/travelcities.json
//   datagenerators/output/regionalcities.json
//   datagenerators/output/stations.json
//
// Usage:
//   node custom/scripts/build-data.mjs                  look up missing NWS grid points (needs api.weather.gov)
//   node custom/scripts/build-data.mjs --offline        use cached points only; fail if any are missing
//   node custom/scripts/build-data.mjs --allow-missing  write data even if some points are missing
//                                                       (those cities are left out of the Travel Forecast)

import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import config from '../region.config.mjs';

const OFFLINE = process.argv.includes('--offline');
const ALLOW_MISSING = process.argv.includes('--allow-missing');
const CACHE_FILE = './custom/data/points-cache.json';
const OUT = './datagenerators/output';
const USER_AGENT = '(ws4kp ATV fork data generator)';

const key = (c) => `${c.lat.toFixed(4)},${c.lon.toFixed(4)}`;

// full upstream station list: prefer upstream's copy so a filtered local file never shrinks the source
const loadUpstreamStations = async () => {
	try {
		const raw = execFileSync('git', ['show', 'upstream/main:datagenerators/output/stations.json'], { maxBuffer: 64 * 1024 * 1024 });
		return JSON.parse(raw);
	} catch {
		console.warn('! upstream/main not available, using local stations.json as the source');
		return JSON.parse(await readFile(`${OUT}/stations.json`));
	}
};

const lookupPoint = async (c) => {
	const res = await fetch(`https://api.weather.gov/points/${c.lat.toFixed(4)},${c.lon.toFixed(4)}`, {
		headers: { 'user-agent': USER_AGENT, accept: 'application/geo+json' },
	});
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	const { properties: p } = await res.json();
	return { x: p.gridX, y: p.gridY, wfo: p.gridId };
};

const inBounds = (lat, lon, b = config.bounds) => lat > b.minLat && lat < b.maxLat && lon > b.minLon && lon < b.maxLon;

// ---- grid points ----
const cache = JSON.parse(await readFile(CACHE_FILE));
const missing = [];
for (const c of config.communities) {
	if (!inBounds(c.lat, c.lon)) console.warn(`! ${c.name} is outside config.bounds`);
	if (cache[key(c)]) continue;
	if (OFFLINE) {
		missing.push(c.name);
		continue;
	}
	try {
		cache[key(c)] = await lookupPoint(c);
		console.log(`  looked up ${c.name}: ${JSON.stringify(cache[key(c)])}`);
		await sleep(500); // be nice to the api
	} catch (e) {
		console.warn(`! point lookup failed for ${c.name}: ${e.cause?.code ?? e.message}`);
		missing.push(c.name);
	}
}
await writeFile(CACHE_FILE, `${JSON.stringify(cache, null, '\t')}\n`);

if (missing.length && !ALLOW_MISSING) {
	console.error(`✗ missing NWS grid points for: ${missing.join(', ')}`);
	console.error('  run again where api.weather.gov is reachable, or pass --allow-missing');
	process.exit(1);
}

// ---- travel cities (only entries with a grid point work on the Travel Forecast) ----
const travel = config.communities
	.filter((c) => cache[key(c)])
	.map((c) => ({
		Name: c.name, Latitude: c.lat, Longitude: c.lon, point: cache[key(c)],
	}));

// ---- regional cities (point is optional; the app looks it up at runtime if absent) ----
const regional = config.communities.map((c) => ({
	city: c.name,
	lat: c.lat.toFixed(4),
	lon: c.lon.toFixed(4),
	...(cache[key(c)] ? { point: cache[key(c)] } : {}),
	id: c.station,
}));

// ---- stations ----
const upstream = await loadUpstreamStations();
const stations = {};
if (config.stationsMode === 'region') {
	Object.values(upstream)
		.filter((s) => inBounds(s.lat, s.lon))
		.forEach((s) => {
			stations[s.id] = s;
		});
}
// community stations always included, renamed to the community name
for (const c of config.communities) {
	const s = upstream[c.station];
	if (!s) console.warn(`! station ${c.station} (${c.name}) not in upstream list, using community coordinates`);
	stations[c.station] = {
		id: c.station,
		lat: s?.lat ?? c.lat,
		lon: s?.lon ?? c.lon,
		state: s?.state ?? 'AR',
		city: c.name,
		priority: s?.priority ?? 1,
	};
}
const sortedStations = Object.fromEntries(Object.entries(stations).sort(([a], [b]) => a.localeCompare(b)));

const write = (name, data) => writeFile(`${OUT}/${name}.json`, JSON.stringify(data, null, '\t'));
await write('travelcities', travel);
await write('regionalcities', regional);
await write('stations', sortedStations);

console.log(`✓ ${config.name}: ${travel.length} travel, ${regional.length} regional, ${Object.keys(sortedStations).length} stations (${config.stationsMode})`);
if (missing.length) console.warn(`! left out of Travel Forecast (no grid point yet): ${missing.join(', ')}`);

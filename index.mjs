import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import { readFile } from 'fs/promises';
import {
	weatherProxy, radarProxy, outlookProxy, mesonetProxy, forecastProxy,
} from './proxy/handlers.mjs';
import playlist from './src/playlist.mjs';
import OVERRIDES from './src/overrides.mjs';
import cache from './proxy/cache.mjs';

const travelCities = JSON.parse(await readFile('./datagenerators/output/travelcities.json'));
const regionalCities = JSON.parse(await readFile('./datagenerators/output/regionalcities.json'));
const stationInfo = JSON.parse(await readFile('./datagenerators/output/stations.json'));

const app = express();
const port = process.env.WS4KP_PORT ?? 8080;

// Set X-Weatherstar header globally for playlist fallback detection
app.use((req, res, next) => {
	res.setHeader('X-Weatherstar', 'true');
	next();
});

// template engine
app.set('view engine', 'ejs');

// version
const { version } = JSON.parse(fs.readFileSync('package.json'));

// read and parse environment variables to append to the query string
// use the permalink (share) button on the web app to generate a starting point for your configuration
// then take each key/value in the querystring and append WSQS_ to the beginning, and then replace any
// hyphens with underscores in the key name
// environment variables are read from the command line and .env file via the dotenv package

const qsVars = {};

Object.entries(process.env).forEach(([key, value]) => {
	// test for key matching pattern described above
	if (key.match(/^WSQS_[A-Za-z0-9_]+$/)) {
		// convert the key to a querystring formatted key
		const formattedKey = key.replace(/^WSQS_/, '').replaceAll('_', '-');
		qsVars[formattedKey] = value;
	}
});

// single flag to determine if environment variables are present
const hasQsVars = Object.entries(qsVars).length > 0;

// turn the environment query string into search params
const defaultSearchParams = (new URLSearchParams(qsVars)).toString();

const renderIndex = (req, res, production = false) => {
	res.render('index', {
		production,
		serverAvailable: !process.env?.STATIC, // Disable caching proxy server in static mode
		version,
		OVERRIDES,
		query: req.query,
	});
};

const index = (req, res) => {
	// test for no query string in request and if environment query string values were provided
	if (hasQsVars && Object.keys(req.query).length === 0) {
		// redirect the user to the query-string appended url
		const url = new URL(`${req.protocol}://${req.host}${req.url}`);
		url.search = defaultSearchParams;
		res.redirect(307, url.toString());
		return;
	}
	// return the EJS template page in development mode (serve files from server directory directly)
	renderIndex(req, res, false);
};

const geoip = (req, res) => {
	res.set({
		'x-geoip-city': 'Orlando',
		'x-geoip-country': 'US',
		'x-geoip-country-name': 'United States',
		'x-geoip-country-region': 'FL',
		'x-geoip-country-region-name': 'Florida',
		'x-geoip-latitude': '28.52135',
		'x-geoip-longitude': '-81.41079',
		'x-geoip-postal-code': '32789',
		'x-geoip-time-zone': 'America/New_York',
		'content-type': 'application/json',
	});
	res.json({});
};

// Configure static asset caching with proper ETags and cache validation
const staticOptions = {
	etag: true, // Enable ETag generation
	lastModified: true, // Enable Last-Modified headers
	setHeaders: (res, path, stat) => {
		// Generate ETag based on file modification time and size for better cache validation
		const etag = `"${stat.mtime.getTime().toString(16)}-${stat.size.toString(16)}"`;
		res.setHeader('ETag', etag);

		if (path.match(/\.(png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot)$/i)) {
			// Images and fonts - cache for 1 year (immutable content)
			res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
		} else if (path.match(/\.(css|js|mjs)$/i)) {
			// Scripts and styles - use cache validation instead of no-cache
			// This allows browsers to use cached version if ETag matches (304 response)
			res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
		} else {
			// Other files - cache for 1 hour with validation
			res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
		}
	},
};

// Weather.gov API proxy (catch-all for any Weather.gov API endpoint)
// Skip setting up routes for the caching proxy server in static mode
if (!process.env?.STATIC) {
	app.use('/api/', weatherProxy);

	// Cache management DELETE endpoint to allow "uncaching" specific URLs
	app.delete(/^\/cache\/.*/, (req, res) => {
		const path = req.url.replace('/cache', '');
		const cleared = cache.clearEntry(path);
		res.json({ cleared, path });
	});

	// specific proxies for other services
	app.use('/radar/', radarProxy);
	app.use('/spc/', outlookProxy);
	app.use('/mesonet/', mesonetProxy);
	app.use('/forecast/', forecastProxy);

	// Playlist route is available in server mode (not in static mode)
	app.get('/playlist.json', playlist);
}

// Data endpoints - serve JSON data with long-term caching
const dataEndpoints = {
	travelcities: travelCities,
	regionalcities: regionalCities,
	stations: stationInfo,
};

Object.entries(dataEndpoints).forEach(([name, data]) => {
	app.get(`/data/${name}.json`, (req, res) => {
		res.set({
			'Cache-Control': 'public, max-age=31536000, immutable',
			'Content-Type': 'application/json',
		});
		res.json(data);
	});
});

if (process.env?.DIST === '1') {
	// Production ("distribution") mode uses pre-baked files in the dist directory
	// 'npm run build' and then 'DIST=1 npm start'
	app.use('/scripts', express.static('./server/scripts', staticOptions));
	app.use('/geoip', geoip);

	// render the EJS template in production mode (serve compressed files from dist directory)
	app.get('/', (req, res) => { renderIndex(req, res, true); });

	app.use('/', express.static('./dist', staticOptions));
} else {
	// Development mode serves files from the server directory: 'npm start'
	app.get('/index.html', index);
	app.use('/geoip', geoip);
	app.use('/resources', express.static('./server/scripts/modules'));
	app.get('/', index);
	app.get('*name', express.static('./server', staticOptions));
}

const server = app.listen(port, () => {
	console.log(`Server listening on port ${port}`);
});

// graceful shutdown
const gracefulShutdown = () => {
	server.close(() => {
		console.log('Server closed');
		process.exit(0);
	});
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import corsPassThru from './cors/index.mjs';
import radarPassThru from './cors/radar.mjs';
import outlookPassThru from './cors/outlook.mjs';
import playlist from './src/playlist.mjs';

const app = express();
const port = process.env.WS4KP_PORT ?? 8080;

// template engine
app.set('view engine', 'ejs');

// cors pass-thru to api.weather.gov
app.get('/stations/*station', corsPassThru);
app.get('/Conus/*radar', radarPassThru);
app.get('/products/*product', outlookPassThru);
app.get('/playlist.json', playlist);

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

const index = (req, res) => {
	// test for no query string in request and if environment query string values were provided
	if (hasQsVars && Object.keys(req.query).length === 0) {
		// redirect the user to the query-string appended url
		const url = new URL(`${req.protocol}://${req.host}${req.url}`);
		url.search = defaultSearchParams;
		res.redirect(307, url.toString());
		return;
	}
	// return the standard page
	res.render('index', {
		production: false,
		version,
	});
};

// debugging
if (process.env?.DIST === '1') {
	// distribution
	app.use('/images', express.static('./server/images'));
	app.use('/fonts', express.static('./server/fonts'));
	app.use('/scripts', express.static('./server/scripts'));
	app.use('/', express.static('./dist'));
} else {
	// debugging
	app.get('/index.html', index);
	app.get('/', index);
	app.get('*name', express.static('./server'));
}

const server = app.listen(port, () => {
	console.log(`Server listening on port ${port}`);
});

// graceful shutdown
process.on('SIGINT', () => {
	server.close(() => {
		console.log('Server closed');
	});
});

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

const index = (req, res) => {
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

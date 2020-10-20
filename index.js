// express
const express = require('express');
const app = express();
const port = 8080;
const path = require('path');

// template engine
app.set('view engine', 'ejs');

// cors pass through
const corsPassThru = require('./cors');
const radarPassThru = require('./cors/radar');
const outlookPassThru = require('./cors/outlook');

// cors pass-thru to api.weather.gov
app.get('/stations/*', corsPassThru);
app.get('/Conus/*', radarPassThru);
app.get('/products/*', outlookPassThru);

// version
const version = require('./version');

const index = (req, res) => {
	res.render(path.join(__dirname, 'views/index'), {
		production: false,
		version,
	});
};

// main page
app.get('/index.html', index);
app.get('/', index);

// fallback
app.get('*', express.static(path.join(__dirname, './server')));

const server = app.listen(port, () => {
	console.log(`Server listening on port ${port}`);
});

// graceful shutdown
process.on('SIGINT', () => {
	server.close(()=> {
		console.log('Server closed');
	});
});

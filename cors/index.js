// pass through api requests

// http(s) modules
const https = require('https');

// url parsing
const queryString = require('querystring');

// return an express router
module.exports = (req, res) => {
	// add out-going headers
	const headers = {};
	headers['user-agent'] = '(WeatherStar 4000+, ws4000@netbymatt.com)';
	headers.accept = req.headers.accept;

	// get query paramaters if the exist
	const queryParams = Object.keys(req.query).reduce((acc, key) => {
		// skip the paramater 'u'
		if (key === 'u') return acc;
		// add the paramter to the resulting object
		acc[key] = req.query[key];
		return acc;
	}, {});
	let query = queryString.encode(queryParams);
	if (query.length > 0) query = `?${query}`;

	// get the page
	https.get(`https://api.weather.gov${req.path}${query}`, {
		headers,
	}, (getRes) => {
		// pull some info
		const { statusCode } = getRes;
		// pass the status code through
		res.status(statusCode);

		// set headers
		res.header('content-type', getRes.headers['content-type']);
		// pipe to response
		getRes.pipe(res);
	}).on('error', (e) => {
		console.error(e);
	});
};

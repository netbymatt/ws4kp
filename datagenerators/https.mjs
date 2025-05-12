// async https wrapper
import https from 'https';

const get = (url) => new Promise((resolve, reject) => {
	const headers = {};
	headers['user-agent'] = '(WeatherStar 4000+ data generator, ws4000@netbymatt.com)';

	https.get(url, {
		headers,
	}, (res) => {
		if (res.statusCode === 200) {
			const buffers = [];
			res.on('data', (data) => buffers.push(data));
			res.on('end', () => resolve(Buffer.concat(buffers).toString()));
		} else {
			console.log(res);
			reject(new Error(`Unable to get: ${url}`));
		}
	}).on('error', (e) => {
		console.log(e);
		reject(e);
	});
});

export default get;

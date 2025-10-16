import path from 'path';

// get values for devtools json
const uuid = 'd2bd1130-560f-4c8e-b2c5-e91073784964';
const root = path.resolve('server');

const DEVTOOLS_CONFIG = {
	workspace: {
		uuid,
		root,
	},
};

const devTools = (req, res) => {
	// test for localhost
	if (['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.ip)) {
		console.log(DEVTOOLS_CONFIG);
		res.json(DEVTOOLS_CONFIG);
	} else {
		// not localhost
		res.status(404).send('File not found');
	}
};

export default devTools;

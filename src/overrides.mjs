// read overrides from environment variables

const OVERRIDES = {};
Object.entries(process.env).forEach(([key, value]) => {
	if (key.match(/^OVERRIDE_/)) {
		OVERRIDES[key.replace('OVERRIDE_', '')] = value;
	}
});

export default OVERRIDES;

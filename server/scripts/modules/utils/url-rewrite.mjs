// rewrite URLs to use local proxy server
const rewriteUrl = (_url) => {
	if (!_url) {
		throw new Error(`rewriteUrl called with invalid argument: '${_url}' (${typeof _url})`);
	}

	// Handle relative URLs early: return them as-is since they don't need rewriting
	if (typeof _url === 'string' && !_url.startsWith('http')) {
		return _url;
	}

	if (typeof _url !== 'string' && !(_url instanceof URL)) {
		throw new Error(`rewriteUrl expects a URL string or URL object, received: ${typeof _url}`);
	}

	// Convert to URL object (for URL objects, creates a copy to avoid mutating the original)
	const url = new URL(_url);

	if (!window.WS4KP_SERVER_AVAILABLE) {
		// If running standalone in the browser, simply return a URL object without rewriting
		return url;
	}

	// Rewrite the origin to use local proxy server
	if (url.origin === 'https://api.weather.gov') {
		url.protocol = window.location.protocol;
		url.host = window.location.host;
		url.pathname = `/api${url.pathname}`;
	} else if (url.origin === 'https://forecast.weather.gov') {
		url.protocol = window.location.protocol;
		url.host = window.location.host;
		url.pathname = `/forecast${url.pathname}`;
	} else if (url.origin === 'https://www.spc.noaa.gov') {
		url.protocol = window.location.protocol;
		url.host = window.location.host;
		url.pathname = `/spc${url.pathname}`;
	} else if (url.origin === 'https://radar.weather.gov') {
		url.protocol = window.location.protocol;
		url.host = window.location.host;
		url.pathname = `/radar${url.pathname}`;
	} else if (url.origin === 'https://mesonet.agron.iastate.edu') {
		url.protocol = window.location.protocol;
		url.host = window.location.host;
		url.pathname = `/mesonet${url.pathname}`;
	} else if (typeof OVERRIDES !== 'undefined' && OVERRIDES?.RADAR_HOST && url.origin === `https://${OVERRIDES.RADAR_HOST}`) {
		// Handle override radar host
		url.protocol = window.location.protocol;
		url.host = window.location.host;
		url.pathname = `/mesonet${url.pathname}`;
	}

	return url;
};

export {
	// eslint-disable-next-line import/prefer-default-export
	rewriteUrl,
};

// the proxy routes sit next to the page, so resolve them against the page's own address
// that keeps them working when the site is hosted under a subpath such as https://example.com/weatherstar/
const toProxy = (url, route) => new URL(`${route}${url.pathname}${url.search}`, window.location.href);

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
	if (url.origin === 'https://api.weather.gov') return toProxy(url, 'api');
	if (url.origin === 'https://forecast.weather.gov') return toProxy(url, 'forecast');
	if (url.origin === 'https://www.spc.noaa.gov') return toProxy(url, 'spc');
	if (url.origin === 'https://radar.weather.gov') return toProxy(url, 'radar');
	if (url.origin === 'https://mesonet.agron.iastate.edu') return toProxy(url, 'mesonet');
	if (url.origin === 'https://hrrrzarr.s3.amazonaws.com') return toProxy(url, 'hrrr');
	// Handle override radar host
	if (typeof OVERRIDES !== 'undefined' && OVERRIDES?.RADAR_HOST && url.origin === `https://${OVERRIDES.RADAR_HOST}`) return toProxy(url, 'mesonet');

	return url;
};

export default rewriteUrl;

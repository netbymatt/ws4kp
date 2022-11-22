// rewrite some urls for local server
const rewriteUrl = (_url) => {
	let url = _url;
	url = url.replace('https://api.weather.gov/', window.location.href);
	url = url.replace('https://www.cpc.ncep.noaa.gov/', window.location.href);
	return url;
};

export {
	// eslint-disable-next-line import/prefer-default-export
	rewriteUrl,
};

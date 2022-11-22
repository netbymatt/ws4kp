import { rewriteUrl } from './cors.mjs';

const json = (url, params) => fetchAsync(url, 'json', params);
const text = (url, params) => fetchAsync(url, 'text', params);
const raw = (url, params) => fetchAsync(url, '', params);
const blob = (url, params) => fetchAsync(url, 'blob', params);

const fetchAsync = async (_url, responseType, _params = {}) => {
	// combine default and provided parameters
	const params = {
		method: 'GET',
		mode: 'cors',
		type: 'GET',
		..._params,
	};
		// build a url, including the rewrite for cors if necessary
	let corsUrl = _url;
	if (params.cors === true) corsUrl = rewriteUrl(_url);
	const url = new URL(corsUrl, `${window.location.origin}/`);
	// match the security protocol when not on localhost
	url.protocol = window.location.hostname !== 'localhost' ? window.location.protocol : url.protocol;
	// add parameters if necessary
	if (params.data) {
		Object.keys(params.data).forEach((key) => {
			// get the value
			const value = params.data[key];
			// add to the url
			url.searchParams.append(key, value);
		});
	}

	// make the request
	const response = await fetch(url, params);

	// check for ok response
	if (!response.ok) throw new Error(`Fetch error ${response.status} ${response.statusText} while fetching ${response.url}`);
	// return the requested response
	switch (responseType) {
	case 'json':
		return response.json();
	case 'text':
		return response.text();
	case 'blob':
		return response.blob();
	default:
		return response;
	}
};

export {
	json,
	text,
	raw,
	blob,
};

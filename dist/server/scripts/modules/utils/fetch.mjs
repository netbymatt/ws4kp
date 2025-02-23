import { rewriteUrl } from './cors.mjs';

const json = (url, params) => fetchAsync(url, 'json', params);
const text = (url, params) => fetchAsync(url, 'text', params);
const blob = (url, params) => fetchAsync(url, 'blob', params);

const fetchAsync = async (_url, responseType, _params = {}) => {
	// combine default and provided parameters
	const params = {
		method: 'GET',
		mode: 'cors',
		type: 'GET',
		retryCount: 0,
		..._params,
	};
	// store original number of retries
	params.originalRetries = params.retryCount;

	// build a url, including the rewrite for cors if necessary
	let corsUrl = _url;
	if (params.cors === true) corsUrl = rewriteUrl(_url);
	const url = new URL(corsUrl, `${window.location.origin}/`);
	// match the security protocol when not on localhost
	// url.protocol = window.location.hostname === 'localhost' ? url.protocol : window.location.protocol;
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
	const response = await doFetch(url, params);

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

// fetch with retry and back-off
const doFetch = (url, params) => new Promise((resolve, reject) => {
	fetch(url, params).then((response) => {
		if (params.retryCount > 0) {
			// 500 status codes should be retried after a short backoff
			if (response.status >= 500 && response.status <= 599 && params.retryCount > 0) {
				// call the "still waiting" function
				if (typeof params.stillWaiting === 'function' && params.retryCount === params.originalRetries) {
					params.stillWaiting();
				}
				// decrement and retry
				const newParams = {
					...params,
					retryCount: params.retryCount - 1,
				};
				return resolve(delay(retryDelay(params.originalRetries - newParams.retryCount), doFetch, url, newParams));
			}
			// not 500 status
			return resolve(response);
		}
		// out of retries
		return resolve(response);
	})
		.catch((error) => reject(error));
});

const delay = (time, func, ...args) => new Promise((resolve) => {
	setTimeout(() => {
		resolve(func(...args));
	}, time);
});

const retryDelay = (retryNumber) => {
	switch (retryNumber) {
		case 1: return 1000;
		case 2: return 2000;
		case 3: return 5000;
		case 4: return 10_000;
		default: return 30_000;
	}
};

export {
	json,
	text,
	blob,
};

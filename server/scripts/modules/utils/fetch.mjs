import rewriteUrl from './url-rewrite.mjs';

const DEFAULT_REQUEST_TIMEOUT = 15000; // For example, with 3 retries: 15s+1s+15s+2s+15s+5s+15s = 68s

// Centralized utilities for handling errors in Promise contexts
const safeJson = async (url, params) => {
	try {
		const result = await json(url, params);
		return result;
	} catch {
		// Error already logged in fetchAsync; return null to be "safe"
		return null;
	}
};

const safePromiseAll = async (promises) => {
	try {
		const results = await Promise.allSettled(promises);

		return results.map((result, index) => {
			if (result.status === 'fulfilled') {
				return result.value;
			}
			// Log rejected promises for debugging (except AbortErrors which are expected)
			if (result.reason?.name !== 'AbortError') {
				console.warn(`Promise ${index} rejected:`, result.reason?.message || result.reason);
			}
			return null;
		});
	} catch (error) {
		console.error('safePromiseAll encountered an unexpected error:', error);
		// Return array of nulls matching the input length
		return new Array(promises.length).fill(null);
	}
};

const json = (url, params) => fetchAsync(url, 'json', params);
const text = (url, params) => fetchAsync(url, 'text', params);
const blob = (url, params) => fetchAsync(url, 'blob', params);

// Hosts that don't allow custom User-Agent headers due to CORS restrictions
const USER_AGENT_EXCLUDED_HOSTS = [
	'geocode.arcgis.com',
	'services.arcgis.com',
];

const fetchAsync = async (_url, responseType, _params = {}) => {
	const headers = {};

	const checkUrl = new URL(_url, window.location.origin);
	const shouldExcludeUserAgent = USER_AGENT_EXCLUDED_HOSTS.some((host) => checkUrl.hostname.includes(host));

	// User-Agent handling:
	// - Server mode (with caching proxy): Add User-Agent for all requests except excluded hosts
	// - Static mode (direct requests): Only add User-Agent for api.weather.gov, avoiding CORS preflight issues with other services
	const shouldAddUserAgent = !shouldExcludeUserAgent && (window.WS4KP_SERVER_AVAILABLE || _url.toString().match(/api\.weather\.gov/));
	if (shouldAddUserAgent) {
		headers['user-agent'] = 'Weatherstar 4000+; weatherstar@netbymatt.com';
	}

	// combine default and provided parameters
	const params = {
		method: 'GET',
		mode: 'cors',
		retryCount: 3, // Default to 3 retries for any failed requests (timeout or 5xx server errors)
		timeout: DEFAULT_REQUEST_TIMEOUT,
		..._params,
		headers,
	};

	// rewrite URLs for various services to use the backend proxy server for proper caching (and request logging)
	// relative urls come back from rewriteUrl as strings, resolve them so query parameters can be added below
	const url = new URL(rewriteUrl(_url), window.location.href);
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
	try {
		const response = await doFetch(url, params);

		// check for ok response
		if (!response.ok) {
			const error = new Error(`Fetch error ${response.status} ${response.statusText} while fetching ${response.url}`);
			error.status = response.status;
			throw error;
		}
		// process the response based on type
		let result;
		switch (responseType) {
			case 'json':
				result = await response.json();
				break;
			case 'text':
				result = await response.text();
				break;
			case 'blob':
				result = await response.blob();
				break;
			default:
				result = response;
		}

		// Return both data and URL if requested
		if (params.returnUrl) {
			return {
				data: result,
				url: response.url,
			};
		}

		return result;
	} catch (error) {
		// Enhanced error handling for different error types
		if (error.name === 'AbortError') {
			// AbortError always happens in the browser, regardless of server vs static mode
			// Most likely causes include background tab throttling, user navigation, or client timeout
			console.log(`🛑 Fetch aborted for ${_url} (background tab throttling?)`);
			return null; // Always return null for AbortError instead of throwing
		}
		if (error.name === 'TimeoutError') {
			console.warn(`⏱️  Request timeout for ${_url} (${error.message})`);
		} else if (error.message.includes('502')) {
			console.warn(`🚪 Bad Gateway error for ${_url}`);
		} else if (error.message.includes('503')) {
			console.warn(`⌛ Temporarily unavailable for ${_url}`);
		} else if (error.message.includes('504')) {
			console.warn(`⏱️  Gateway Timeout for ${_url}`);
		} else if (error.message.includes('500')) {
			console.warn(`💥 Internal Server Error for ${_url}`);
		} else if (error.message.includes('CORS') || error.message.includes('Access-Control')) {
			console.warn(`🔒 CORS or Access Control error for ${_url}`);
		} else {
			console.warn(`❌ Fetch failed for ${_url} (${error.message})`);
		}

		// Add standard error properties that calling code expects
		if (!error.status) error.status = 0;
		if (!error.responseJSON) error.responseJSON = null;

		throw error;
	}
};

// names for the server errors that are logged when retrying
const SERVER_ERROR_NAMES = {
	502: 'Bad Gateway',
	503: 'Service Unavailable',
	504: 'Gateway Timeout',
};

// fetch with retry and back-off
// server errors (5xx), network errors and timeouts are retried, an abort by the browser is not
// a server error with no retries left is returned so fetchAsync can report its status
const doFetch = async (url, params) => {
	const retries = Math.max(0, params.retryCount ?? 0);

	for (let attempt = 0; ; attempt += 1) {
		const retriesLeft = retries - attempt;
		let reason;
		try {
			// AbortSignal.timeout() rejects with a TimeoutError, which is kept apart from a browser abort (AbortError)
			// eslint-disable-next-line no-await-in-loop
			const response = await fetch(url, { ...params, signal: AbortSignal.timeout(params.timeout) });
			if (response.status < 500 || retriesLeft <= 0) return response;
			reason = `${SERVER_ERROR_NAMES[response.status] ?? 'Server error'} ${response.status} ${response.statusText}`;
		} catch (error) {
			if (error.name === 'AbortError' || retriesLeft <= 0) throw error;
			reason = error.name === 'TimeoutError' ? `Request timeout after ${Math.round(params.timeout / 1000)}s` : `Network error: ${error.message}`;
		}

		const retryNumber = attempt + 1;
		const delayMs = retryDelay(retryNumber);
		const remaining = retriesLeft - 1;
		console.warn(`🔄 Retry ${retryNumber}/${retries} for ${url} - ${reason} (retrying in ${delayMs}ms, ${remaining} retr${remaining === 1 ? 'y' : 'ies'} left)`);

		// call the "still waiting" function on first retry
		if (retryNumber === 1 && typeof params.stillWaiting === 'function') {
			try {
				params.stillWaiting();
			} catch (callbackError) {
				console.warn(`⚠️ stillWaiting callback error for ${url}:`, callbackError.message);
			}
		}

		// eslint-disable-next-line no-await-in-loop
		await new Promise((resolve) => {
			setTimeout(resolve, delayMs);
		});
	}
};

// delay before each retry, indexed by retry number (retries start at 1)
const retryDelays = [
	1000, // 0th index is not called in code
	1000,
	2000,
	5000,
	10_000,
];

const retryDelay = (step) => retryDelays[step] ?? 30_000;

export {
	json,
	text,
	blob,
	safeJson,
	safePromiseAll,
};

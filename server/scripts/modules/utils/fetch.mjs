import { rewriteUrl } from './url-rewrite.mjs';

// Centralized utilities for handling errors in Promise contexts
const safeJson = async (url, params) => {
	try {
		const result = await json(url, params);
		// Return an object with both data and url if params.returnUrl is true
		if (params?.returnUrl) {
			return result;
		}
		// If caller didn't specify returnUrl, result is the raw API response
		return result;
	} catch (error) {
		// Error already logged in fetchAsync; return null to be "safe"
		return null;
	}
};

const safeText = async (url, params) => {
	try {
		const result = await text(url, params);
		// Return an object with both data and url if params.returnUrl is true
		if (params?.returnUrl) {
			return result;
		}
		// If caller didn't specify returnUrl, result is the raw API response
		return result;
	} catch (error) {
		// Error already logged in fetchAsync; return null to be "safe"
		return null;
	}
};

const safeBlob = async (url, params) => {
	try {
		const result = await blob(url, params);
		// Return an object with both data and url if params.returnUrl is true
		if (params?.returnUrl) {
			return result;
		}
		// If caller didn't specify returnUrl, result is the raw API response
		return result;
	} catch (error) {
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

	if (!shouldExcludeUserAgent) {
		headers['user-agent'] = 'Weatherstar 4000+; weatherstar@netbymatt.com';
	}

	// combine default and provided parameters
	const params = {
		method: 'GET',
		mode: 'cors',
		type: 'GET',
		retryCount: 0,
		timeout: 30000,
		..._params,
		headers,
	};
	// store original number of retries
	params.originalRetries = params.retryCount;

	// rewrite URLs for various services to use the backend proxy server for proper caching (and request logging)
	const url = rewriteUrl(_url);
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
		if (!response.ok) throw new Error(`Fetch error ${response.status} ${response.statusText} while fetching ${response.url}`);
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
			// AbortError is always handled gracefully (background tab throttling)
			console.log(`🛑 Fetch aborted for ${_url} (background tab throttling?)`);
			return null; // Always return null for AbortError instead of throwing
		} if (error.message.includes('502')) {
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

// fetch with retry and back-off
const doFetch = (url, params) => new Promise((resolve, reject) => {
	// Create AbortController for timeout
	const controller = new AbortController();
	const timeoutId = setTimeout(() => {
		controller.abort();
	}, params.timeout);

	// Add signal to fetch params
	const fetchParams = {
		...params,
		signal: controller.signal,
	};

	// Shared retry logic to avoid duplication
	const attemptRetry = (reason) => {
		// Safety check for params
		if (!params || typeof params.retryCount !== 'number' || typeof params.originalRetries !== 'number') {
			console.error(`❌ Invalid params for retry: ${url}`);
			return reject(new Error('Invalid retry parameters'));
		}

		const retryAttempt = params.originalRetries - params.retryCount + 1;
		const remainingRetries = params.retryCount - 1;
		const delayMs = retryDelay(retryAttempt);

		console.warn(`🔄 Retry ${retryAttempt}/${params.originalRetries} for ${url} - ${reason} (retrying in ${delayMs}ms, ${remainingRetries} retries left)`);

		// call the "still waiting" function on first retry
		if (params && params.stillWaiting && typeof params.stillWaiting === 'function' && params.retryCount === params.originalRetries) {
			try {
				params.stillWaiting();
			} catch (callbackError) {
				console.warn(`⚠️ stillWaiting callback error for ${url}:`, callbackError.message);
			}
		}
		// decrement and retry with safe parameter copying
		const newParams = {
			...params,
			retryCount: Math.max(0, params.retryCount - 1), // Ensure retryCount doesn't go negative
		};
		// Use setTimeout directly instead of the delay wrapper to avoid Promise resolution issues
		setTimeout(() => {
			doFetch(url, newParams).then(resolve).catch(reject);
		}, delayMs);
		return undefined; // Explicit return for linter
	};

	fetch(url, fetchParams).then((response) => {
		clearTimeout(timeoutId); // Clear timeout on successful response

		// Retry 500 status codes if we have retries left
		if (params && params.retryCount > 0 && response.status >= 500 && response.status <= 599) {
			let errorType = 'Server error';
			if (response.status === 502) {
				errorType = 'Bad Gateway';
			} else if (response.status === 503) {
				errorType = 'Service Unavailable';
			} else if (response.status === 504) {
				errorType = 'Gateway Timeout';
			}
			return attemptRetry(`${errorType} ${response.status} ${response.statusText}`);
		}

		// Log when we're out of retries for server errors
		// if (response.status >= 500 && response.status <= 599) {
		// 	console.warn(`⚠️ Server error ${response.status} ${response.statusText} for ${url} - no retries remaining`);
		// }

		// successful response or out of retries
		return resolve(response);
	}).catch((error) => {
		clearTimeout(timeoutId); // Clear timeout on error

		// Retry network errors if we have retries left (but not AbortError)
		if (params && params.retryCount > 0 && error.name !== 'AbortError') {
			const reason = error.name === 'TimeoutError' ? 'Request timeout' : `Network error: ${error.message}`;
			return attemptRetry(reason);
		}

		// out of retries or AbortError - reject
		reject(error);
		return undefined; // Explicit return for linter
	});
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
	safeJson,
	safeText,
	safeBlob,
	safePromiseAll,
};

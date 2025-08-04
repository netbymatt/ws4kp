import { rewriteUrl } from './url-rewrite.mjs';

const DEFAULT_REQUEST_TIMEOUT = 15000; // For example, with 3 retries: 15s+1s+15s+2s+15s+5s+15s = 68s

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
	} catch (_error) {
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
	} catch (_error) {
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
	} catch (_error) {
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
		type: 'GET',
		retryCount: 3, // Default to 3 retries for any failed requests (timeout or 5xx server errors)
		timeout: DEFAULT_REQUEST_TIMEOUT,
		..._params,
		headers,
	};

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
			// AbortError always happens in the browser, regardless of server vs static mode
			// Most likely causes include background tab throttling, user navigation, or client timeout
			console.log(`🛑 Fetch aborted for ${_url} (background tab throttling?)`);
			return null; // Always return null for AbortError instead of throwing
		} if (error.name === 'TimeoutError') {
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

// fetch with retry and back-off
const doFetch = (url, params, originalRetryCount = null) => new Promise((resolve, reject) => {
	// On the first call, store the retry count for later logging
	const initialRetryCount = originalRetryCount ?? params.retryCount;

	// Create AbortController for timeout
	const controller = new AbortController();
	const startTime = Date.now();
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
		if (!params || typeof params.retryCount !== 'number') {
			console.error(`❌ Invalid params for retry: ${url}`);
			return reject(new Error('Invalid retry parameters'));
		}

		const retryAttempt = initialRetryCount - params.retryCount + 1;
		const remainingRetries = params.retryCount - 1;
		const delayMs = retryDelay(retryAttempt);

		console.warn(`🔄 Retry ${retryAttempt}/${initialRetryCount} for ${url} - ${reason} (retrying in ${delayMs}ms, ${remainingRetries} retr${remainingRetries === 1 ? 'y' : 'ies'} left)`);

		// call the "still waiting" function on first retry
		if (params && params.stillWaiting && typeof params.stillWaiting === 'function' && retryAttempt === 1) {
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
			doFetch(url, newParams, initialRetryCount).then(resolve).catch(reject);
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

		// Enhance AbortError detection by checking if we're near the timeout duration
		if (error.name === 'AbortError') {
			const duration = Date.now() - startTime;
			const isLikelyTimeout = duration >= (params.timeout - 1000); // Within 1 second of timeout

			// Convert likely timeouts to TimeoutError for better error reporting
			if (isLikelyTimeout) {
				const reason = `Request timeout after ${Math.round(duration / 1000)}s`;
				if (params && params.retryCount > 0) {
					return attemptRetry(reason);
				}
				// Convert to a timeout error for better error reporting
				const timeoutError = new Error(`Request timeout after ${Math.round(duration / 1000)}s`);
				timeoutError.name = 'TimeoutError';
				reject(timeoutError);
				return undefined;
			}
		}

		// Retry network errors if we have retries left
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

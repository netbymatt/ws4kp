/**
 * HTTP cache implementation for API proxy that respects cache-control headers
 * (without external dependencies)
 *
 * Features:
 * - Respects HTTP cache-control headers (s-maxage, max-age)
 * - Heuristic caching based on Last-Modified headers when no explicit cache directives exist
 * - Conditional requests using ETags and If-Modified-Since headers to validate stale content
 * - In-flight request deduplication to prevent multiple simultaneous requests for the same resource
 * - Comprehensive logging with cache hit/miss statistics and timing information
 * - Timeout handling and error recovery mechanisms
 *
 * The cache uses a three-state system:
 * - 'fresh': Content is within its TTL and served immediately
 * - 'stale': Content has expired but can be revalidated with conditional requests (304 Not Modified)
 * - 'miss': No cached content exists
 *
 * @class HttpCache
 */

import https from 'https';

// Default timeout for upstream requests (matches client-side default)
const DEFAULT_REQUEST_TIMEOUT = 15000;

class HttpCache {
	constructor() {
		this.cache = new Map();
		this.inFlight = new Map();
		this.cleanupInterval = null;
		this.startCleanup();
	}

	// Parse cache-control header to extract s-maxage or max-age
	static parseCacheControl(cacheControlHeader) {
		if (!cacheControlHeader) return 0;

		// Look for s-maxage first (preferred for proxy caches), then max-age
		const sMaxAgeMatch = cacheControlHeader.match(/s-maxage=(\d+)/i);
		if (sMaxAgeMatch) {
			return parseInt(sMaxAgeMatch[1], 10);
		}

		const maxAgeMatch = cacheControlHeader.match(/max-age=(\d+)/i);
		if (maxAgeMatch) {
			return parseInt(maxAgeMatch[1], 10);
		}

		return 0; // No cache if no cache directives found
	}

	// Helper method to set filtered headers and our cache policy
	static setFilteredHeaders(res, headers) {
		// Strip cache-related headers and pass through others
		Object.entries(headers || {}).forEach(([key, value]) => {
			const lowerKey = key.toLowerCase();
			// Skip cache-related headers that should be controlled by our proxy
			if (!['cache-control', 'expires', 'etag', 'last-modified'].includes(lowerKey)) {
				res.header(lowerKey, value);
			}
		});

		// Set our own cache policy - short cache to ensure browser checks back with our server
		res.header('cache-control', 'public, max-age=30');
	}

	// Generate cache key from request
	static generateKey(req) {
		const path = req.path || req.url || '/';
		const url = req.url || req.path || '/';

		// Since this cache is intended only by the frontend, we can use a simple URL-based key
		return `${path}${url.includes('?') ? url.substring(url.indexOf('?')) : ''}`;
	}

	// High-level method to handle caching for HTTP proxies
	async handleRequest(req, res, upstreamUrl, options = {}) {
		// Check cache status
		const cacheResult = this.getCachedRequest(req);

		if (cacheResult.status === 'fresh') {
			const cached = cacheResult.data;
			res.status(cached.statusCode);
			HttpCache.setFilteredHeaders(res, cached.headers);
			res.send(cached.data);
			return true; // Indicates cache hit
		}
		// For 'miss' or 'stale', proceed to upstream request

		// Generate cache key for in-flight tracking
		const cacheKey = HttpCache.generateKey(req);

		// Build the full URL
		const queryParams = Object.keys(req.query || {}).reduce((acc, key) => {
			if (options.skipParams && options.skipParams.includes(key)) return acc;
			acc[key] = req.query[key];
			return acc;
		}, {});
		const queryString = new URLSearchParams(queryParams).toString();
		const fullUrl = `${upstreamUrl}${req.path}${queryString ? `?${queryString}` : ''}`;

		// Check if there's already a request in flight for this resource
		if (this.inFlight.has(cacheKey)) {
			console.log(`🛫 Wait     | ${fullUrl} (request already in flight)`);

			// Track when we start waiting for latency measurement
			const waitStartTime = Date.now();

			// Wait for the in-flight request to complete
			try {
				await this.inFlight.get(cacheKey);

				// After waiting, try cache again (should be populated now if the request was successful)
				const key = HttpCache.generateKey(req);
				const cached = this.cache.get(key);

				if (cached && Date.now() <= cached.expiry) {
					const waitLatency = Date.now() - waitStartTime;

					// Log cache hit with wait latency
					const age = Math.round((Date.now() - cached.timestamp) / 1000);
					const remainingTTL = Math.round((cached.expiry - Date.now()) / 1000);
					const url = cached.url || `${upstreamUrl}${req.path}`;
					console.log(`🛬 Continue | ${url} (age: ${age}s, remaining: ${remainingTTL}s, waited: ${waitLatency}ms)`);

					res.status(cached.statusCode);
					HttpCache.setFilteredHeaders(res, cached.headers);
					res.send(cached.data);
					return true; // Served from cache after waiting
				}

				// Fallthrough to make request if cache miss (shouldn't happen but safety net)
				console.warn(`⚠️ Redo     | Cache miss after waiting for in-flight request: ${fullUrl}`);
			} catch (_error) {
				// If the in-flight request failed, we'll make our own request
				console.warn(`⚠️ Redo     | In-flight request failed, making new request: ${fullUrl}`);
			}
		}

		// Create promise for this request
		const requestPromise = this.makeUpstreamRequest(req, res, fullUrl, options, cacheResult);

		// Store a wrapped promise that doesn't reject for waiters - they just need to know when it's done

		const inflightPromise = requestPromise.catch(() => null);
		this.inFlight.set(cacheKey, inflightPromise);

		try {
			// Send the request to the upstream service
			const result = await requestPromise;
			return result;
		} catch (error) {
			// All errors are handled directly by makeUpstreamRequest so this is a safety net
			console.error(`💥 Error    | Unhandled error in handleRequest: ${error.message}`);
			return false;
		} finally {
			// Always clean up the in-flight tracking
			this.inFlight.delete(cacheKey);
		}
	}

	// Make the upstream request, handling caching and conditional requests
	async makeUpstreamRequest(req, res, fullUrl, options = {}, cacheResult = null) {
		return new Promise((resolve) => {
			const headers = {
				'user-agent': options.userAgent || '(WeatherStar 4000+, ws4000@netbymatt.com)',
				accept: req.headers?.accept || '*/*',
				...options.headers,
			};

			// Use the cache result passed from handleRequest (no additional cache call)
			let staleCache = null;

			if (cacheResult && cacheResult.status === 'stale' && cacheResult.data?.originalHeaders) {
				staleCache = cacheResult.data;
				// Add conditional headers based on cached etag or last-modified header
				if (staleCache.originalHeaders.etag) {
					headers['if-none-match'] = staleCache.originalHeaders.etag;
					// console.log(`🏷️ Added   | If-None-Match: ${staleCache.originalHeaders.etag} for ${fullUrl}`);
				} else if (staleCache.originalHeaders['last-modified']) {
					headers['if-modified-since'] = staleCache.originalHeaders['last-modified'];
					// console.log(`📅 Added   | If-Modified-Since: ${staleCache.originalHeaders['last-modified']} for ${fullUrl}`);
				}
			}

			let responseHandled = false; // Track if we've already sent a response

			const upstreamReq = https.get(fullUrl, { headers }, (getRes) => {
				const { statusCode } = getRes;

				// Handle 304 Not Modified responses - refresh stale cache and serve
				if (statusCode === 304) {
					if (responseHandled) return; // Prevent double response
					responseHandled = true;

					if (staleCache) {
						const newCacheControl = getRes.headers['cache-control'];
						const newMaxAge = HttpCache.parseCacheControl(newCacheControl);
						if (newMaxAge > 0) {
							staleCache.expiry = Date.now() + (newMaxAge * 1000);
							staleCache.timestamp = Date.now(); // Reset age counter for 304 refresh
							console.log(`〰️ NoChange | ${fullUrl} (got 304 Not Modified; refreshing cache expiry by ${newMaxAge}s)`);
						} else {
							console.log(`📉 NoCache  | ${fullUrl} (no valid cache directives in 304, not updating expiry)`);
						}

						res.status(staleCache.statusCode);
						HttpCache.setFilteredHeaders(res, staleCache.headers);
						res.send(staleCache.data);
						resolve(true); // Cache hit after 304 validation
						return;
					}
					// No stale entry for 304 response (this shouldn't happen!)
					console.error(`💥 Error    | 304 response but no stale cache entry for ${fullUrl}`);
					res.status(500).json({ error: 'Cache inconsistency error' });
					resolve(false); // Error handled, response sent
					return;
				}

				// Helper function to handle response after data collection
				const handleResponse = (data) => {
					if (responseHandled) return; // Prevent double response
					responseHandled = true;

					// Log HTTP error status codes
					if (statusCode >= 400) {
						console.error(`🚫 ${statusCode}      | ${fullUrl}`);
					}

					// Filter out cache headers before storing - we don't need them in our cache
					const filteredHeaders = {};
					Object.entries(getRes.headers || {}).forEach(([key, value]) => {
						const lowerKey = key.toLowerCase();
						if (!['cache-control', 'expires', 'etag', 'last-modified'].includes(lowerKey)) {
							filteredHeaders[key] = value;
						}
					});

					const response = {
						statusCode,
						headers: filteredHeaders,
						data,
					};

					// Check if this is a server error (5xx) or client error that shouldn't be cached
					if (statusCode >= 500 && statusCode <= 599) {
						// For 5xx errors, send response (don't cache, but don't reject since response is sent)
						res.status(statusCode);
						HttpCache.setFilteredHeaders(res, getRes.headers);
						res.send(response.data);
						resolve(false); // Error response sent successfully
						return;
					}

					// For 4xx errors, don't cache but send the response
					if (statusCode >= 400 && statusCode <= 499) {
						res.status(statusCode);
						HttpCache.setFilteredHeaders(res, getRes.headers);
						res.send(response.data);
						resolve(true); // Successful HTTP transaction (client error, but valid response; don't retry)
						return;
					}

					// Store in cache (pass original headers for cache logic, but store filtered headers)
					this.storeCachedResponse(req, response, fullUrl, getRes.headers);

					// Send response to client
					res.status(statusCode);

					// Set filtered headers and our cache policy
					HttpCache.setFilteredHeaders(res, getRes.headers);

					res.send(response.data);
					resolve(true); // Indicates successful response from upstream
				};

				if (options.encoding === 'binary') {
					// For binary data, collect as Buffer chunks
					const chunks = [];
					getRes.on('data', (chunk) => chunks.push(chunk));
					getRes.on('end', () => handleResponse(Buffer.concat(chunks)));
					getRes.on('error', (err) => {
						if (responseHandled) return;
						responseHandled = true;
						console.error(`💥 Error    | with stream ${fullUrl}: ${err.message}`);
						res.status(500).json({ error: `Stream error: ${err.message}` });
						resolve(false); // Error handled, response sent
					});
				} else {
					// For text data, use string encoding
					let data = '';
					getRes.setEncoding(options.encoding || 'utf8');
					getRes.on('data', (chunk) => {
						data += chunk;
					});
					getRes.on('end', () => handleResponse(data));
					getRes.on('error', (err) => {
						if (responseHandled) return;
						responseHandled = true;
						console.error(`💥 Error    | with stream ${fullUrl}: ${err.message}`);
						res.status(500).json({ error: `Stream error: ${err.message}` });
						resolve(false); // Error handled, response sent
					});
				}
			});

			upstreamReq.on('error', (err) => {
				if (responseHandled) return; // Prevent double response
				responseHandled = true;
				console.error(`💥 Error    | ${fullUrl}: ${err.message}`);
				res.status(500).json({ error: `Failed to fetch data from ${options.serviceName || 'upstream API'}` });
				resolve(false); // Error handled, response sent
			});

			upstreamReq.setTimeout(options.timeout || DEFAULT_REQUEST_TIMEOUT, () => {
				if (responseHandled) return; // Prevent double response
				responseHandled = true;

				console.error(`⏲️ Timeout  | ${fullUrl} (after ${options.timeout || DEFAULT_REQUEST_TIMEOUT}ms)`);

				// Send timeout response to client
				res.status(504).json({ error: 'Gateway timeout' });

				// Don't destroy the request immediately - let the response be sent first
				// Then destroy to clean up the upstream connection
				setImmediate(() => {
					if (!upstreamReq.destroyed) {
						upstreamReq.destroy();
					}
				});

				resolve(false); // Timeout handled, response sent
			});
		});
	}

	getCachedRequest(req) {
		const key = HttpCache.generateKey(req);
		const cached = this.cache.get(key);

		if (!cached) {
			return { status: 'miss', data: null };
		}

		const isExpired = Date.now() > cached.expiry;

		// If fresh, return immediately
		if (!isExpired) {
			const age = Math.round((Date.now() - cached.timestamp) / 1000);
			const remainingTTL = Math.round((cached.expiry - Date.now()) / 1000);
			console.log(`🎯 Hit      | ${cached.url} (age: ${age}s, remaining: ${remainingTTL}s)`);
			return { status: 'fresh', data: cached };
		}

		// If stale, return for potential conditional request
		// const staleAge = Math.round((Date.now() - cached.expiry) / 1000);
		// console.log(`🕐 Stale    | ${cached.url} (expired ${staleAge}s ago, will check upstream)`);
		return { status: 'stale', data: cached };
	}

	storeCachedResponse(req, response, url, originalHeaders) {
		const key = HttpCache.generateKey(req);

		const cacheControl = (originalHeaders || {})['cache-control'];
		let maxAge = HttpCache.parseCacheControl(cacheControl);
		let cacheType = '';

		// If no explicit cache directives, try heuristic caching for Last-Modified
		if (maxAge <= 0) {
			const lastModified = (originalHeaders || {})['last-modified'];
			if (lastModified) {
				maxAge = HttpCache.calculateHeuristicMaxAge(lastModified);
				cacheType = 'heuristic';
			}
		} else {
			cacheType = 'explicit';
		}

		// Don't cache if still no valid max-age
		if (maxAge <= 0) {
			console.log(`📤 Sent     | ${url} (no cache directives; not cached)`);
			return;
		}

		const cached = {
			statusCode: response.statusCode,
			headers: { ...(response.headers || {}) },
			data: response.data,
			expiry: Date.now() + (maxAge * 1000),
			timestamp: Date.now(),
			url, // Store the URL for logging
			originalHeaders: { // Store original headers for conditional requests
				etag: (originalHeaders || {}).etag,
				'last-modified': (originalHeaders || {})['last-modified'],
			},
		};

		this.cache.set(key, cached);

		console.log(`🌐 Add      | ${url} (${cacheType} ${maxAge}s TTL, expires: ${new Date(cached.expiry).toISOString()})`);
	}

	// Calculate heuristic max-age based on Last-Modified header
	// RFC 7234: A cache can use heuristic freshness calculation
	// Common heuristic: 10% of the age of the resource, with limits
	static calculateHeuristicMaxAge(lastModifiedHeader) {
		try {
			const lastModified = new Date(lastModifiedHeader);
			const now = new Date();
			const age = (now.getTime() - lastModified.getTime()) / 1000; // age in seconds

			if (age <= 0) return 0;

			// Use 10% of age, but limit between 1 hour and 4 hours
			const heuristicAge = Math.floor(age * 0.1);
			const minAge = 60 * 60; // 1 hour
			const maxAge = 4 * 60 * 60; // 4 hours

			return Math.max(minAge, Math.min(maxAge, heuristicAge));
		} catch (_error) {
			return 0; // Invalid date format
		}
	}

	// Periodic cleanup of expired entries
	startCleanup() {
		if (this.cleanupInterval) return;

		this.cleanupInterval = setInterval(() => {
			const now = Date.now();
			let removedCount = 0;

			Array.from(this.cache.entries()).forEach(([key, cached]) => {
				// Allow stale entries to persist for up to 3 hours before cleanup
				// This gives us time to make conditional requests and potentially refresh them
				const staleTimeLimit = 3 * 60 * 60 * 1000;
				if (now > cached.expiry + staleTimeLimit) {
					this.cache.delete(key);
					removedCount += 1;
				}
			});

			if (removedCount > 0) {
				console.log(`🧹 Clean    | Removed ${removedCount} stale entries (${this.cache.size} remaining)`);
			}
		}, 5 * 60 * 1000); // Cleanup every 5 minutes
	}

	// Cache statistics
	getStats() {
		const now = Date.now();
		let expired = 0;
		let valid = 0;

		Array.from(this.cache.values()).forEach((cached) => {
			if (now > cached.expiry) {
				expired += 1;
			} else {
				valid += 1;
			}
		});

		return {
			total: this.cache.size,
			valid,
			expired,
			inFlight: this.inFlight.size,
		};
	}

	// Clear all cache entries
	clear() {
		this.cache.clear();
		console.log('🗑️ Clear    | Cache cleared');
	}

	// Clear a specific cache entry by path
	clearEntry(path) {
		const key = path;
		const deleted = this.cache.delete(key);
		if (deleted) {
			console.log(`🗑️ Clear    | ${path} removed from cache`);
			return true;
		}
		return false;
	}

	// Stop cleanup interval
	destroy() {
		if (this.cleanupInterval) {
			clearInterval(this.cleanupInterval);
			this.cleanupInterval = null;
		}
		this.clear();
		this.inFlight.clear();
	}
}

// Create singleton instance of our cache
const cache = new HttpCache();

export default cache;

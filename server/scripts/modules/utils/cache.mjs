import { rewriteUrl } from './url-rewrite.mjs';

// Clear cache utility for client-side use
const clearCacheEntry = async (url, baseUrl = '') => {
	try {
		// Rewrite the URL to get the local proxy path
		const rewrittenUrl = rewriteUrl(url);
		const urlObj = typeof rewrittenUrl === 'string' ? new URL(rewrittenUrl, baseUrl || window.location.origin) : rewrittenUrl;
		let cachePath = urlObj.pathname + urlObj.search;

		// Strip the route designator (first path segment) to match actual cache keys
		const firstSlashIndex = cachePath.indexOf('/', 1); // Find second slash
		if (firstSlashIndex > 0) {
			cachePath = cachePath.substring(firstSlashIndex);
		}

		// Call the cache clear endpoint
		const fetchUrl = baseUrl ? `${baseUrl}/cache${cachePath}` : `/cache${cachePath}`;
		const response = await fetch(fetchUrl, {
			method: 'DELETE',
		});

		if (response.ok) {
			const result = await response.json();
			if (result.cleared) {
				console.log(`🗑️ Cleared cache entry: ${cachePath}`);
				return true;
			}
			console.log(`🔍 Cache entry not found: ${cachePath}`);
			return false;
		}
		console.warn(`⚠️ Failed to clear cache entry: ${response.status} ${response.statusText}`);
		return false;
	} catch (error) {
		console.error(`❌ Error clearing cache entry for ${url}:`, error.message);
		return false;
	}
};

export default clearCacheEntry;

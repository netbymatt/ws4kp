import { blob } from './fetch.mjs';

// preload an image
// the goal is to get it in the browser's cache so it is available more quickly when the browser needs it
// a list of cached icons is used to avoid hitting the cache multiple times
const cachedImages = new Set();
const preloadImg = (src) => {
	if (!src || typeof src !== 'string') {
		console.warn(`preloadImg expects a URL string, received: '${src}' (${typeof src})`);
		return false;
	}

	if (cachedImages.has(src)) return false;
	cachedImages.add(src);
	blob(src).catch(() => {
		// the fetch helper has already logged the failure, forget the image so a later call can try again
		cachedImages.delete(src);
	});
	return true;
};

export default preloadImg;

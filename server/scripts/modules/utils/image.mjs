import { blob } from './fetch.mjs';

// preload an image
// the goal is to get it in the browser's cache so it is available more quickly when the browser needs it
// a list of cached icons is used to avoid hitting the cache multiple times
const cachedImages = [];
const preloadImg = (src) => {
	if (cachedImages.includes(src)) return false;
	blob(src);
	cachedImages.push(src);
	return true;
};

export {
	// eslint-disable-next-line import/prefer-default-export
	preloadImg,
};

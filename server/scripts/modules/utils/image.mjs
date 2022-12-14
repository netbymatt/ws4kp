import { blob } from './fetch.mjs';
import { rewriteUrl } from './cors.mjs';

// ****************************** load images *********************************
// load an image from a blob or url
const loadImg = (imgData, cors = false) => new Promise((resolve) => {
	const img = new Image();
	img.onload = (e) => {
		resolve(e.target);
	};
	if (imgData instanceof Blob) {
		img.src = window.URL.createObjectURL(imgData);
	} else {
		let url = imgData;
		if (cors) url = rewriteUrl(imgData);
		img.src = url;
	}
});

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
	loadImg,
	preloadImg,
};

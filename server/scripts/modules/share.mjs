import { elemForEach } from './utils/elem.mjs';
import Setting from './utils/setting.mjs';

document.addEventListener('DOMContentLoaded', () => init());

// array of settings that are not checkboxes or dropdowns (i.e. volume slider)
const hiddenSettings = [];

const init = () => {
	// add action to existing link
	const shareLink = document.querySelector('#share-link');
	shareLink.addEventListener('click', createLink);

	// if navigator.clipboard does not exist, change text
	if (!navigator?.clipboard) {
		shareLink.textContent = 'Get Permalink';
	}
};

const createLink = async (e) => {
	// cancel default event (click on hyperlink)
	e.preventDefault();

	// list to receive checkbox statuses
	const queryStringElements = {};

	elemForEach('input[type=checkbox]', (elem) => {
		if (elem?.id) {
			queryStringElements[elem.id] = elem?.checked ?? false;
		}
	});

	// get all select boxes
	elemForEach('select', (elem) => {
		if (elem?.id) {
			queryStringElements[elem.id] = encodeURIComponent(elem?.value ?? '');
		}
	});

	// get all text boxes
	elemForEach('input[type=text]', ((elem) => {
		if (elem?.id) {
			queryStringElements[elem.id] = elem?.value ?? 0;
		}
	}));

	// get any hidden settings
	hiddenSettings.forEach((setting) => {
		// determine type
		if (setting.value instanceof Setting) {
			queryStringElements[setting.name] = setting.value.value;
		} else if (typeof setting.value === 'function') {
			queryStringElements[setting.name] = setting.value();
		}
	});

	const queryString = (new URLSearchParams(queryStringElements)).toString();

	const url = new URL(`?${queryString}`, document.location.href);

	// send to proper function based on availability of clipboard
	if (navigator?.clipboard) {
		copyToClipboard(url);
	} else {
		writeLinkToPage(url);
	}
};

const copyToClipboard = async (url) => {
	try {
		// write to clipboard
		await navigator.clipboard.writeText(url.toString());
		// alert user
		const confirmSpan = document.querySelector('#share-link-copied');
		confirmSpan.style.display = 'inline';

		// hide confirm text after 5 seconds
		setTimeout(() => {
			confirmSpan.style.display = 'none';
		}, 5000);
	} catch (error) {
		console.error(error);
	}
};

const writeLinkToPage = (url) => {
	// get elements
	const shareLinkInstructions = document.querySelector('#share-link-instructions');
	const shareLinkUrl = shareLinkInstructions.querySelector('#share-link-url');
	// populate url and display
	shareLinkUrl.value = url;
	shareLinkInstructions.style.display = 'inline';
	// highlight for convenience
	shareLinkUrl.focus();
	shareLinkUrl.select();
};

const registerHiddenSetting = (name, value) => {
	// name is the id of the element
	// value can be a function that returns the current value of the setting
	// or an instance of Setting
	hiddenSettings.push({
		name,
		value,
	});
};

export {
	createLink,
	registerHiddenSetting,
};

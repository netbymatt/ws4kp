import elemForEach from './utils/elem-for-each.mjs';
import Setting from './utils/setting.mjs';
import announce from './utils/announce.mjs';

document.addEventListener('DOMContentLoaded', () => init());

// array of settings that are not checkboxes or dropdowns (i.e. volume slider)
const hiddenSettings = [];

const init = () => {
	// add action to existing button
	const shareLink = document.querySelector('#share-link');
	shareLink.addEventListener('click', createLink);

	// if navigator.clipboard does not exist, change text
	if (!navigator?.clipboard) {
		shareLink.textContent = 'Get Permalink';
	}

	// refresh the displayed link each time the share tab is opened
	document.querySelector('#tab-panel-share')?.addEventListener('tab-shown', showLink);
};

const buildLink = () => {
	// list to receive checkbox statuses
	const queryStringElements = {};

	const captureField = (selector, getValue) => {
		elemForEach(selector, (elem) => {
			const key = elem?.name ?? elem?.id;
			if (key) queryStringElements[key] = getValue(elem);
		});
	};
	captureField('input[type=checkbox]', (elem) => elem?.checked ?? false);
	captureField('select', (elem) => elem?.value ?? '');
	captureField('#settings input[type=text]', (elem) => elem?.value ?? '');

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

	return new URL(`?${queryString}`, document.location.href);
};

// write the current link to the read-only box on the share tab
const showLink = () => {
	const url = buildLink();
	document.querySelector('#share-link-url').value = url;
	return url;
};

const createLink = (e) => {
	// cancel default event
	e.preventDefault();

	const url = showLink();

	// send to proper function based on availability of clipboard
	if (navigator?.clipboard) {
		copyToClipboard(url);
	} else {
		selectLink();
	}
};

const copyToClipboard = async (url) => {
	try {
		// write to clipboard
		await navigator.clipboard.writeText(url.toString());
		// tell the user, the text clears after 5 seconds
		announce(document.querySelector('#share-link-copied'), 'Link copied to clipboard!');
	} catch (error) {
		console.error(error);
		selectLink();
	}
};

// highlight the link so it can be copied by hand
const selectLink = () => {
	const shareLinkUrl = document.querySelector('#share-link-url');
	shareLinkUrl.focus();
	shareLinkUrl.select();
};

const registerHiddenSetting = (name, value) => {
	// value can be a function that returns the current value of the setting
	// or an instance of Setting
	hiddenSettings.push({
		name,
		value,
	});
};

export {
	// eslint-disable-next-line import-x/prefer-default-export
	registerHiddenSetting,
};

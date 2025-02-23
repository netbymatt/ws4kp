document.addEventListener('DOMContentLoaded', () => init());

// shorthand mappings for frequently used values
const specialMappings = {
	kiosk: 'settings-kiosk-checkbox',
};

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
	// get all checkboxes on page
	const checkboxes = document.querySelectorAll('input[type=checkbox]');

	// list to receive checkbox statuses
	const queryStringElements = {};

	[...checkboxes].forEach((elem) => {
		if (elem?.id) {
			queryStringElements[elem.id] = elem?.checked ?? false;
		}
	});

	// get all select boxes
	const selects = document.querySelectorAll('select');
	[...selects].forEach((elem) => {
		if (elem?.id) {
			queryStringElements[elem.id] = elem?.value ?? 0;
		}
	});

	// add the location string
	queryStringElements.latLonQuery = localStorage.getItem('latLonQuery');
	queryStringElements.latLon = localStorage.getItem('latLon');

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

const parseQueryString = () => {
	// return memoized result
	if (parseQueryString.params) return parseQueryString.params;
	const urlSearchParams = new URLSearchParams(window.location.search);

	// turn into an array of key-value pairs
	const paramsArray = [...urlSearchParams];

	// add additional expanded keys
	paramsArray.forEach((paramPair) => {
		const expandedKey = specialMappings[paramPair[0]];
		if (expandedKey) {
			paramsArray.push([expandedKey, paramPair[1]]);
		}
	});

	// memoize result
	parseQueryString.params = Object.fromEntries(paramsArray);

	return parseQueryString.params;
};

export {
	createLink,
	parseQueryString,
};

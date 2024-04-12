document.addEventListener('DOMContentLoaded', () => init());

// shorthand mappings for frequently used values
const specialMappings = {
	kiosk: 'settings-kiosk-checkbox',
};

const init = () => {
	// add action to existing link
	document.querySelector('#share-link').addEventListener('click', createLink);
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

	// add the location string
	queryStringElements.latLonQuery = localStorage.getItem('latLonQuery');
	queryStringElements.latLon = localStorage.getItem('latLon');

	const queryString = (new URLSearchParams(queryStringElements)).toString();

	const url = new URL(`?${queryString}`, document.location.href);

	try {
		await navigator.clipboard.writeText(url.toString());
		const confirmSpan = document.querySelector('#share-link-copied');
		confirmSpan.style.display = 'inline';
		setTimeout(() => {
			confirmSpan.style.display = 'none';
		}, 5000);
	} catch (error) {
		console.error(error);
	}
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

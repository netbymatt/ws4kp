document.addEventListener('DOMContentLoaded', () => init());

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

	console.log(queryStringElements);
	console.log(queryString);
	console.log(url.toString());
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
	// memoize result
	parseQueryString.params = Object.fromEntries(urlSearchParams.entries());
	return parseQueryString.params;
};

export {
	createLink,
	parseQueryString,
};

document.addEventListener('DOMContentLoaded', () => init());

const init = () => {
	// add action to existing link
	document.querySelector('#share-link').addEventListener('click', createLink);
};

const createLink = (e) => {
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
	queryStringElements.txtAddress = document.querySelector('#txtAddress')?.value ?? '';

	const queryString = (new URLSearchParams(queryStringElements)).toString();

	const url = new URL(`?${queryString}`, document.location.href);

	console.log(queryStringElements);
	console.log(queryString);
	console.log(url.toString());
};

const readLink = false;

export {
	createLink,
	readLink,
};

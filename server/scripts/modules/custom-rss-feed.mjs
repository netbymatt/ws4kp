import Setting from './utils/setting.mjs';
import { reset as resetScroll, addScreen as addScroll, hazards } from './currentweatherscroll.mjs';
import { json } from './utils/fetch.mjs';

let firstRun = true;

const parser = new DOMParser();

// change of enable handler
const changeEnable = (newValue) => {
	let newDisplay;
	if (newValue) {
		// add the feed to the scroll
		parseFeed(customFeed.value);
		// show the string box
		newDisplay = 'block';
	} else {
		// set scroll back to original
		resetScroll();
		// hide the string entry
		newDisplay = 'none';
	}
	const stringEntry = document.getElementById('settings-customFeed-label');
	if (stringEntry) {
		stringEntry.style.display = newDisplay;
	}
};

// parse the feed/text provided
const parseFeed = (textInput) => {
	// skip getting the feed on first run
	if (firstRun) return;

	// test validity
	if (textInput === undefined || textInput === '') {
		resetScroll();
	}

	// test for url
	if (textInput.match(/https?:\/\//)) {
		getFeed(textInput);
		return;
	}

	// add single text scroll after hazards if present
	resetScroll();
	addScroll(hazards);
	addScroll(
		() => (
			{
				type: 'scroll',
				text: textInput,
			}),
		// keep the existing scroll
		true,
	);
};

// get the rss feed and then swap out the current weather scroll
const getFeed = async (url) => {
	// get the text as a string
	// it needs to be proxied, use a free service
	const rssResponse = await json(`https://api.allorigins.win/get?url=${url}`);

	// this returns a data url
	// a few sanity checks
	if (rssResponse.status.content_type.indexOf('xml') < 0) return;
	// determine return type
	const isBase64 = rssResponse.status.content_type.substring(0, 8) !== 'text/xml';

	// base 64 decode everything after the comma
	const rss = isBase64 ? atob(rssResponse.contents.split('base64,')[1]) : rssResponse.contents;

	// parse the rss
	const doc = parser.parseFromString(rss, 'text/xml');

	// get the title
	const rssTitle = doc.querySelector('channel title').textContent;

	// get each item
	const titles = [...doc.querySelectorAll('item title')].map((t) => t.textContent);

	// reset the scroll, then add the screens
	resetScroll();
	// add the hazards scroll first
	addScroll(hazards);
	titles.forEach((title) => {
		// data is provided to the screen handler, so we return a function
		addScroll(
			() => ({
				header: rssTitle,
				type: 'scroll',
				text: title,
			}),
			// false parameter does not include the default weather scrolls
			false,
		);
	});
};

// change the feed source and re-load if necessary
const changeFeed = (newValue) => {
	// first pass through won't have custom feed enable ready
	if (firstRun) return;

	if (customFeedEnable.value) {
		parseFeed(newValue);
	}
};

const customFeed = new Setting('customFeed', {
	name: 'Custom RSS Feed',
	defaultValue: '',
	type: 'string',
	changeAction: changeFeed,
	placeholder: 'Text or URL',
});

const customFeedEnable = new Setting('customFeedEnable', {
	name: 'Enable RSS Feed/Text',
	defaultValue: false,
	changeAction: changeEnable,
});

// initialize the custom feed inputs on the page
document.addEventListener('DOMContentLoaded', () => {
	// add the controls to the page
	const settingsSection = document.querySelector('#settings');
	settingsSection.append(customFeedEnable.generate(), customFeed.generate());
	// clear the first run value
	firstRun = false;
	// call change enable with the current value to show/hide the url box
	// and make the call to get the feed if enabled
	changeEnable(customFeedEnable.value);
});

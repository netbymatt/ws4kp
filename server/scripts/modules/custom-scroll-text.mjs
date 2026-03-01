import Setting from './utils/setting.mjs';
import { reset as resetScroll, addScreen as addScroll, hazards } from './currentweatherscroll.mjs';

let firstRun = true;

const parser = new DOMParser();

// change of enable handler
const changeEnable = (newValue) => {
	let newDisplay;
	if (newValue) {
		// add the text to the scroll
		parseText(customText.value);
		// show the string box
		newDisplay = 'block';
	} else {
		// set scroll back to original
		resetScroll();
		// hide the string entry
		newDisplay = 'none';
	}
	const stringEntry = document.getElementById('settings-customText-label');
	if (stringEntry) {
		stringEntry.style.display = newDisplay;
	}
};

// parse the text provided
const parseText = (textInput) => {
	// skip updating text on first run
	if (firstRun) return;

	// test validity
	if (textInput === undefined || textInput === '') {
		resetScroll();
	}

	// split the text at pipe characters
	const texts = textInput.split('|');

	// add single text scroll after hazards if present
	resetScroll();
	addScroll(hazards);
	addScroll(
		() => {
			// pick a random string from the available list
			const randInt = Math.floor(Math.random() * texts.length);
			return {
				type: 'scroll',
				text: texts[randInt],
			};
		},
		// keep the existing scroll
		true,
	);
};

// change the text
const changeText = (newValue) => {
	// first pass through won't have custom text enable ready
	if (firstRun) return;

	if (customTextEnable.value) {
		parseText(newValue);
	}
};

const customText = new Setting('customText', {
	name: 'Custom Text',
	defaultValue: '',
	type: 'string',
	changeAction: changeText,
	placeholder: 'Text to scroll',
});

const customTextEnable = new Setting('customTextEnable', {
	name: 'Enable Custom Text',
	defaultValue: false,
	changeAction: changeEnable,
});

// initialize the custom text inputs on the page
document.addEventListener('DOMContentLoaded', () => {
	// add the controls to the page
	const settingsSection = document.querySelector('#settings');
	settingsSection.append(customTextEnable.generate(), customText.generate());
	// clear the first run value
	firstRun = false;
	// call change enable with the current value to show/hide the url box
	changeEnable(customTextEnable.value);
});

import Setting from './utils/setting.mjs';

document.addEventListener('DOMContentLoaded', () => {
	init();
});

const settings = {};

const init = () => {
	// create settings
	settings.wide = new Setting('wide', 'Widescreen', 'boolean', false, wideScreenChange);

	// generate checkboxes
	const checkboxes = Object.values(settings).map((d) => d.generateCheckbox());

	// write to page
	const settingsSection = document.querySelector('#settings');
	settingsSection.innerHTML = '';
	settingsSection.append(...checkboxes);
};

const wideScreenChange = (value) => {
	const container = document.querySelector('#divTwc');
	if (value) {
		container.classList.add('wide');
	} else {
		container.classList.remove('wide');
	}
};

export default settings;

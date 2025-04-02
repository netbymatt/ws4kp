import Setting from './utils/setting.mjs';

document.addEventListener('DOMContentLoaded', () => {
	init();
});

// default speed
const settings = { speed: { value: 1.0 } };

const init = () => {
	// create settings
	settings.wide = new Setting('wide', 'Widescreen', 'checkbox', false, wideScreenChange, true);
	settings.kiosk = new Setting('kiosk', 'Kiosk', 'checkbox', false, kioskChange, false);
	settings.speed = new Setting('speed', 'Speed', 'select', 1.0, null, true, [
		[0.5, 'Very Fast'],
		[0.75, 'Fast'],
		[1.0, 'Normal'],
		[1.25, 'Slow'],
		[1.5, 'Very Slow'],
	]);
	settings.units = new Setting('units', 'Units', 'select', 'us', unitChange, true, [
		['us', 'US'],
		['si', 'Metric'],
	]);
	settings.refreshTime = new Setting('refreshTime', 'Refresh Time', 'select', 30_000, null, false, [
		[30_000, 'TESTING'],
		[300_000, '5 minutes'],
		[600_000, '10 minutes'],
		[900_000, '15 minutes'],
		[1_800_000, '30 minutes'],
	]);

	// generate html objects
	const settingHtml = Object.values(settings).map((d) => d.generate());

	// write to page
	const settingsSection = document.querySelector('#settings');
	settingsSection.innerHTML = '';
	settingsSection.append(...settingHtml);
};

const wideScreenChange = (value) => {
	const container = document.querySelector('#divTwc');
	if (value) {
		container.classList.add('wide');
	} else {
		container.classList.remove('wide');
	}
};

const kioskChange = (value) => {
	const body = document.querySelector('body');
	if (value) {
		body.classList.add('kiosk');
		window.dispatchEvent(new Event('resize'));
	} else {
		body.classList.remove('kiosk');
	}
};

const unitChange = () => {
	// reload the data at the top level to refresh units
	// after the initial load
	if (unitChange.firstRunDone) {
		window.location.reload();
	}
	unitChange.firstRunDone = true;
};

export default settings;

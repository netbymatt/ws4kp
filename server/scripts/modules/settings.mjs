import Setting from './utils/setting.mjs';
import { registerHiddenSetting } from './share.mjs';

// Initialize settings immediately so other modules can access them
const settings = { speed: { value: 1.0 } };

// Track settings that need DOM changes after early initialization
const deferredDomSettings = new Set();

// don't show checkboxes for these settings
const hiddenSettings = [
	'scanLines',
];

// Declare change functions first, before they're referenced in init() to avoid the Temporal Dead Zone (TDZ)
const wideScreenChange = (value) => {
	const container = document.querySelector('#divTwc');
	if (!container) {
		// DOM not ready; defer enabling if set
		if (value) {
			deferredDomSettings.add('wide');
		}
		return;
	}

	if (value) {
		container.classList.add('wide');
	} else {
		container.classList.remove('wide');
	}
	// Trigger resize to recalculate scaling for new width
	window.dispatchEvent(new Event('resize'));
};

const kioskChange = (value) => {
	const body = document.querySelector('body');
	if (!body) {
		// DOM not ready; defer enabling if set
		if (value) {
			deferredDomSettings.add('kiosk');
		}
		return;
	}

	if (value) {
		body.classList.add('kiosk');
		window.dispatchEvent(new Event('resize'));
	} else {
		body.classList.remove('kiosk');
		window.dispatchEvent(new Event('resize'));
	}

	// Conditionally store the kiosk setting based on the "Sticky Kiosk" setting
	// (Need to check if the method exists to handle initialization race condition)
	if (settings.kiosk?.conditionalStoreToLocalStorage) {
		settings.kiosk.conditionalStoreToLocalStorage(value, settings.stickyKiosk?.value);
	}
};

const scanLineChange = (value) => {
	const container = document.getElementById('container');
	const navIcons = document.getElementById('ToggleScanlines');

	if (!container || !navIcons) {
		// DOM not ready; defer enabling if set
		if (value) {
			deferredDomSettings.add('scanLines');
		}
		return;
	}

	const modeSelect = document.getElementById('settings-scanLineMode-label');

	if (value) {
		container.classList.add('scanlines');
		navIcons.classList.add('on');
		modeSelect?.style?.removeProperty('display');
	} else {
		// Remove all scanline classes
		container.classList.remove('scanlines', 'scanlines-auto', 'scanlines-fine', 'scanlines-normal', 'scanlines-thick', 'scanlines-classic', 'scanlines-retro');
		navIcons.classList.remove('on');
		if (modeSelect) {
			modeSelect.style.display = 'none';
		}
	}
};

const scanLineModeChange = (_value) => {
	// Only apply if scanlines are currently enabled
	if (settings.scanLines?.value) {
		// Call the scanline update function directly with current scale
		if (typeof window.applyScanlineScaling === 'function') {
			// Get current scale from navigation module or use 1.0 as fallback
			const scale = window.currentScale || 1.0;
			window.applyScanlineScaling(scale);
		}
	}
};

// Simple global helper to change scanline mode when remote debugging or in kiosk mode
window.changeScanlineMode = (mode) => {
	if (typeof settings === 'undefined' || !settings.scanLineMode) {
		console.error('Settings system not available');
		return false;
	}

	const validModes = ['auto', 'thin', 'medium', 'thick'];
	if (!validModes.includes(mode)) {
		return false;
	}

	settings.scanLineMode.value = mode;
	return true;
};

const unitChange = () => {
	// reload the data at the top level to refresh units
	// after the initial load
	if (unitChange.firstRunDone) {
		window.location.reload();
	}
	unitChange.firstRunDone = true;
};

const init = () => {
	// create settings see setting.mjs for defaults
	settings.wide = new Setting('wide', {
		name: 'Widescreen',
		defaultValue: false,
		changeAction: wideScreenChange,
		sticky: true,
	});
	settings.kiosk = new Setting('kiosk', {
		name: 'Kiosk',
		defaultValue: false,
		changeAction: kioskChange,
		sticky: false,
		stickyRead: true,
	});
	settings.stickyKiosk = new Setting('stickyKiosk', {
		name: 'Sticky Kiosk',
		defaultValue: false,
		sticky: true,
	});
	settings.speed = new Setting('speed', {
		name: 'Speed',
		type: 'select',
		defaultValue: 1.0,
		values: [
			[0.5, 'Very Fast'],
			[0.75, 'Fast'],
			[1.0, 'Normal'],
			[1.25, 'Slow'],
			[1.5, 'Very Slow'],
		],
	});
	settings.scanLines = new Setting('scanLines', {
		name: 'Scan Lines',
		defaultValue: false,
		changeAction: scanLineChange,
		sticky: true,
	});
	settings.scanLineMode = new Setting('scanLineMode', {
		name: 'Scan Line Style',
		type: 'select',
		defaultValue: 'auto',
		changeAction: scanLineModeChange,
		sticky: true,
		values: [
			['auto', 'Auto (Adaptive)'],
			['thin', 'Thin (1x)'],
			['medium', 'Medium (2x)'],
			['thick', 'Thick (3x)'],
		],
	});
	settings.units = new Setting('units', {
		name: 'Units',
		type: 'select',
		defaultValue: 'us',
		changeAction: unitChange,
		values: [
			['us', 'US'],
			['si', 'Metric'],
		],
	});
	settings.refreshTime = new Setting('refreshTime', {
		type: 'select',
		defaultValue: 600_000,
		sticky: false,
		values: [
			[30_000, 'TESTING'],
			[300_000, '5 minutes'],
			[600_000, '10 minutes'],
			[900_000, '15 minutes'],
			[1_800_000, '30 minutes'],
		],
		visible: false,
	});
};

init();

// generate html objects
document.addEventListener('DOMContentLoaded', () => {
	// Apply any settings that were deferred due to the DOM not being ready when setting were read
	if (deferredDomSettings.size > 0) {
		console.log('Applying deferred DOM settings:', Array.from(deferredDomSettings));

		// Re-apply each pending setting by calling its changeAction with current value
		deferredDomSettings.forEach((settingName) => {
			const setting = settings[settingName];
			if (setting && setting.changeAction && typeof setting.changeAction === 'function') {
				setting.changeAction(setting.value);
			}
		});

		deferredDomSettings.clear();
	}

	// Then generate the settings UI
	const settingHtml = Object.values(settings).map((setting) => {
		if (hiddenSettings.includes(setting.shortName)) {
			// setting is hidden, register it
			registerHiddenSetting(setting.elemId, setting);
			return false;
		}
		// generate HTML for setting
		return setting.generate();
	}).filter((d) => d);
	const settingsSection = document.querySelector('#settings');
	settingsSection.innerHTML = '';
	settingsSection.append(...settingHtml);

	// update visibility on some settings
	const modeSelect = document.getElementById('settings-scanLineMode-label');
	const { value } = settings.scanLines;
	if (value) {
		modeSelect?.style?.removeProperty('display');
	} else if (modeSelect) {
		modeSelect.style.display = 'none';
	}
	registerHiddenSetting('settings-scanLineMode-select', settings.scanLineMode);
});

export default settings;

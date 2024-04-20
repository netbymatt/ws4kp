import { parseQueryString } from '../share.mjs';

const SETTINGS_KEY = 'Settings';

class Setting {
	constructor(shortName, name, type, defaultValue, changeAction, sticky) {
		// store values
		this.shortName = shortName;
		this.name = name;
		this.defaultValue = defaultValue;
		this.myValue = defaultValue;
		this.type = type;
		this.sticky = sticky;
		// a default blank change function is provided
		this.changeAction = changeAction ?? (() => { });

		// get value from url
		const urlValue = parseQueryString()?.[`settings-${shortName}-checkbox`];
		let urlState;
		if (urlValue !== undefined) {
			urlState = urlValue === 'true';
		}

		// get existing value if present
		const storedValue = urlState ?? this.getFromLocalStorage();
		if (sticky && storedValue !== null) {
			this.myValue = storedValue;
		}

		// call the change function on startup
		this.checkboxChange({ target: { checked: this.myValue } });
	}

	generateCheckbox() {
		// create a checkbox in the selected displays area
		const label = document.createElement('label');
		label.for = `settings-${this.shortName}-checkbox`;
		label.id = `settings-${this.shortName}-label`;
		const checkbox = document.createElement('input');
		checkbox.type = 'checkbox';
		checkbox.value = true;
		checkbox.id = `settings-${this.shortName}-checkbox`;
		checkbox.name = `settings-${this.shortName}-checkbox`;
		checkbox.checked = this.myValue;
		checkbox.addEventListener('change', (e) => this.checkboxChange(e));
		const span = document.createElement('span');
		span.innerHTML = this.name;

		label.append(checkbox, span);

		this.checkbox = label;

		return label;
	}

	checkboxChange(e) {
		// update the state
		this.myValue = e.target.checked;
		this.storeToLocalStorage(this.myValue);

		// call change action
		this.changeAction(this.myValue);
	}

	storeToLocalStorage(value) {
		if (!this.sticky) return;
		const allSettingsString = localStorage?.getItem(SETTINGS_KEY) ?? '{}';
		const allSettings = JSON.parse(allSettingsString);
		allSettings[this.shortName] = value;
		localStorage?.setItem(SETTINGS_KEY, JSON.stringify(allSettings));
	}

	getFromLocalStorage() {
		const allSettings = localStorage?.getItem(SETTINGS_KEY);
		try {
			if (allSettings) {
				const storedValue = JSON.parse(allSettings)?.[this.shortName];
				if (storedValue !== undefined) {
					switch (this.type) {
					case 'boolean':
						return storedValue;
					case 'int':
						return storedValue;
					default:
						return null;
					}
				}
			}
		} catch {
			return null;
		}
		return null;
	}

	get value() {
		return this.myValue;
	}

	set value(newValue) {
		// update the state
		this.myValue = newValue;
		this.checkbox.checked = newValue;
		this.storeToLocalStorage(this.myValue);

		// call change action
		this.changeAction(this.myValue);
	}
}

export default Setting;

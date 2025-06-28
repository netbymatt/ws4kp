import { parseQueryString } from '../share.mjs';

const SETTINGS_KEY = 'Settings';

const DEFAULTS = {
	shortName: undefined,
	name: undefined,
	type: 'checkbox',
	defaultValue: undefined,
	changeAction: () => { },
	sticky: true,
	values: [],
	visible: true,
};

class Setting {
	constructor(shortName, _options) {
		if (shortName === undefined) {
			throw new Error('No name provided for setting');
		}
		// merge options with defaults
		const options = { ...DEFAULTS, ...(_options ?? {}) };

		// store values and combine with defaults
		this.shortName = shortName;
		this.name = options.name ?? shortName;
		this.defaultValue = options.defaultValue;
		this.myValue = this.defaultValue;
		this.type = options?.type;
		this.sticky = options.sticky;
		this.values = options.values;
		this.visible = options.visible;
		this.changeAction = options.changeAction;

		// get value from url
		const urlValue = parseQueryString()?.[`settings-${shortName}-${this.type}`];
		let urlState;
		if (this.type === 'checkbox' && urlValue !== undefined) {
			urlState = urlValue === 'true';
		}
		if (this.type === 'boolean' && urlValue !== undefined) {
			urlState = urlValue === 'true';
		}
		if (this.type === 'select' && urlValue !== undefined) {
			urlState = parseFloat(urlValue);
		}
		if (this.type === 'select' && urlValue !== undefined && Number.isNaN(urlState)) {
			// couldn't parse as a float, store as a string
			urlState = urlValue;
		}

		// get existing value if present
		const storedValue = urlState ?? this.getFromLocalStorage();
		if ((this.sticky || urlValue !== undefined) && storedValue !== null) {
			this.myValue = storedValue;
		}

		// call the change function on startup
		switch (this.type) {
			case 'select':
				this.selectChange({ target: { value: this.myValue } });
				break;
			case 'checkbox':
			default:
				this.checkboxChange({ target: { checked: this.myValue } });
		}
	}

	generateSelect() {
		// create a radio button set in the selected displays area
		const label = document.createElement('label');
		label.for = `settings-${this.shortName}-select`;
		label.id = `settings-${this.shortName}-label`;

		const span = document.createElement('span');
		span.innerHTML = `${this.name} `;
		label.append(span);

		const select = document.createElement('select');
		select.id = `settings-${this.shortName}-select`;
		select.name = `settings-${this.shortName}-select`;
		select.addEventListener('change', (e) => this.selectChange(e));

		this.values.forEach(([value, text]) => {
			const option = document.createElement('option');
			if (typeof value === 'number') {
				option.value = value.toFixed(2);
			} else {
				option.value = value;
			}

			option.innerHTML = text;
			select.append(option);
		});
		label.append(select);

		this.element = label;

		// set the initial value
		this.selectHighlight(this.myValue);

		return label;
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

		this.element = label;

		return label;
	}

	checkboxChange(e) {
		// update the state
		this.myValue = e.target.checked;
		this.storeToLocalStorage(this.myValue);

		// call change action
		this.changeAction(this.myValue);
	}

	selectChange(e) {
		// update the value
		this.myValue = parseFloat(e.target.value);
		if (Number.isNaN(this.myValue)) {
			// was a string, store as such
			this.myValue = e.target.value;
		}
		this.storeToLocalStorage(this.myValue);

		// call the change action
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
						case 'checkbox':
							return storedValue;
						case 'select':
							return storedValue;
						default:
							return null;
					}
				}
			}
		} catch (error) {
			console.warn(`Failed to parse settings from localStorage: ${error} - allSettings=${allSettings}`);
			localStorage?.removeItem(SETTINGS_KEY);
		}
		return null;
	}

	get value() {
		return this.myValue;
	}

	set value(newValue) {
		// update the state
		this.myValue = newValue;
		switch (this.type) {
			case 'select':
				this.selectHighlight(newValue);
				break;
			case 'boolean':
				break;
			case 'checkbox':
			default:
				this.element.querySelector('input').checked = newValue;
		}
		this.storeToLocalStorage(this.myValue);

		// call change action
		this.changeAction(this.myValue);
	}

	selectHighlight(newValue) {
		// set the dropdown to the provided value
		this?.element?.querySelectorAll('option')?.forEach?.((elem) => {
			elem.selected = (newValue?.toFixed?.(2) === elem.value) || (newValue === elem.value);
		});
	}

	generate() {
		// don't generate a control for not visible items
		if (!this.visible) return '';
		// call the appropriate control generator
		switch (this.type) {
			case 'select':
				return this.generateSelect();
			case 'checkbox':
			default:
				return this.generateCheckbox();
		}
	}
}

export default Setting;

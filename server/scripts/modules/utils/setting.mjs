const SETTINGS_KEY = 'Settings';

const DEFAULTS = {
	shortName: undefined,
	name: undefined,
	type: 'checkbox',
	defaultValue: undefined,
	changeAction: () => { },
	sticky: true,
	stickyRead: false,
	values: [],
	visible: true,
	placeholder: '',
};

// shorthand mappings for frequently used values
const specialMappings = {
	kiosk: 'settings-kiosk-checkbox',
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
		this.stickyRead = options.stickyRead;
		this.values = options.values;
		this.visible = options.visible;
		this.changeAction = options.changeAction;
		this.placeholder = options.placeholder;
		this.elemId = `settings-${shortName}-${this.type}`;

		// get value from url
		const urlValue = parseQueryString()?.[this.elemId];
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
		if (this.type === 'string' && urlValue !== undefined) {
			urlState = urlValue;
		}

		// get existing value if present
		const storedValue = urlState ?? this.getFromLocalStorage();
		if ((this.sticky || this.stickyRead || urlValue !== undefined) && storedValue !== null) {
			this.myValue = storedValue;
		}

		// call the change function on startup
		switch (this.type) {
			case 'select':
				this.selectChange({ target: { value: this.myValue } });
				break;
			case 'string':
				this.stringChange({ target: { value: this.myValue } });
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

	generateString() {
		// create a string input and accompanying set button
		const label = document.createElement('label');
		label.for = `settings-${this.shortName}-string`;
		label.id = `settings-${this.shortName}-label`;
		// text input box
		const textInput = document.createElement('input');
		textInput.type = 'text';
		textInput.value = this.myValue;
		textInput.id = `settings-${this.shortName}-string`;
		textInput.name = `settings-${this.shortName}-string`;
		textInput.placeholder = this.placeholder;
		// set button
		const setButton = document.createElement('input');
		setButton.type = 'button';
		setButton.value = 'Set';
		setButton.id = `settings-${this.shortName}-button`;
		setButton.name = `settings-${this.shortName}-button`;
		setButton.addEventListener('click', () => {
			this.stringChange({ target: { value: textInput.value } });
		});
		// assemble
		label.append(textInput, setButton);

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

	stringChange(e) {
		// update the value
		this.myValue = e.target.value;
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

	// Conditional storage method for stickyRead settings
	conditionalStoreToLocalStorage(value, shouldStore) {
		if (!this.stickyRead) return;
		const allSettingsString = localStorage?.getItem(SETTINGS_KEY) ?? '{}';
		const allSettings = JSON.parse(allSettingsString);

		if (shouldStore) {
			allSettings[this.shortName] = value;
		} else {
			delete allSettings[this.shortName];
		}
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
						case 'select':
						case 'string':
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
				// allow for a hidden checkbox (typically items in the player control bar)
				if (this.element) {
					this.element.querySelector('input').checked = newValue;
				}
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
			case 'string':
				return this.generateString();
			case 'checkbox':
			default:
				return this.generateCheckbox();
		}
	}
}

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

export default Setting;

export {
	parseQueryString,
};

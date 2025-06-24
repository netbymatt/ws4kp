/* eslint-disable default-case */
import { json } from './utils/fetch.mjs';

const KEYS = {
	ESC: 27,
	UP: 38,
	DOWN: 40,
	ENTER: 13,
};

const DEFAULT_OPTIONS = {
	serviceUrl: null,
	minChars: 3,
	maxHeight: 300,
	deferRequestBy: 0,
	params: {},
	zIndex: 9999,
	type: 'GET',
	containerClass: 'autocomplete-suggestions',
	paramName: 'query',
	transformResult: (a) => a,
	showNoSuggestionNotice: false,
	noSuggestionNotice: 'No results',
};

const escapeRegExChars = (string) => string.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&');

const formatResult = (suggestion, search) => {
	// Do not replace anything if the current value is empty
	if (!search) {
		return suggestion;
	}

	const pattern = `(${escapeRegExChars(search)})`;

	return suggestion
		.replace(new RegExp(pattern, 'gi'), '<strong>$1</strong>')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/&lt;(\/?strong)&gt;/g, '<$1>');
};

class AutoComplete {
	constructor(elem, options) {
		this.options = { ...DEFAULT_OPTIONS, ...options };
		this.elem = elem;
		this.selectedItem = -1;
		this.onChangeTimeout = null;
		this.currentValue = '';
		this.suggestions = [];
		this.cachedResponses = {};

		// create and add the results container
		const results = document.createElement('div');
		results.style.display = 'none';
		results.classList.add(this.options.containerClass);
		results.style.width = (typeof this.options.width === 'string') ? this.options.width : `${this.options.width}px`;
		results.style.zIndex = this.options.zIndex;
		results.style.maxHeight = `${this.options.maxHeight}px`;
		results.style.overflowX = 'hidden';
		results.addEventListener('mouseover', (e) => this.mouseOver(e));
		results.addEventListener('mouseout', (e) => this.mouseOut(e));
		results.addEventListener('click', (e) => this.click(e));

		this.results = results;
		this.elem.after(results);

		// add handlers for typing text and submitting the form
		this.elem.addEventListener('keyup', (e) => this.keyUp(e));
		this.elem.closest('form')?.addEventListener('submit', (e) => this.directFormSubmit(e));
		this.elem.addEventListener('click', () => this.deselectAll());

		// clicking outside the suggestion box requires a bit of work to determine if suggestions should be hidden
		document.addEventListener('click', (e) => this.checkOutsideClick(e));
	}

	mouseOver(e) {
		// suggestion line
		if (e.target?.classList?.contains('suggestion')) {
			e.target.classList.add('selected');
			this.selectedItem = parseInt(e.target.dataset.item, 10);
		}
	}

	mouseOut(e) {
		// suggestion line
		if (e.target?.classList?.contains('suggestion')) {
			e.target.classList.remove('selected');
			this.selectedItem = -1;
		}
	}

	click(e) {
		// suggestion line
		if (e.target?.classList?.contains('suggestion')) {
			// get the entire suggestion
			const suggestion = this.suggestions[parseInt(e.target.dataset.item, 10)];
			this.options.onSelect(suggestion);
			this.elem.value = suggestion.value;
			this.hideSuggestions();
		}
	}

	hideSuggestions() {
		this.results.style.display = 'none';
	}

	showSuggestions() {
		this.results.style.removeProperty('display');
	}

	clearSuggestions() {
		this.results.innerHTML = '';
	}

	keyUp(e) {
		// reset the change timeout
		clearTimeout(this.onChangeTimeout);

		// up/down direction
		switch (e.which) {
			case KEYS.ESC:
				this.hideSuggestions();
				return;
			case KEYS.UP:
			case KEYS.DOWN:
				// move up or down the selection list
				this.keySelect(e.which);
				return;
			case KEYS.ENTER:
				// if the text entry field is active call direct form submit
				// if there is a suggestion highlighted call the click function on that element
				if (this.getSelected() !== undefined) {
					this.click({ target: this.results.querySelector('.suggestion.selected') });
					return;
				}
				if (document.activeElement.id === this.elem.id) {
					// call the direct submit routine
					this.directFormSubmit();
				}
				return;
		}

		if (this.currentValue !== this.elem.value) {
			if (this.options.deferRequestBy > 0) {
				// defer lookup during rapid key presses
				this.onChangeTimeout = setTimeout(() => {
					this.onValueChange();
				}, this.options.deferRequestBy);
			}
		}
	}

	setValue(newValue) {
		this.currentValue = newValue;
		this.elem.value = newValue;
	}

	onValueChange() {
		clearTimeout(this.onValueChange);

		// confirm value actually changed
		if (this.currentValue === this.elem.value) return;
		// store new value
		this.currentValue = this.elem.value;

		// clear the selected index
		this.selectedItem = -1;
		this.results.querySelectorAll('div').forEach((elem) => elem.classList.remove('selected'));

		// if less than minimum don't query api
		if (this.currentValue.length < this.options.minChars) {
			this.hideSuggestions();
			return;
		}

		this.getSuggestions(this.currentValue);
	}

	async getSuggestions(search, skipHtml = false) {
		// assemble options
		const searchOptions = { ...this.options.params };
		searchOptions[this.options.paramName] = search;

		// build search url
		const url = new URL(this.options.serviceUrl);
		Object.entries(searchOptions).forEach(([key, value]) => {
			url.searchParams.append(key, value);
		});

		let result = this.cachedResponses[search];
		if (!result) {
			// make the request; using json here instead of safeJson is fine because it's infrequent and user-initiated
			const resultRaw = await json(url);

			// use the provided parser
			result = this.options.transformResult(resultRaw);
		}

		// store suggestions
		this.cachedResponses[search] = result;
		this.suggestions = result.suggestions;

		if (skipHtml) return;

		// populate the suggestion area
		this.populateSuggestions();
	}

	populateSuggestions() {
		if (this.suggestions.length === 0) {
			if (this.options.showNoSuggestionNotice) {
				this.noSuggestionNotice();
			} else {
				this.hideSuggestions();
			}
			return;
		}

		// build the list
		const suggestionElems = this.suggestions.map((suggested, idx) => {
			const elem = document.createElement('div');
			elem.classList.add('suggestion');
			elem.dataset.item = idx;
			elem.innerHTML = (formatResult(suggested.value, this.currentValue));
			return elem.outerHTML;
		});

		this.results.innerHTML = suggestionElems.join('');
		this.showSuggestions();
	}

	noSuggestionNotice() {
		this.results.innerHTML = `<div>${this.options.noSuggestionNotice}</div>`;
		this.showSuggestions();
	}

	// the submit button has been pressed and we'll just use the first suggestion found
	async directFormSubmit() {
		// check for minimum length
		if (this.currentValue.length < this.options.minChars) return;
		await this.getSuggestions(this.elem.value, true);
		const suggestion = this.suggestions?.[0];
		if (suggestion) {
			this.options.onSelect(suggestion);
			this.elem.value = suggestion.value;
			this.hideSuggestions();
		}
	}

	// return the index of the selected item in suggestions
	getSelected() {
		const index = this.results.querySelector('.selected')?.dataset?.item;
		if (index !== undefined) return parseInt(index, 10);
		return index;
	}

	// move the selection highlight up or down
	keySelect(key) {
		// if the suggestions are hidden do nothing
		if (this.results.style.display === 'none') return;
		// if there are no suggestions do nothing
		if (this.suggestions.length <= 0) return;

		// get the currently selected index (or default to off the top of the list)
		let index = this.getSelected();

		// adjust the index per the key
		// and include defaults in case no index is selected
		switch (key) {
			case KEYS.UP:
				index = (index ?? 0) - 1;
				break;
			case KEYS.DOWN:
				index = (index ?? -1) + 1;
				break;
		}

		// wrap the index (and account for negative)
		index = ((index % this.suggestions.length) + this.suggestions.length) % this.suggestions.length;

		// set this index
		this.deselectAll();
		this.mouseOver({
			target: this.results.querySelectorAll('.suggestion')[index],
		});
	}

	deselectAll() {
		// clear other selected indexes
		[...this.results.querySelectorAll('.suggestion.selected')].forEach((elem) => elem.classList.remove('selected'));
		this.selectedItem = 0;
	}

	// if a click is detected on the page, generally we hide the suggestions, unless the click was within the autocomplete elements
	checkOutsideClick(e) {
		if (e.target.id === 'txtLocation') return;
		// Fix autocomplete crash on outside click detection
		// Add optional chaining to prevent TypeError when checking classList.contains()
		// on elements that may not have a classList property.
		if (e.target?.parentNode?.classList?.contains(this.options.containerClass)) return;
		this.hideSuggestions();
	}
}

export default AutoComplete;

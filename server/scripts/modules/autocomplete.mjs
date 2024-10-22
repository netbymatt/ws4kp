/* eslint-disable default-case */
import { json } from './utils/fetch.mjs';

const KEYS = {
	ESC: 27,
	TAB: 9,
	RETURN: 13,
	LEFT: 37,
	UP: 38,
	RIGHT: 39,
	DOWN: 40,
};

const DEFAULT_OPTIONS = {
	autoSelectFirst: false,
	serviceUrl: null,
	lookup: null,
	onSelect: null,
	onHint: null,
	width: 'auto',
	minChars: 1,
	maxHeight: 300,
	deferRequestBy: 0,
	params: {},
	delimiter: null,
	zIndex: 9999,
	type: 'GET',
	noCache: false,
	preserveInput: false,
	containerClass: 'autocomplete-suggestions',
	tabDisabled: false,
	dataType: 'text',
	currentRequest: null,
	triggerSelectOnValidInput: true,
	preventBadQueries: true,
	paramName: 'query',
	transformResult: (a) => a,
	showNoSuggestionNotice: false,
	noSuggestionNotice: 'No results',
	orientation: 'bottom',
	forceFixPosition: false,
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

		// add handlers for typing text
		this.elem.addEventListener('keyup', (e) => this.keyUp(e));
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
		// ignore some keys
		switch (e.which) {
			case KEYS.UP:
			case KEYS.DOWN:
				return;
		}

		clearTimeout(this.onChangeTimeout);

		if (this.currentValue !== this.elem.value) {
			if (this.options.deferRequestBy > 0) {
				// defer lookup during rapid key presses
				this.onChangeTimeout = setTimeout(() => {
					this.onValueChange();
				}, this.options.deferRequestBy);
			}
		}
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

	async getSuggestions(search) {
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
			// make the request
			const resultRaw = await json(url);

			// use the provided parser
			result = this.options.transformResult(resultRaw);
		}

		// store suggestions
		this.cachedResponses[search] = result.suggestions;
		this.suggestions = result.suggestions;

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
}

export default AutoComplete;

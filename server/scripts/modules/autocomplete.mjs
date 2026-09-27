/* eslint-disable default-case */
import { json } from './utils/fetch.mjs';

const KEYS = {
	ESC: 'Escape',
	UP: 'ArrowUp',
	DOWN: 'ArrowDown',
	ENTER: 'Enter',
};

const DEFAULT_OPTIONS = {
	serviceUrl: null,
	minChars: 3,
	maxHeight: 300,
	deferRequestBy: 0,
	// values sent with every search, or a function that returns them when they can change from one search to the next
	params: {},
	zIndex: 9999,
	type: 'GET',
	containerClass: 'autocomplete-suggestions',
	paramName: 'query',
	transformResult: (a) => a,
	showNoSuggestionNotice: false,
	noSuggestionNotice: 'No results',
	errorNotice: 'Search is unavailable right now. Please try again.',
	// interactive, so give up quickly rather than use the fetch helper's default of retrying for up to a minute
	requestTimeout: 5000,
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

// the suggestion line an event happened on, which may be a child of the line such as the bold part of a match
const suggestionLine = (target) => target?.closest?.('.suggestion') ?? null;

class AutoComplete {
	constructor(elem, options) {
		this.options = { ...DEFAULT_OPTIONS, ...options };
		this.elem = elem;
		this.onChangeTimeout = null;
		this.currentValue = '';
		this.suggestions = [];
		// the text the suggestions were found for, which tells whether they still belong to what is in the box
		this.suggestionsFor = null;
		// the list was hidden by the user (Escape or a click elsewhere) and can be brought back
		this.dismissed = false;
		this.cachedResponses = {};
		// counts searches so a reply that has been overtaken can be recognized and dropped
		this.requestId = 0;

		// create and add the results container
		const results = document.createElement('div');
		results.id = `${this.elem.id || 'autocomplete'}-suggestions`;
		results.setAttribute('role', 'listbox');
		results.style.display = 'none';
		results.classList.add(this.options.containerClass);
		// without a width option the list matches the box, measured each time it is shown
		if (this.options.width !== undefined) {
			results.style.width = (typeof this.options.width === 'string') ? this.options.width : `${this.options.width}px`;
		}
		results.style.zIndex = this.options.zIndex;
		results.style.maxHeight = `${this.options.maxHeight}px`;
		results.style.overflowX = 'hidden';
		// the border is inside the width, so a list sized to the box lines up with it
		results.style.boxSizing = 'border-box';
		// a suggestion line is highlighted while the pointer or the arrow keys are on it
		results.addEventListener('mouseover', (e) => {
			const line = suggestionLine(e.target);
			if (line) this.select(line);
		});
		results.addEventListener('mouseout', (e) => {
			const line = suggestionLine(e.target);
			// moving between the bold part and the plain part of one line is not leaving it
			if (line && !line.contains(e.relatedTarget)) this.deselectAll();
		});
		results.addEventListener('click', (e) => this.click(e));
		// pressing on the list must not take focus from the box, otherwise choosing a line would look the same as tabbing away
		results.addEventListener('mousedown', (e) => e.preventDefault());

		this.results = results;
		this.elem.after(results);

		// the box is a combobox that controls the list, screen readers follow the highlighted line through aria-activedescendant
		this.elem.setAttribute('role', 'combobox');
		this.elem.setAttribute('aria-autocomplete', 'list');
		this.elem.setAttribute('aria-expanded', 'false');
		this.elem.setAttribute('aria-controls', results.id);

		// screen readers are told how many suggestions were found, or why there are none, through a visually hidden status
		const announcer = document.createElement('div');
		announcer.setAttribute('role', 'status');
		Object.assign(announcer.style, {
			position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap',
		});
		this.announcer = announcer;
		results.after(announcer);

		// add handlers for changing text (typing, paste, autofill, voice input) and for the navigation keys
		this.elem.addEventListener('input', () => this.onInput());
		this.elem.addEventListener('keydown', (e) => this.keyDown(e));
		this.elem.addEventListener('focus', () => this.reopen());
		// leaving the box, by tabbing or otherwise, hides the list and it comes back when the box is returned to
		this.elem.addEventListener('blur', () => this.dismiss());
		this.elem.addEventListener('click', () => {
			this.deselectAll();
			this.reopen();
		});

		// clicking outside the suggestion box requires a bit of work to determine if suggestions should be hidden
		document.addEventListener('click', (e) => this.checkOutsideClick(e));
	}

	click(e) {
		const line = suggestionLine(e.target);
		if (line) {
			// get the entire suggestion
			const suggestion = this.suggestions[parseInt(line.dataset.item, 10)];
			// the box is about to hold the chosen text, so a search still waiting or in flight is out of date
			this.cancelPending();
			this.currentValue = suggestion.value;
			this.options.onSelect(suggestion);
			this.elem.value = suggestion.value;
			this.hideSuggestions();
		}
	}

	isOpen() {
		return this.results.style.display !== 'none';
	}

	hideSuggestions() {
		this.results.style.display = 'none';
		this.elem.setAttribute('aria-expanded', 'false');
		// a hidden line can't stay highlighted, Enter would otherwise choose something the user can't see
		this.deselectAll();
	}

	showSuggestions() {
		if (this.options.width === undefined) this.results.style.width = `${this.elem.offsetWidth}px`;
		this.results.style.removeProperty('display');
		this.elem.setAttribute('aria-expanded', 'true');
	}

	clearSuggestions() {
		this.results.replaceChildren();
	}

	// hide the list because the user waved it away, which lets it come back when they return
	dismiss() {
		if (!this.isOpen()) return;
		this.dismissed = true;
		this.hideSuggestions();
	}

	// bring the list back when the user dismissed it, or whenever it is hidden if `force` is set (the down arrow)
	reopen(force = false) {
		if (this.isOpen() || !(this.dismissed || force)) return;

		if (this.results.childElementCount > 0 && this.suggestionsFor === this.elem.value) {
			// the list on the page still belongs to the text in the box
			this.dismissed = false;
			this.showSuggestions();
		} else if (force && this.elem.value.length >= this.options.minChars) {
			this.getSuggestions(this.elem.value);
		}
	}

	keyDown(e) {
		// keys that belong to an input method composing text are not ours
		if (e.isComposing) return;

		switch (e.key) {
			case KEYS.ESC:
				// a search that is still waiting or in flight must not reopen the list
				this.cancelPending();
				this.dismiss();
				break;
			case KEYS.UP:
			case KEYS.DOWN:
				this.arrowKey(e);
				break;
			case KEYS.ENTER:
				// a held key would submit over and over
				if (e.repeat) break;
				// if there is a suggestion highlighted call the click function on that element, otherwise submit what was typed
				if (this.getSelected() !== undefined) {
					this.click({ target: this.results.querySelector('.suggestion.selected') });
				} else {
					this.directFormSubmit();
				}
				break;
		}
	}

	arrowKey(e) {
		if (this.isOpen()) {
			// keep the cursor from jumping to the start or end of the text while moving through the list
			e.preventDefault();
			this.keySelect(e.key);
		} else if (e.key === KEYS.DOWN) {
			// the list is hidden and the down arrow asks for it back
			e.preventDefault();
			this.reopen(true);
		}
	}

	// the text in the box changed
	onInput() {
		// defer the lookup during rapid typing
		clearTimeout(this.onChangeTimeout);
		this.onChangeTimeout = setTimeout(() => this.onValueChange(), this.options.deferRequestBy);
	}

	// forget a search that is waiting on the typing delay and ignore the reply to one that is in flight
	cancelPending() {
		clearTimeout(this.onChangeTimeout);
		this.requestId += 1;
	}

	setValue(newValue) {
		this.cancelPending();
		this.currentValue = newValue;
		this.elem.value = newValue;
	}

	// return to how the box looks on a fresh page, used by the reset button
	reset() {
		this.setValue('');
		this.suggestions = [];
		this.suggestionsFor = null;
		this.dismissed = false;
		this.clearSuggestions();
		this.hideSuggestions();
	}

	onValueChange() {
		// store new value
		this.currentValue = this.elem.value;

		// clear the selected line
		this.deselectAll();

		// if less than minimum don't query api
		if (this.currentValue.length < this.options.minChars) {
			this.cancelPending();
			this.dismissed = false;
			this.hideSuggestions();
			return;
		}

		this.getSuggestions(this.currentValue);
	}

	// returns the suggestions found, or null if the search failed or was overtaken by a newer one
	async getSuggestions(search, skipHtml = false) {
		this.requestId += 1;
		const { requestId } = this;

		// assemble options
		const baseParams = typeof this.options.params === 'function' ? this.options.params() : this.options.params;
		const searchOptions = { ...baseParams };
		searchOptions[this.options.paramName] = search;

		// build search url
		const url = new URL(this.options.serviceUrl);
		Object.entries(searchOptions).forEach(([key, value]) => {
			url.searchParams.append(key, value);
		});

		// searches are remembered by their text, ignoring case and outer spaces, together with the other values sent
		// with them because a different location gives different suggestions
		const cacheKey = `${search.trim().toLowerCase()}|${JSON.stringify(baseParams)}`;
		let result = this.cachedResponses[cacheKey];
		if (!result) {
			try {
				// make the request; using json here instead of safeJson is fine because it's infrequent and user-initiated
				const resultRaw = await json(url, { retryCount: 0, timeout: this.options.requestTimeout });
				if (!resultRaw) throw new Error('no response');

				// use the provided parser
				result = this.options.transformResult(resultRaw);
			} catch (error) {
				// a newer search has replaced this one so there is nothing to report
				if (requestId !== this.requestId) return null;
				console.warn(`AutoComplete: search for '${search}' failed (${error.message})`);
				this.suggestions = [];
				this.showNotice(this.options.errorNotice);
				return null;
			}

			// only successful searches are remembered
			this.cachedResponses[cacheKey] = result;
		}

		// a newer search, a selection or Escape has overtaken this one
		if (requestId !== this.requestId) return null;

		// store suggestions
		this.suggestions = result.suggestions;
		this.suggestionsFor = search;

		// populate the suggestion area
		if (!skipHtml) this.populateSuggestions();

		return this.suggestions;
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
			elem.id = `${this.results.id}-${idx}`;
			elem.setAttribute('role', 'option');
			elem.setAttribute('aria-selected', 'false');
			elem.innerHTML = formatResult(suggested.value, this.currentValue);
			return elem;
		});

		this.results.replaceChildren(...suggestionElems);
		this.dismissed = false;
		this.showSuggestions();
		const count = suggestionElems.length;
		this.announcer.textContent = `${count} suggestion${count === 1 ? '' : 's'}, use the up and down arrows to choose`;
	}

	noSuggestionNotice() {
		this.showNotice(this.options.noSuggestionNotice);
	}

	showNotice(message) {
		const notice = document.createElement('div');
		notice.textContent = message;
		// inside the listbox, so it is an option that can't be chosen
		notice.setAttribute('role', 'option');
		notice.setAttribute('aria-disabled', 'true');
		this.results.replaceChildren(notice);
		this.dismissed = false;
		this.showSuggestions();
		this.announcer.textContent = message;
	}

	// the submit button has been pressed and we'll just use the first suggestion found
	async directFormSubmit() {
		// check for minimum length of the text in the box, the last text searched trails behind typing and misses a paste
		if (this.elem.value.length < this.options.minChars) return;
		clearTimeout(this.onChangeTimeout);
		const suggestions = await this.getSuggestions(this.elem.value, true);
		const suggestion = suggestions?.[0];
		if (suggestion) {
			this.currentValue = suggestion.value;
			this.options.onSelect(suggestion);
			this.elem.value = suggestion.value;
			this.hideSuggestions();
		} else if (suggestions) {
			// the search worked but found nothing, show the no results notice (a failed search already shows its own)
			this.populateSuggestions();
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
		const line = this.results.querySelectorAll('.suggestion')[index];
		if (!line) return;
		this.select(line);
		// a long list scrolls, keep the highlighted line in view
		line.scrollIntoView({ block: 'nearest' });
	}

	// highlight one line, for the arrow keys and the pointer
	select(line) {
		this.deselectAll();
		line.classList.add('selected');
		line.setAttribute('aria-selected', 'true');
		this.elem.setAttribute('aria-activedescendant', line.id);
	}

	deselectAll() {
		// clear other selected indexes
		[...this.results.querySelectorAll('.selected')].forEach((elem) => {
			elem.classList.remove('selected');
			elem.setAttribute('aria-selected', 'false');
		});
		this.elem.removeAttribute('aria-activedescendant');
	}

	// if a click is detected on the page, generally we hide the suggestions, unless the click was within the autocomplete elements
	checkOutsideClick(e) {
		if (e.target === this.elem) return;
		// anywhere inside the list is not outside, including the bold part of a line and the notices
		if (this.results.contains(e.target)) return;
		this.dismiss();
	}
}

export default AutoComplete;

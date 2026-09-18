// shared behavior for displays that render a long, vertically scrolling list of rows
//
// subclasses provide the per-display pieces:
//   scrollRows()           -> array of row data to render
//   contentSignature(rows) -> string identifying what is rendered, used to skip redundant rebuilds
//   buildRow(row, index)   -> element for the row, or a falsy value to skip it
//   drawScreenContent()    -> optional, extra DOM work on each draw

import WeatherDisplay from './weatherdisplay.mjs';
import calculateScrollTiming from './utils/scroll-timing.mjs';

class ScrollWeatherDisplay extends WeatherDisplay {
	constructor(navId, elemId, name, defaultActive, options = {}) {
		super(navId, elemId, name, defaultActive);

		this.linesSelector = options.linesSelector;
		this.scrollTimingOptions = options.scrollTiming ?? {};

		// signature of the content currently rendered into the DOM, so a refresh that returns
		// identical rows can skip the rebuild entirely
		this.lastContentSignature = null;
	}

	async drawLongCanvas() {
		const list = this.elem.querySelector(this.linesSelector);
		if (!list) return;

		const rows = this.scrollRows();

		// identical content is left in place so an in-progress scroll is not restarted from the top.
		// the populated-list check means an empty list is always rebuilt.
		const signature = this.contentSignature(rows);
		if (signature === this.lastContentSignature && list.children.length > 0) return;
		this.lastContentSignature = signature;

		list.innerHTML = '';
		const lines = rows.map((row, index) => this.buildRow(row, index)).filter((line) => line);
		list.append(...lines);

		// new content scrolls from the top
		this.navBaseCount = 0;

		// nothing to show, take this display out of the rotation
		if (lines.length === 0) {
			this.timing.totalScreens = 0;
			return;
		}

		this.setTiming(list);
	}

	setTiming(list) {
		const container = this.elem.querySelector('.main');
		const timingConfig = calculateScrollTiming(list, container, this.scrollTimingOptions);

		// apply the calculated timing
		this.timing.baseDelay = timingConfig.baseDelay;
		this.timing.delay = timingConfig.delay;
		this.scrollTiming = timingConfig.scrollTiming;

		this.calcNavTiming();
	}

	// screen index change callback just runs the base count callback
	screenIndexChange() {
		this.baseCountChange(this.navBaseCount);
	}

	// base count change callback
	baseCountChange(count) {
		const lines = this.elem.querySelector(this.linesSelector);
		if (!lines || !this.scrollTiming) return;

		// calculate the scroll offset, clamped to the distance calculated alongside the timing
		const offsetY = Math.max(0, Math.min(
			this.scrollTiming.maxOffset,
			(count - this.scrollTiming.initialCounts) * this.scrollTiming.pixelsPerCount,
		));

		// use transform instead of scrollTo for hardware acceleration
		lines.style.transform = `translateY(-${Math.round(offsetY)}px)`;
	}

	// hook for subclasses that update something outside the scrolling list
	// eslint-disable-next-line class-methods-use-this
	drawScreenContent() {}

	drawCanvas() {
		super.drawCanvas();
		this.drawScreenContent();
		this.finishDraw();
	}

	showCanvas() {
		// draw the remainder of the canvas before it is shown
		this.drawCanvas();
		super.showCanvas();
	}
}

export default ScrollWeatherDisplay;

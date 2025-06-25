// Utility functions for dynamic scroll timing calculations

/**
 * Calculate dynamic scroll timing based on actual content dimensions
 * @param {HTMLElement} list - The scrollable content element
 * @param {HTMLElement} container - The container element (for measuring display height)
 * @param {Object} options - Timing configuration options
 * @param {number} options.scrollSpeed - Pixels per second scroll speed (default: 50)
 * @param {number} options.initialDelay - Seconds before scrolling starts (default: 3.0)
 * @param {number} options.finalPause - Seconds after scrolling ends (default: 3.0)
 * @param {number} options.staticDisplay - Seconds for static display when no scrolling needed (default: same as initialDelay + finalPause)
 * @param {number} options.baseDelay - Milliseconds per timing count (default: 40)
 * @returns {Object} Timing configuration object with delay array, scrollTiming, and baseDelay
 */
const calculateScrollTiming = (list, container, options = {}) => {
	const {
		scrollSpeed = 50,
		initialDelay = 3.0,
		finalPause = 3.0,
		staticDisplay = initialDelay + finalPause,
		baseDelay = 40,
	} = options;

	// timing conversion helper
	const secondsToTimingCounts = (seconds) => Math.ceil(seconds * 1000 / baseDelay);

	// calculate actual scroll distance needed
	const displayHeight = container.offsetHeight;
	const contentHeight = list.scrollHeight;
	const scrollableHeight = Math.max(0, contentHeight - displayHeight);

	// calculate scroll time based on actual distance and speed
	const scrollTimeSeconds = scrollableHeight > 0 ? scrollableHeight / scrollSpeed : 0;

	// convert seconds to timing counts
	const initialCounts = secondsToTimingCounts(initialDelay);
	const scrollCounts = secondsToTimingCounts(scrollTimeSeconds);
	const finalCounts = secondsToTimingCounts(finalPause);
	const staticCounts = secondsToTimingCounts(staticDisplay);

	// calculate pixels per count based on our actual scroll distance and time
	// This ensures the scroll animation matches our timing perfectly
	const pixelsPerCount = scrollCounts > 0 ? scrollableHeight / scrollCounts : 0;

	// Build timing array - simple approach
	const delay = [];

	if (scrollableHeight === 0) {
		// No scrolling needed - just show static content
		delay.push(staticCounts);
	} else {
		// Initial delay + scroll time + final pause
		delay.push(initialCounts + scrollCounts + finalCounts);
	}

	return {
		baseDelay,
		delay,
		scrollTiming: {
			initialCounts,
			pixelsPerCount,
		},
	};
};

export default calculateScrollTiming;

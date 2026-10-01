// Debug flag management system
// Supports comma-separated debug flags or "all" for everything
// URL parameter takes priority over OVERRIDES.DEBUG

let debugFlags = null; // memoized parsed flags
let runtimeFlags = null; // runtime modifications via debugEnable/debugDisable/debugSet

/**
 * Parse debug flags from URL parameter or environment variable
 * @returns {Set<string>} Set of enabled debug flags
 */
const parseDebugFlags = () => {
	if (debugFlags !== null) return debugFlags;

	let debugString = '';

	// Check URL parameter first
	const urlParams = new URLSearchParams(window.location.search);
	const urlDebug = urlParams.get('debug');

	if (urlDebug) {
		debugString = urlDebug;
	} else {
		// Fall back to OVERRIDES.DEBUG
		debugString = (typeof OVERRIDES !== 'undefined' ? OVERRIDES?.DEBUG : '') || '';
	}

	// Parse comma-separated values into a Set
	if (debugString.trim()) {
		debugFlags = new Set(
			debugString
				.split(',')
				.map((flag) => flag.trim().toLowerCase())
				.filter((flag) => flag.length > 0),
		);
	} else {
		debugFlags = new Set();
	}

	return debugFlags;
};

/**
 * Get the current active debug flags (including runtime modifications)
 * @returns {Set<string>} Set of currently active debug flags
 */
const getActiveFlags = () => {
	if (runtimeFlags !== null) {
		return runtimeFlags;
	}
	return parseDebugFlags();
};

/**
 * Check if a debug flag is enabled
 * @param {string} flag - The debug flag to check
 * @returns {boolean} True if the flag is enabled
 */
const debugFlag = (flag) => {
	const activeFlags = getActiveFlags();

	// "all" enables everything
	if (activeFlags.has('all')) {
		return true;
	}

	// Check for specific flag
	return activeFlags.has(flag.toLowerCase());
};

/**
 * Enable one or more debug flags at runtime
 * @param {...string} flags - Debug flags to enable
 * @returns {string[]} Array of currently active debug flags after enabling
 */
const debugEnable = (...flags) => {
	// Initialize runtime flags from current state if not already done
	if (runtimeFlags === null) {
		runtimeFlags = new Set(getActiveFlags());
	}

	// Add new flags
	flags.forEach((flag) => {
		runtimeFlags.add(flag.toLowerCase());
	});

	return debugList();
};

/**
 * Disable one or more debug flags at runtime
 * @param {...string} flags - Debug flags to disable
 * @returns {string[]} Array of currently active debug flags after disabling
 */
const debugDisable = (...flags) => {
	// Initialize runtime flags from current state if not already done
	if (runtimeFlags === null) {
		runtimeFlags = new Set(getActiveFlags());
	}

	flags.forEach((flag) => {
		const lowerFlag = flag.toLowerCase();
		if (lowerFlag === 'all') {
			// Special case: disable all flags
			runtimeFlags.clear();
		} else {
			runtimeFlags.delete(lowerFlag);
		}
	});

	return debugList();
};

/**
 * Set debug flags at runtime (overwrites existing flags)
 * @param {...string} flags - Debug flags to set (replaces all current flags)
 * @returns {string[]} Array of currently active debug flags after setting
 */
const debugSet = (...flags) => {
	runtimeFlags = new Set(
		flags.map((flag) => flag.toLowerCase()),
	);

	return debugList();
};

/**
 * Get current debug flags for inspection
 * @returns {string[]} Array of currently active debug flags
 */
const debugList = () => Array.from(getActiveFlags()).sort();

// Make debug functions globally accessible in development for console use
// Navigation timing logs for weather displays, turned on with the 'weatherdisplay' flag
// the timing state for each display is kept here so the display class only needs one call at each point
// speed is the playback speed setting, passed in so this module doesn't import the settings
const displayTimings = new WeakMap();
const timingLabel = (display) => `⏱️ [${display.constructor.name}]`;

// a display's base counter is starting
const logNavStart = (display, speed) => {
	if (!debugFlag('weatherdisplay')) return;
	const { timing } = display;
	console.log(`${timingLabel(display)} Starting navigation:`, {
		baseDelay: timing.baseDelay,
		intervalMs: timing.baseDelay * (speed || 1),
		totalScreens: timing.totalScreens,
		delayArray: timing.delay,
		fullDelayArray: timing.fullDelay,
		screenIndexes: timing.screenIndexes,
	});
};

// one tick of a display's base counter
const logBaseCountTick = (display) => {
	if (!debugFlag('weatherdisplay')) return;
	const now = Date.now();
	let state = displayTimings.get(display);
	if (!state) {
		state = {
			lastTransition: now, first: null, last: null, ticks: 0,
		};
		displayTimings.set(display, state);
		if (display.navBaseCount !== 1) {
			console.log(`${timingLabel(display)} Starting at baseCount ${display.navBaseCount}`);
		}
	}
	const tick = { baseCount: display.navBaseCount, timestamp: now };
	if (!state.first) state.first = tick;
	state.last = tick;
	state.ticks += 1;
};

// a display is moving from its current screen to nextScreenIndex, log how long the screen it is leaving was shown
const logScreenTransition = (display, nextScreenIndex, speed) => {
	if (!debugFlag('weatherdisplay')) return;
	const state = displayTimings.get(display);
	if (!state) return;
	const now = Date.now();
	const elapsed = now - state.lastTransition;
	state.lastTransition = now;
	const { screenIndex, timing } = display;
	console.log(`${timingLabel(display)} Screen Transition: ${screenIndex} → ${nextScreenIndex === -1 ? 0 : nextScreenIndex}, baseCount=${display.navBaseCount}, duration=${elapsed}ms`);

	// the first transition (screenIndex -1 → 0) has no expected duration
	if (screenIndex === -1 || !timing || timing.delay === undefined) return;
	// for the transition "X → Y" the expected duration is the delay for screen X, the one that just finished
	let delayValue;
	if (Array.isArray(timing.delay)) {
		// array delays can be numbers or { time, si } objects (radar)
		const delay = timing.delay[screenIndex];
		delayValue = typeof delay === 'object' ? delay?.time : delay;
	} else if (typeof timing.delay === 'number') {
		delayValue = timing.delay;
	}
	if (delayValue === undefined) return;
	const expectedMs = timing.baseDelay * delayValue * (speed || 1);
	console.log(`${timingLabel(display)} Expected duration: ${expectedMs}ms, Actual: ${elapsed}ms, Diff: ${elapsed - expectedMs}ms`);
};

// a display's base counter is being reset, log a summary of the run
const logNavSummary = (display) => {
	if (!debugFlag('weatherdisplay')) return;
	const state = displayTimings.get(display);
	if (!state || state.ticks < 2) return;
	const totalDuration = state.last.timestamp - state.first.timestamp;
	const avgInterval = totalDuration / (state.ticks - 1);
	console.log(`${timingLabel(display)} Total duration: ${totalDuration}ms, Avg base interval: ${avgInterval.toFixed(1)}ms, Base count range: ${state.first.baseCount}-${state.last.baseCount}`);
	displayTimings.delete(display);
};

if (typeof window !== 'undefined') {
	window.debugFlag = debugFlag;
	window.debugEnable = debugEnable;
	window.debugDisable = debugDisable;
	window.debugSet = debugSet;
	window.debugList = debugList;
}

export {
	debugFlag,
	debugEnable,
	debugDisable,
	debugSet,
	debugList,
	logNavStart,
	logBaseCountTick,
	logScreenTransition,
	logNavSummary,
};

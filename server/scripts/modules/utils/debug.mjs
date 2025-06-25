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
};

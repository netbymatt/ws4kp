// navigation handles progress, next/previous and initial load messages from the parent frame
import noSleep from './utils/nosleep.mjs';
import STATUS from './status.mjs';
import { wrap } from './utils/calc.mjs';
import { safeJson } from './utils/fetch.mjs';
import { getPoint } from './utils/weather.mjs';
import { debugFlag } from './utils/debug.mjs';
import settings from './settings.mjs';

document.addEventListener('DOMContentLoaded', () => {
	init();
});

const displays = [];
let playing = false;
let progress;
const weatherParameters = {};

const init = async () => {
	// set up the resize handler with debounce logic to prevent rapid-fire calls
	let resizeTimeout;

	// Handle fullscreen change events and trigger an immediate resize calculation
	const fullscreenEvents = ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'];
	fullscreenEvents.forEach((eventName) => {
		document.addEventListener(eventName, () => {
			if (debugFlag('fullscreen')) {
				console.log(`🖥️ ${eventName} event fired. fullscreenElement=${!!document.fullscreenElement}`);
			}
			resize(true);
		});
	});

	// De-bounced resize handler to prevent rapid-fire resize calls
	window.addEventListener('resize', () => {
		clearTimeout(resizeTimeout);
		resizeTimeout = setTimeout(() => resize(), 100);
	});

	// Handle orientation changes (Mobile Safari doesn't always fire resize events on orientation change)
	window.addEventListener('orientationchange', () => {
		if (debugFlag('resize')) {
			console.log('📱 Orientation change detected, forcing resize after short delay');
		}
		clearTimeout(resizeTimeout);
		// Use a slightly longer delay for orientation changes to allow the browser to settle
		resizeTimeout = setTimeout(() => resize(true), 200);
	});

	resize();

	generateCheckboxes();
};

const message = (data) => {
	// dispatch event
	if (!data.type) return false;
	if (data.type === 'navButton') return handleNavButton(data.message);
	return console.error(`Unknown event ${data.type}`);
};

const getWeather = async (latLon, haveDataCallback) => {
	// get initial weather data
	const point = await getPoint(latLon.lat, latLon.lon);

	// check if point data was successfully retrieved
	if (!point) {
		return;
	}

	if (typeof haveDataCallback === 'function') haveDataCallback(point);

	try {
		// get stations using centralized safe handling
		const stations = await safeJson(point.properties.observationStations);

		if (!stations) {
			console.warn('Failed to get Observation Stations');
			return;
		}

		// check if stations data is valid
		if (!stations || !stations.features || stations.features.length === 0) {
			console.warn('No Observation Stations found for this location');
			return;
		}

		const StationId = stations.features[0].properties.stationIdentifier;

		let { city } = point.properties.relativeLocation.properties;
		const { state } = point.properties.relativeLocation.properties;

		if (StationId in StationInfo) {
			city = StationInfo[StationId].city;
			[city] = city.split('/');
			city = city.replace(/\s+$/, '');
		}

		// populate the weather parameters
		weatherParameters.latitude = latLon.lat;
		weatherParameters.longitude = latLon.lon;
		weatherParameters.zoneId = point.properties.forecastZone.substr(-6);
		weatherParameters.radarId = point.properties.radarStation.substr(-3);
		weatherParameters.stationId = StationId;
		weatherParameters.weatherOffice = point.properties.cwa;
		weatherParameters.city = city;
		weatherParameters.state = state;
		weatherParameters.timeZone = point.properties.timeZone;
		weatherParameters.forecast = point.properties.forecast;
		weatherParameters.forecastGridData = point.properties.forecastGridData;
		weatherParameters.stations = stations.features;

		// update the main process for display purposes
		populateWeatherParameters(weatherParameters);

		// reset the scroll
		postMessage({ type: 'current-weather-scroll', method: 'reload' });

		// draw the progress canvas and hide others
		hideAllCanvases();
		if (!settings?.kiosk?.value) {
			// In normal mode, hide loading screen and show progress
			// (In kiosk mode, keep the loading screen visible until autoplay starts)
			document.querySelector('#loading').style.display = 'none';
			if (progress) {
				await progress.drawCanvas();
				progress.showCanvas();
			}
		}

		// call for new data on each display
		displays.forEach((display) => display.getData(weatherParameters));
	} catch (error) {
		console.error(`Failed to get weather data: ${error.message}`);
	}
};

// receive a status update from a module {id, value}
const updateStatus = (value) => {
	if (value.id < 0) return;
	if (!progress && !settings?.kiosk?.value) return;

	if (progress) progress.drawCanvas(displays, countLoadedDisplays());

	// first display is hazards and it must load before evaluating the first display
	if (!displays[0] || displays[0].status === STATUS.loading) return;

	// calculate first enabled display
	const firstDisplayIndex = displays.findIndex((display) => display?.enabled && display?.timing?.totalScreens > 0);

	// value.id = 0 is hazards, if they fail to load hot-wire a new value.id to the current display to see if it needs to be loaded
	// typically this plays out as current conditions loads, then hazards fails.
	if (value.id === 0 && (value.status === STATUS.failed || value.status === STATUS.retrying)) {
		value.id = firstDisplayIndex;
		value.status = displays[firstDisplayIndex].status;
	}

	// if hazards data arrives after the firstDisplayIndex loads, then we need to hot wire this to the first display
	if (value.id === 0 && value.status === STATUS.loaded && displays[0] && displays[0].timing && displays[0].timing.totalScreens === 0) {
		value.id = firstDisplayIndex;
		value.status = displays[firstDisplayIndex].status;
	}

	// if this is the first display and we're playing, load it up so it starts playing
	if (isPlaying() && value.id === firstDisplayIndex && value.status === STATUS.loaded) {
		navTo(msg.command.firstFrame);
	}
};

// note: a display that is "still waiting"/"retrying" is considered loaded intentionally
// the weather.gov api has long load times for some products when you are the first
// requester for the product after the cache expires
const countLoadedDisplays = () => displays.reduce((acc, display) => {
	if (display.status !== STATUS.loading) return acc + 1;
	return acc;
}, 0);

const hideAllCanvases = () => {
	displays.forEach((display) => display.hideCanvas());
};

// is playing interface
const isPlaying = () => playing;

// navigation message constants
const msg = {
	response: {	// display to navigation
		previous: Symbol('previous'),		// already at first frame, calling function should switch to previous canvas
		inProgress: Symbol('inProgress'),	// have data to display, calling function should do nothing
		next: Symbol('next'),				// end of frames reached, calling function should switch to next canvas
	},
	command: {	// navigation to display
		firstFrame: Symbol('firstFrame'),
		previousFrame: Symbol('previousFrame'),
		nextFrame: Symbol('nextFrame'),
		lastFrame: Symbol('lastFrame'),	// used when navigating backwards from the begining of the next canvas
	},
};

// receive navigation messages from displays
const displayNavMessage = (myMessage) => {
	if (myMessage.type === msg.response.previous) loadDisplay(-1);
	if (myMessage.type === msg.response.next) loadDisplay(1);
};

// navigate to next or previous
const navTo = (direction) => {
	// test for a current display
	const current = currentDisplay();
	if (progress) progress.hideCanvas();
	if (!current) {
		// special case for no active displays (typically on progress screen)
		// find the first ready display
		let firstDisplay;
		let displayCount = 0;
		do {
			// Check if displayCount is within bounds and the display exists
			if (displayCount < displays.length && displays[displayCount]) {
				const display = displays[displayCount];
				if (display.status === STATUS.loaded && display.timing?.totalScreens > 0) {
					firstDisplay = display;
				}
			}
			displayCount += 1;
		} while (!firstDisplay && displayCount < displays.length);

		if (!firstDisplay) return;

		// In kiosk mode, hide the loading screen when we start showing the first display
		if (settings?.kiosk?.value) {
			document.querySelector('#loading').style.display = 'none';
		}

		firstDisplay.navNext(msg.command.firstFrame);
		firstDisplay.showCanvas();
		return;
	}
	if (direction === msg.command.nextFrame) currentDisplay().navNext();
	if (direction === msg.command.previousFrame) currentDisplay().navPrev();
};

// find the next or previous available display
const loadDisplay = (direction) => {
	const totalDisplays = displays.length;
	const curIdx = currentDisplayIndex();
	let idx;
	let foundSuitableDisplay = false;

	for (let i = 0; i < totalDisplays; i += 1) {
		// convert form simple 0-10 to start at current display index +/-1 and wrap
		idx = wrap(curIdx + (i + 1) * direction, totalDisplays);
		if (displays[idx].status === STATUS.loaded && displays[idx].timing.totalScreens > 0) {
			// Prevent infinite recursion by ensuring we don't select the same display
			if (idx !== curIdx) {
				foundSuitableDisplay = true;
				break;
			}
		}
	}

	// If no other suitable display was found, but current display is still suitable (e.g. user only enabled one display), stay on it
	if (!foundSuitableDisplay && displays[curIdx] && displays[curIdx].status === STATUS.loaded && displays[curIdx].timing.totalScreens > 0) {
		idx = curIdx;
		foundSuitableDisplay = true;
	}

	// if no suitable display was found at all, do NOT proceed to avoid infinite recursion
	if (!foundSuitableDisplay) {
		console.warn('No suitable display found for navigation');
		return;
	}

	const newDisplay = displays[idx];
	// hide all displays
	hideAllCanvases();
	// show the new display and navigate to an appropriate display
	if (direction < 0) newDisplay.showCanvas(msg.command.lastFrame);
	if (direction > 0) newDisplay.showCanvas(msg.command.firstFrame);
};

// get the current display index or value
const currentDisplayIndex = () => displays.findIndex((display) => display.active);
const currentDisplay = () => displays[currentDisplayIndex()];

const setPlaying = (newValue) => {
	playing = newValue;
	const playButton = document.querySelector('#NavigatePlay');
	localStorage.setItem('play', playing);

	if (playing) {
		noSleep(true).catch(() => {
			// Wake lock failed, but continue normally
		});
		playButton.title = 'Pause';
		playButton.src = 'images/nav/ic_pause_white_24dp_2x.png';
	} else {
		noSleep(false).catch(() => {
			// Wake lock disable failed, but continue normally
		});
		playButton.title = 'Play';
		playButton.src = 'images/nav/ic_play_arrow_white_24dp_2x.png';
	}
	// if we're playing and on the progress screen (or in kiosk mode), jump to the next screen
	if (playing && !currentDisplay()) {
		if (progress || settings?.kiosk?.value) {
			navTo(msg.command.firstFrame);
		}
	}
};

// handle all navigation buttons
const handleNavButton = (button) => {
	switch (button) {
		case 'play':
			setPlaying(true);
			break;
		case 'playToggle':
			setPlaying(!playing);
			break;
		case 'stop':
			setPlaying(false);
			break;
		case 'next':
			setPlaying(false);
			navTo(msg.command.nextFrame);
			break;
		case 'previous':
			setPlaying(false);
			navTo(msg.command.previousFrame);
			break;
		case 'menu':
			setPlaying(false);
			if (progress) {
				progress.showCanvas();
			} else if (settings?.kiosk?.value) {
				// In kiosk mode without progress, show the loading screen
				document.querySelector('#loading').style.display = 'flex';
			}
			hideAllCanvases();
			break;
		default:
			console.error(`Unknown navButton ${button}`);
	}
};

// return the specificed display
const getDisplay = (index) => displays[index];

// Helper function to detect iOS (using technique from nosleep.js)
const isIOS = () => {
	const { userAgent } = navigator;
	const iOSRegex = /CPU.*OS ([0-9_]{1,})[0-9_]{0,}|(CPU like).*AppleWebKit.*Mobile/i;
	return iOSRegex.test(userAgent) && !window.MSStream;
};

// Track the last applied scale to avoid redundant operations
let lastAppliedScale = null;
let lastAppliedKioskMode = null;

// resize the container on a page resize
const resize = (force = false) => {
	// Ignore resize events caused by pinch-to-zoom on mobile
	if (window.visualViewport && Math.abs(window.visualViewport.scale - 1) > 0.01) {
		return;
	}

	const isFullscreen = !!document.fullscreenElement;
	const isKioskMode = settings.kiosk?.value || false;
	const isMobileSafariKiosk = isIOS() && isKioskMode;	// Detect Mobile Safari in kiosk mode (regardless of standalone status)
	const targetWidth = settings.wide.value ? 640 + 107 + 107 : 640;

	// Use window width instead of bottom container width to avoid zero-dimension issues
	const widthZoomPercent = window.innerWidth / targetWidth;
	const heightZoomPercent = window.innerHeight / 480;

	// Standard scaling: fit within both dimensions
	const scale = Math.min(widthZoomPercent, heightZoomPercent);

	// For Mobile Safari in kiosk mode, always use centering behavior regardless of scale
	// For other platforms, only use fullscreen/centering behavior for actual fullscreen or kiosk mode where content fits naturally
	const isKioskLike = isFullscreen || (isKioskMode && scale >= 1.0) || isMobileSafariKiosk;

	if (debugFlag('resize') || debugFlag('fullscreen')) {
		console.log(`🖥️ Resize: force=${force} isKioskLike=${isKioskLike} window=${window.innerWidth}x${window.innerHeight} targetWidth=${targetWidth} widthZoom=${widthZoomPercent.toFixed(3)} heightZoom=${heightZoomPercent.toFixed(3)} finalScale=${scale.toFixed(3)} fullscreenElement=${!!document.fullscreenElement} isIOS=${isIOS()} standalone=${window.navigator.standalone} isMobileSafariKiosk=${isMobileSafariKiosk} kioskMode=${settings.kiosk?.value} wideMode=${settings.wide.value}`);
	}

	// Prevent zero or negative scale values
	if (scale <= 0) {
		console.warn('Invalid scale calculated, skipping resize');
		return;
	}

	// Skip redundant resize operations if scale and mode haven't changed (unless forced)
	const scaleChanged = Math.abs((lastAppliedScale || 0) - scale) > 0.001;
	const modeChanged = lastAppliedKioskMode !== isKioskLike;

	if (!force && !scaleChanged && !modeChanged) {
		return; // No meaningful change, skip resize operation
	}

	// Update tracking variables
	lastAppliedScale = scale;
	lastAppliedKioskMode = isKioskLike;
	window.currentScale = scale; // Make scale available to settings module

	const wrapper = document.querySelector('#divTwc');
	const mainContainer = document.querySelector('#divTwcMain');

	// BASELINE: content fits naturally, no scaling needed
	if (!isKioskLike && scale >= 1.0 && !isKioskMode) {
		if (debugFlag('fullscreen')) {
			console.log('🖥️ Resetting fullscreen/kiosk styles to normal');
		}

		// Reset wrapper styles (only properties that are actually set in fullscreen/scaling modes)
		wrapper.style.removeProperty('width');
		wrapper.style.removeProperty('height');
		wrapper.style.removeProperty('overflow');
		wrapper.style.removeProperty('transform');
		wrapper.style.removeProperty('transform-origin');

		// Reset container styles that might have been applied during fullscreen
		mainContainer.style.removeProperty('transform');
		mainContainer.style.removeProperty('transform-origin');
		mainContainer.style.removeProperty('width');
		mainContainer.style.removeProperty('height');
		mainContainer.style.removeProperty('position');
		mainContainer.style.removeProperty('left');
		mainContainer.style.removeProperty('top');
		mainContainer.style.removeProperty('margin-left');
		mainContainer.style.removeProperty('margin-top');

		applyScanlineScaling(1.0);
		return;
	}

	// MOBILE SCALING: Use wrapper scaling for mobile devices (but not Mobile Safari kiosk mode)
	if ((scale < 1.0 || (isKioskMode && !isKioskLike)) && !isMobileSafariKiosk) {
		/*
		 * MOBILE SCALING (Wrapper Scaling)
		 *
		 * Why scale the wrapper instead of mainContainer?
		 * - For mobile devices where content is larger than viewport, we need to scale the entire layout
		 * - The wrapper (#divTwc) contains both the main content AND the bottom navigation bar
		 * - Scaling the wrapper ensures both elements are scaled together as a unit
		 * - No centering is applied - content aligns to top-left for typical mobile behavior
		 * - Uses explicit dimensions to prevent layout issues and eliminate gaps after scaling
		 */
		wrapper.style.setProperty('transform', `scale(${scale})`);
		wrapper.style.setProperty('transform-origin', 'top left'); // Scale from top-left corner

		// Set explicit dimensions to prevent layout issues on mobile
		const wrapperWidth = settings.wide.value ? 854 : 640;
		// Calculate total height: main content (480px) + bottom navigation bar
		const bottomBar = document.querySelector('#divTwcBottom');
		const bottomBarHeight = bottomBar ? bottomBar.offsetHeight : 40; // fallback to ~40px
		const totalHeight = 480 + bottomBarHeight;
		const scaledHeight = totalHeight * scale; // Height after scaling

		wrapper.style.setProperty('width', `${wrapperWidth}px`);
		wrapper.style.setProperty('height', `${scaledHeight}px`); // Use scaled height to eliminate gap
		applyScanlineScaling(scale);
		return;
	}

	// KIOSK/FULLSCREEN SCALING: Two different positioning approaches for different platforms
	const wrapperWidth = settings.wide.value ? 854 : 640;
	const wrapperHeight = 480;

	// Reset wrapper styles to avoid double scaling (wrapper remains unstyled)
	wrapper.style.removeProperty('width');
	wrapper.style.removeProperty('height');
	wrapper.style.removeProperty('transform');
	wrapper.style.removeProperty('transform-origin');

	// Platform-specific positioning logic
	let transformOrigin;
	let leftPosition;
	let topPosition;
	let marginLeft;
	let marginTop;

	if (isMobileSafariKiosk) {
		/*
		 * MOBILE SAFARI KIOSK MODE (Manual offset calculation)
		 *
		 * Why this approach?
		 * - Mobile Safari in kiosk mode has unique viewport behaviors that don't work well with standard CSS centering
		 * - We want orientation-specific centering: vertical in portrait, horizontal in landscape
		 * - The standard CSS centering method can cause layout issues in Mobile Safari's constrained environment
		 */
		const scaledWidth = wrapperWidth * scale;
		const scaledHeight = wrapperHeight * scale;

		// Determine if we're in portrait or landscape
		const isPortrait = window.innerHeight > window.innerWidth;

		let offsetX = 0;
		let offsetY = 0;

		if (isPortrait) {
			offsetY = (window.innerHeight - scaledHeight) / 2; // center vertically, align to left edge
		} else {
			offsetX = (window.innerWidth - scaledWidth) / 2; // center horizontally, align to top edge
		}

		if (debugFlag('fullscreen')) {
			console.log(`📱 Mobile Safari kiosk centering: ${isPortrait ? 'portrait' : 'landscape'} wrapper=${wrapperWidth}x${wrapperHeight} scale=${scale.toFixed(3)} offset=${offsetX.toFixed(1)},${offsetY.toFixed(1)}`);
		}

		// Set positioning values for manual offset calculation
		transformOrigin = 'top left'; // Scale from top-left corner
		leftPosition = `${offsetX}px`; // Exact pixel positioning
		topPosition = `${offsetY}px`; // Exact pixel positioning
		marginLeft = null; // Clear any previous centering margins
		marginTop = null; // Clear any previous centering margins
	} else {
		/*
		 * STANDARD FULLSCREEN/KIOSK MODE (CSS-based Centering)
		 *
		 * Why this approach?
		 * - Should work reliably across all other browsers and scenarios (desktop, non-Safari mobile, etc.)
		 * - Uses standard CSS centering techniques that browsers handle efficiently
		 * - Always centers both horizontally and vertically
		 */
		const scaledWidth = wrapperWidth * scale;
		const scaledHeight = wrapperHeight * scale;
		const offsetX = (window.innerWidth - scaledWidth) / 2;
		const offsetY = (window.innerHeight - scaledHeight) / 2;

		if (debugFlag('fullscreen')) {
			console.log(`🖥️ Applying fullscreen/kiosk scaling: wrapper=${wrapperWidth}x${wrapperHeight} scale=${scale.toFixed(3)} offset=${offsetX.toFixed(1)},${offsetY.toFixed(1)} transform: scale(${scale}) translate(${offsetX / scale}px, ${offsetY / scale}px)`);
		}

		// Set positioning values for CSS-based centering
		transformOrigin = 'center center'; // Scale from center point
		leftPosition = '50%'; // Position at 50% from left
		topPosition = '50%'; // Position at 50% from top
		marginLeft = `-${wrapperWidth / 2}px`; // Pull back by half width
		marginTop = `-${wrapperHeight / 2}px`; // Pull back by half height
	}

	// Apply shared mainContainer properties (same for both kiosk modes)
	mainContainer.style.setProperty('transform', `scale(${scale})`, 'important');
	mainContainer.style.setProperty('transform-origin', transformOrigin, 'important');
	mainContainer.style.setProperty('width', `${wrapperWidth}px`, 'important');
	mainContainer.style.setProperty('height', `${wrapperHeight}px`, 'important');
	mainContainer.style.setProperty('position', 'absolute', 'important');
	mainContainer.style.setProperty('left', leftPosition, 'important');
	mainContainer.style.setProperty('top', topPosition, 'important');

	// Apply or clear margin properties based on positioning method
	if (marginLeft !== null) {
		mainContainer.style.setProperty('margin-left', marginLeft, 'important');
	} else {
		mainContainer.style.removeProperty('margin-left');
	}
	if (marginTop !== null) {
		mainContainer.style.setProperty('margin-top', marginTop, 'important');
	} else {
		mainContainer.style.removeProperty('margin-top');
	}

	applyScanlineScaling(scale);
};

// reset all statuses to loading on all displays, used to keep the progress bar accurate during refresh
const resetStatuses = () => {
	displays.forEach((display) => { display.status = STATUS.loading; });
};

// Apply scanline scaling to try and prevent banding by avoiding fractional scaling
const applyScanlineScaling = (scale) => {
	const container = document.querySelector('#container');
	if (!container || !container.classList.contains('scanlines')) {
		return;
	}

	const viewportWidth = window.innerWidth;
	const viewportHeight = window.innerHeight;
	const devicePixelRatio = window.devicePixelRatio || 1;
	const currentMode = settings?.scanLineMode?.value || 'auto';
	let cssThickness;
	let scanlineDebugInfo = null;

	// Helper function to round CSS values intelligently based on scale and DPR
	// At high scales, precise fractional pixels render fine; at low scales, alignment matters more
	const roundCSSValue = (value) => {
		// On 1x DPI displays, use exact calculated values
		if (devicePixelRatio === 1) {
			return value;
		}

		// At high scales (>2x), the browser scaling dominates and fractional pixels render well
		// Prioritize nice fractions for better visual consistency
		if (scale > 2.0) {
			// Try quarter-pixel boundaries first (0.25, 0.5, 0.75, 1.0, etc.)
			const quarterRounded = Math.round(value * 4) / 4;
			if (Math.abs(quarterRounded - value) <= 0.125) { // Within 0.125px tolerance
				return quarterRounded;
			}
			// Fall through to half-pixel boundaries for high scale fallback
		}

		// At lower scales (and high scale fallback), pixel alignment matters more for crisp rendering
		// Round UP to the next half-pixel to ensure scanlines are never thinner than intended
		const halfPixelRounded = Math.ceil(value * 2) / 2;
		return halfPixelRounded;
	};

	// Manual modes: use smart rounding in scaled scenarios to avoid banding
	if (currentMode === 'thin') {
		const rawValue = 1 / scale;
		const cssValue = scale === 1.0 ? rawValue : roundCSSValue(rawValue);
		cssThickness = `${cssValue}px`;
		scanlineDebugInfo = {
			css: cssValue,
			visual: 1,
			target: '1px visual thickness',
			reason: scale === 1.0 ? 'Thin: 1px visual user override (exact)' : 'Thin: 1px visual user override (rounded)',
			isManual: true,
		};
	} else if (currentMode === 'medium') {
		const rawValue = 2 / scale;
		const cssValue = scale === 1.0 ? rawValue : roundCSSValue(rawValue);
		cssThickness = `${cssValue}px`;
		scanlineDebugInfo = {
			css: cssValue,
			visual: 2,
			target: '2px visual thickness',
			reason: scale === 1.0 ? 'Medium: 2px visual user override (exact)' : 'Medium: 2px visual user override (rounded)',
			isManual: true,
		};
	} else if (currentMode === 'thick') {
		const rawValue = 3 / scale;
		const cssValue = scale === 1.0 ? rawValue : roundCSSValue(rawValue);
		cssThickness = `${cssValue}px`;
		scanlineDebugInfo = {
			css: cssValue,
			visual: 3,
			target: '3px visual thickness',
			reason: scale === 1.0 ? 'Thick: 3px visual user override (exact)' : 'Thick: 3px visual user override (rounded)',
			isManual: true,
		};
	} else {
		// Auto mode: choose thickness based on scaling behavior

		let visualThickness;
		let reason;

		if (scale === 1.0) {
			// Unscaled mode: use reasonable thickness based on device characteristics
			const isHighDPIMobile = devicePixelRatio >= 2 && viewportWidth <= 768 && viewportHeight <= 768;
			const isHighDPITablet = devicePixelRatio >= 2 && viewportWidth <= 1024 && viewportHeight <= 1024;

			if (isHighDPIMobile) {
				// High-DPI mobile: use thin scanlines but not too thin
				const cssValue = roundCSSValue(1.5 / devicePixelRatio);
				cssThickness = `${cssValue}px`;
				reason = `Auto: ${cssValue}px unscaled (high-DPI mobile, DPR=${devicePixelRatio})`;
			} else if (isHighDPITablet) {
				// High-DPI tablets: use slightly thicker scanlines for better visibility
				const cssValue = roundCSSValue(1.5 / devicePixelRatio);
				cssThickness = `${cssValue}px`;
				reason = `Auto: ${cssValue}px unscaled (high-DPI tablet, DPR=${devicePixelRatio})`;
			} else if (devicePixelRatio >= 2) {
				// High-DPI desktop: use scanlines that look similar to scaled mode
				const cssValue = roundCSSValue(1.5 / devicePixelRatio);
				cssThickness = `${cssValue}px`;
				reason = `Auto: ${cssValue}px unscaled (high-DPI desktop, DPR=${devicePixelRatio})`;
			} else {
				// Standard DPI desktop: use 2px for better visibility
				cssThickness = '2px';
				reason = 'Auto: 2px unscaled (standard DPI desktop)';
			}
		} else if (scale < 1.0) {
			// Mobile scaling: use thinner scanlines for small displays
			visualThickness = 1;
			const cssValue = roundCSSValue(visualThickness / scale);
			cssThickness = `${cssValue}px`;
			reason = `Auto: ${cssValue}px scaled (mobile, scale=${scale})`;
		} else if (scale >= 3.0) {
			// Very high scale (large displays/high DPI): use thick scanlines for visibility
			visualThickness = 3;
			const cssValue = roundCSSValue(visualThickness / scale);
			cssThickness = `${cssValue}px`;
			reason = `Auto: ${cssValue}px scaled (large display/high scale, scale=${scale})`;
		} else {
			// Medium scale kiosk/fullscreen: use medium scanlines with smart rounding
			visualThickness = 2;
			const rawValue = visualThickness / scale;
			const cssValue = roundCSSValue(rawValue);
			cssThickness = `${cssValue}px`;
			reason = `Auto: ${cssValue}px scaled (kiosk/fullscreen, scale=${scale})`;

			if (debugFlag('scanlines')) {
				console.log(`↕️ Kiosk/fullscreen rounding: raw=${rawValue}, rounded=${cssValue}, DPR=${devicePixelRatio}, scale=${scale}`);
			}
		}

		// Extract numeric value from cssThickness for debug info
		const cssNumericValue = parseFloat(cssThickness);

		scanlineDebugInfo = {
			css: cssNumericValue,
			visual: scale === 1.0 ? cssNumericValue : visualThickness, // For unscaled mode, visual thickness equals CSS thickness
			target: scale === 1.0 ? `${cssNumericValue}px CSS (unscaled)` : `${visualThickness}px visual thickness`,
			reason,
			isManual: false,
		};
	}

	container.style.setProperty('--scanline-thickness', cssThickness);

	// Output debug information if enabled
	if (debugFlag('scanlines')) {
		const actualRendered = scanlineDebugInfo.css * scale;
		const physicalRendered = actualRendered * devicePixelRatio;
		const visualThickness = scanlineDebugInfo.visual || actualRendered; // Use visual thickness if available

		console.log(`↕️ Scanline optimization: ${cssThickness} CSS × ${scale.toFixed(3)} scale = ${actualRendered.toFixed(3)}px rendered (${visualThickness}px visual target) × ${devicePixelRatio}x DPI = ${physicalRendered.toFixed(3)}px physical - ${scanlineDebugInfo.reason}`);
		console.log(`↕️  Display: ${viewportWidth}×${viewportHeight}, Scale factors: width=${(window.innerWidth / (settings.wide.value ? 854 : 640)).toFixed(3)}, height=${(window.innerHeight / 480).toFixed(3)}, DPR=${devicePixelRatio}`);
		console.log(`↕️  Thickness: CSS=${cssThickness}, Visual=${visualThickness.toFixed(1)}px, Rendered=${actualRendered.toFixed(3)}px, Physical=${physicalRendered.toFixed(3)}px`);
	}
};

// Make applyScanlineScaling available for direct calls from Settings
window.applyScanlineScaling = applyScanlineScaling;

// allow displays to register themselves
const registerDisplay = (display) => {
	if (displays[display.navId]) console.warn(`Display nav ID ${display.navId} already in use`);
	displays[display.navId] = display;

	// generate checkboxes
	generateCheckboxes();
};

const generateCheckboxes = () => {
	const availableDisplays = document.querySelector('#enabledDisplays');

	if (!availableDisplays) return;
	// generate checkboxes
	const checkboxes = displays.map((d) => d.generateCheckbox(d.defaultEnabled)).filter((d) => d);

	// write to page
	availableDisplays.innerHTML = '';
	availableDisplays.append(...checkboxes);
};

// special registration method for progress display
const registerProgress = (_progress) => {
	progress = _progress;
};

const populateWeatherParameters = (params) => {
	document.querySelector('#spanCity').innerHTML = `${params.city}, `;
	document.querySelector('#spanState').innerHTML = params.state;
	document.querySelector('#spanStationId').innerHTML = params.stationId;
	document.querySelector('#spanRadarId').innerHTML = params.radarId;
	document.querySelector('#spanZoneId').innerHTML = params.zoneId;
};

const latLonReceived = (data, haveDataCallback) => {
	getWeather(data, haveDataCallback);
};

const timeZone = () => weatherParameters.timeZone;

export {
	updateStatus,
	displayNavMessage,
	resetStatuses,
	isPlaying,
	resize,
	registerDisplay,
	registerProgress,
	currentDisplay,
	getDisplay,
	msg,
	message,
	latLonReceived,
	timeZone,
	isIOS,
};

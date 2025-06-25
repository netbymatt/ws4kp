// navigation handles progress, next/previous and initial load messages from the parent frame
import noSleep from './utils/nosleep.mjs';
import STATUS from './status.mjs';
import { wrap } from './utils/calc.mjs';
import { json } from './utils/fetch.mjs';
import { getPoint } from './utils/weather.mjs';
import settings from './settings.mjs';

document.addEventListener('DOMContentLoaded', () => {
	init();
});

const displays = [];
let playing = false;
let progress;
const weatherParameters = {};

const init = async () => {
	// set up resize handler
	window.addEventListener('resize', resize);
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

	if (typeof haveDataCallback === 'function') haveDataCallback(point);

	try {
	// get stations
	const stations = await json(point.properties.observationStations);

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
	if (displays[0].status === STATUS.loading) return;

	// calculate first enabled display
	const firstDisplayIndex = displays.findIndex((display) => display?.enabled && display?.timing?.totalScreens > 0);

	// value.id = 0 is hazards, if they fail to load hot-wire a new value.id to the current display to see if it needs to be loaded
	// typically this plays out as current conditions loads, then hazards fails.
	if (value.id === 0 && (value.status === STATUS.failed || value.status === STATUS.retrying)) {
		value.id = firstDisplayIndex;
		value.status = displays[firstDisplayIndex].status;
	}

	// if hazards data arrives after the firstDisplayIndex loads, then we need to hot wire this to the first display
	if (value.id === 0 && value.status === STATUS.loaded && displays[0].timing.totalScreens === 0) {
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
			if (displays[displayCount].status === STATUS.loaded && displays[displayCount].timing.totalScreens > 0) firstDisplay = displays[displayCount];
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
	for (let i = 0; i < totalDisplays; i += 1) {
		// convert form simple 0-10 to start at current display index +/-1 and wrap
		idx = wrap(curIdx + (i + 1) * direction, totalDisplays);
		if (displays[idx].status === STATUS.loaded && displays[idx].timing.totalScreens > 0) break;
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

// resize the container on a page resize
const resize = () => {
	// Check for display optimization opportunities before applying zoom
	const displayInfo = getDisplayInfo();

	const targetWidth = settings.wide.value ? 640 + 107 + 107 : 640;
	const widthZoomPercent = (document.querySelector('#divTwcBottom').getBoundingClientRect().width) / targetWidth;
	const heightZoomPercent = (window.innerHeight) / 480;

	const scale = Math.min(widthZoomPercent, heightZoomPercent);
	const { isKioskLike } = displayInfo;

	if (scale < 1.0 || isKioskLike) {
		document.querySelector('#container').style.zoom = scale;
		// Apply scanline scaling for low-resolution displays and kiosk mode
		applyScanlineScaling(scale);
	} else {
		document.querySelector('#container').style.zoom = 'unset';
		// Reset scanline scaling
		applyScanlineScaling(1.0);
	}
};

// reset all statuses to loading on all displays, used to keep the progress bar accurate during refresh
const resetStatuses = () => {
	displays.forEach((display) => { display.status = STATUS.loading; });
};

// Enhanced kiosk detection with automatic fullscreen optimization
const getDisplayInfo = () => {
	const isKiosk = settings.kiosk?.value || false;
	const isFullscreen = !!document.fullscreenElement;
	const isKioskLike = isKiosk || isFullscreen || (window.innerHeight >= window.screen.height - 10);

	return { isKiosk, isFullscreen, isKioskLike };
};

// Make function globally available for debugging
window.getDisplayInfo = getDisplayInfo;

// Apply dynamic scanline scaling based on zoom level
const applyScanlineScaling = (zoomScale) => {
	// Only apply if scanlines are enabled
	const container = document.querySelector('#container');
	if (!container || !container.classList.contains('scanlines')) {
		return;
	}

	// Get display and viewport information
	const displayWidth = window.screen.width;
	const displayHeight = window.screen.height;
	const devicePixelRatio = window.devicePixelRatio || 1;
	const viewportWidth = window.innerWidth;
	const viewportHeight = window.innerHeight;
	const isFullscreen = !!document.fullscreenElement;
	const isKiosk = settings.kiosk?.value || false;
	const isKioskLike = isKiosk || isFullscreen || (window.innerHeight >= window.screen.height - 10);

	// Check for sub-pixel rendering issues
	const effectiveScanlineHeight = 1 * zoomScale * devicePixelRatio;
	const willCauseAliasing = effectiveScanlineHeight < 1.0 || (effectiveScanlineHeight % 1 !== 0);

	// Calculate optimal scanline thickness
	let scanlineScale = 1;
	let scalingReason = 'default';

	// Primary strategy: Ensure scanlines render as whole pixels
	if (willCauseAliasing) {
		if (zoomScale > 1.0) {
			// Upscaling scenario (like 1024x768 → 1.6x zoom)
			const targetThickness = Math.ceil(1 / zoomScale);
			scanlineScale = Math.max(1, targetThickness);
			scalingReason = 'upscaling aliasing prevention';
		} else {
			// Downscaling scenario
			scanlineScale = Math.ceil(1 / zoomScale);
			scalingReason = 'downscaling aliasing prevention';
		}
	}

	// Specific display-based adjustments
	if (displayWidth <= 1024 && displayHeight <= 768 && devicePixelRatio < 2) {
		if (zoomScale > 1.4) {
			scanlineScale = Math.max(scanlineScale, Math.round(1 / zoomScale * 2));
			scalingReason = '1024x768 high upscaling compensation';
		} else {
			scanlineScale = Math.max(scanlineScale, 1);
			scalingReason = '1024x768 display optimization';
		}
	}

	// Override for kiosk/fullscreen mode with specific viewport dimensions
	if (isKioskLike && (
		Math.abs(zoomScale - 1.598) < 0.05 // More flexible zoom detection for 1024x768 scenarios
		|| (viewportWidth === 1023 && viewportHeight === 767) // Exact Chrome kiosk viewport
		|| (viewportWidth === 1024 && viewportHeight === 768) // Perfect viewport
	)) {
		// Kiosk mode optimization for 1024x768 displays
		// Use optimal scanlines that render as exactly 2px with no banding
		if (viewportWidth === 1023 && viewportHeight === 767) {
			// For the exact 1023x767 Chrome kiosk viewport
			// Calculate precise thickness for exactly 2px rendering
			const targetRendered = 2.0;
			scanlineScale = targetRendered / zoomScale; // This gives us exactly 2px
			scalingReason = 'Chrome kiosk 1023x767 - optimal 2px scanlines';
		} else {
			// For 1024x768 or similar zoomed scenarios
			scanlineScale = 1.25; // Standard 2px optimization
			scalingReason = 'Kiosk/fullscreen 1024x768 - optimal 2px scanlines';
		}
	}

	// Calculate precise thickness to avoid sub-pixel rendering
	let preciseThickness = scanlineScale;
	let backgroundSize = scanlineScale * 2;

	// For upscaling scenarios, try to make the final rendered size a whole number
	// BUT skip this if we already have a specific override for the zoom level
	if (zoomScale > 1.0 && willCauseAliasing && !scalingReason.includes('optimal') && !scalingReason.includes('Kiosk')) {
		const targetRenderedHeight = Math.round(effectiveScanlineHeight);
		preciseThickness = targetRenderedHeight / zoomScale / devicePixelRatio;
		backgroundSize = preciseThickness * 2;
	}

	// Apply dynamic styles with fractional pixel compensation
	let styleElement = document.getElementById('dynamic-scanlines');
	if (!styleElement) {
		styleElement = document.createElement('style');
		styleElement.id = 'dynamic-scanlines';
		document.head.appendChild(styleElement);
	}

	const cssRules = `
		.scanlines:before {
			height: ${preciseThickness}px !important;
			image-rendering: pixelated !important;
			image-rendering: crisp-edges !important;
		}
		.scanlines:after {
			background-size: 100% ${backgroundSize}px !important;
			image-rendering: pixelated !important;
			image-rendering: crisp-edges !important;
		}
	`;

	styleElement.textContent = cssRules;

	// Only log when optimal kiosk mode is applied (minimize debug output)
	if (scalingReason.includes('optimal') && !window.scanlineLoggedOnce) {
		console.log(`Scanlines: ${preciseThickness}px (${scalingReason})`);
		window.scanlineLoggedOnce = true;
	}
};

// Debug function for scanlines
// All these can be called from browser console.
// Leaving them here for now, but they can potentially be removed later.
// Function to request perfect fullscreen for optimal display
const requestPerfectFullscreen = async () => {
	const element = document.querySelector('#divTwc');

	try {
		// Use the Fullscreen API to get perfect viewport control
		const requestMethod = element.requestFullscreen || element.webkitRequestFullscreen
			|| element.mozRequestFullScreen || element.msRequestFullscreen;

		if (requestMethod) {
			// Request fullscreen with minimal logging
			await requestMethod.call(element, {
				navigationUI: 'hide',
				// Request specific fullscreen options if supported
				allowsInlineMediaPlayback: true,
			});

			// Allow a moment for fullscreen to engage
			setTimeout(() => {
				// Re-trigger resize to apply optimal scaling
				resize();

				// Apply scanline scaling based on new dimensions
				const container = document.querySelector('#container');
				const zoomScale = parseFloat(container.style.zoom) || 1;
				applyScanlineScaling(zoomScale);
			}, 100);

			return true;
		}
		console.warn('Fullscreen API not supported');
		return false;
	} catch (error) {
		console.error('Failed to request fullscreen:', error);
		return false;
	}
};

// Make function globally available for debugging
window.requestPerfectFullscreen = requestPerfectFullscreen;

const debugScanlines = () => {
	console.group('Manual Scanlines Debug');

	const container = document.querySelector('#container');
	if (!container) {
		console.error('Container element not found');
		console.groupEnd();
		return { error: 'Container element not found' };
	}

	const hasScanlinesClass = container.classList.contains('scanlines');
	const containerRect = container.getBoundingClientRect();
	const currentZoom = parseFloat(container.style.zoom) || 1;

	console.log(`Scanlines class present: ${hasScanlinesClass}`);
	console.log(`Container dimensions: ${containerRect.width.toFixed(2)}x${containerRect.height.toFixed(2)}`);
	console.log(`Current zoom: ${currentZoom}`);

	const debugInfo = {
		hasScanlinesClass,
		containerDimensions: {
			width: containerRect.width,
			height: containerRect.height,
			left: containerRect.left,
			top: containerRect.top,
		},
		currentZoom,
		viewport: {
			width: window.innerWidth,
			height: window.innerHeight,
		},
		screen: {
			width: window.screen.width,
			height: window.screen.height,
		},
		devicePixelRatio: window.devicePixelRatio || 1,
		isFullscreen: !!document.fullscreenElement,
	};

	if (hasScanlinesClass) {
		console.log(`Triggering applyScanlineScaling with zoom: ${currentZoom}`);
		applyScanlineScaling(currentZoom);

		// Check if dynamic styles exist
		const dynamicStyle = document.getElementById('dynamic-scanlines');
		if (dynamicStyle) {
			console.log('Current dynamic CSS:', dynamicStyle.textContent);
			debugInfo.dynamicCSS = dynamicStyle.textContent;
		} else {
			console.log('No dynamic scanlines styles found');
			debugInfo.dynamicCSS = null;
		}

		// Get computed styles for scanlines
		const beforeStyle = window.getComputedStyle(container, ':before');
		const afterStyle = window.getComputedStyle(container, ':after');

		const computedStyles = {
			before: {
				height: beforeStyle.height,
				background: beforeStyle.background,
				opacity: beforeStyle.opacity,
				imageRendering: beforeStyle.imageRendering,
			},
			after: {
				backgroundSize: afterStyle.backgroundSize,
				backgroundImage: afterStyle.backgroundImage,
				opacity: afterStyle.opacity,
				imageRendering: afterStyle.imageRendering,
			},
		};

		console.log('Computed :before styles:');
		console.log('  height:', computedStyles.before.height);
		console.log('  background:', computedStyles.before.background);
		console.log('  opacity:', computedStyles.before.opacity);
		console.log('  image-rendering:', computedStyles.before.imageRendering);

		console.log('Computed :after styles:');
		console.log('  background-size:', computedStyles.after.backgroundSize);
		console.log('  background-image:', computedStyles.after.backgroundImage);
		console.log('  opacity:', computedStyles.after.opacity);
		console.log('  image-rendering:', computedStyles.after.imageRendering);

		debugInfo.computedStyles = computedStyles;
	}

	console.groupEnd();
	return debugInfo;
};

// Make debug function globally available
window.debugScanlines = debugScanlines;

// Test function to manually set scanline scale - can be called from browser console
const testScanlineScale = (scale) => {
	console.log(`Testing scanline scale: ${scale}x`);

	let styleElement = document.getElementById('dynamic-scanlines');
	if (!styleElement) {
		styleElement = document.createElement('style');
		styleElement.id = 'dynamic-scanlines';
		document.head.appendChild(styleElement);
	}

	const cssRules = `
		.scanlines:before {
			height: ${scale}px !important;
			image-rendering: pixelated !important;
			image-rendering: crisp-edges !important;
		}
		.scanlines:after {
			background-size: 100% ${scale * 2}px !important;
			image-rendering: pixelated !important;
			image-rendering: crisp-edges !important;
		}
	`;

	styleElement.textContent = cssRules;

	// Calculate what this will look like when rendered
	const container = document.querySelector('#container');
	const zoom = parseFloat(container?.style.zoom) || 1;
	const expectedRendered = scale * zoom;
	const isWholePixel = Math.abs(expectedRendered % 1) < 0.01;

	const result = {
		appliedScale: scale,
		backgroundSize: scale * 2,
		currentZoom: zoom,
		expectedRendered,
		isWholePixel,
		cssRules: cssRules.trim(),
	};

	console.log(`Applied ${scale}px scanline height with ${scale * 2}px background-size`);
	console.log(`Expected rendered height: ${expectedRendered.toFixed(4)}px`);
	console.log(`Will render as whole pixels: ${isWholePixel}`);

	return result;
};

// Make test function globally available
window.testScanlineScale = testScanlineScale;

// Test function for precise fractional values to eliminate banding
const testPreciseScanlines = () => {
	const container = document.querySelector('#container');
	const zoom = parseFloat(container?.style.zoom) || 1;

	console.group('Testing Precise Scanline Values');
	console.log(`Current zoom: ${zoom.toFixed(4)}`);

	// Test values that should result in whole pixel rendering
	const testValues = [
		0.625, // Should render as 1px (0.625 * 1.598 ≈ 1.0)
		1.25, // Should render as 2px (1.25 * 1.598 ≈ 2.0)
		1.875, // Should render as 3px (1.875 * 1.598 ≈ 3.0)
		2.5, // Should render as 4px (2.5 * 1.598 ≈ 4.0)
	];

	const results = testValues.map((value) => {
		const rendered = value * zoom;
		const isWholePixel = Math.abs(rendered % 1) < 0.01;
		const result = {
			inputValue: value,
			renderedValue: rendered,
			isWholePixel,
			fractionalPart: rendered % 1,
		};
		console.log(`Test ${value}px → ${rendered.toFixed(4)}px rendered (${isWholePixel ? '✅ whole' : '❌ fractional'})`);
		return result;
	});

	console.log('Use testScanlineScale(value) to try these values');
	console.groupEnd();

	return {
		currentZoom: zoom,
		testResults: results,
		recommendation: 'Use testScanlineScale(value) to apply a specific value',
	};
};

// Make precise test function globally available
window.testPreciseScanlines = testPreciseScanlines;

// Function to analyze container dimension issues
const analyzeContainerDimensions = () => {
	const container = document.querySelector('#container');
	if (!container) {
		return { error: 'Container not found' };
	}

	const containerRect = container.getBoundingClientRect();
	const containerStyle = window.getComputedStyle(container);
	const { parentElement } = container;
	const parentRect = parentElement ? parentElement.getBoundingClientRect() : null;
	const parentStyle = parentElement ? window.getComputedStyle(parentElement) : null;

	const analysis = {
		container: {
			rect: {
				width: containerRect.width,
				height: containerRect.height,
				left: containerRect.left,
				top: containerRect.top,
			},
			computedStyle: {
				width: containerStyle.width,
				height: containerStyle.height,
				padding: containerStyle.padding,
				margin: containerStyle.margin,
				border: containerStyle.border,
				boxSizing: containerStyle.boxSizing,
				zoom: containerStyle.zoom,
				transform: containerStyle.transform,
			},
		},
		parent: parentRect ? {
			rect: {
				width: parentRect.width,
				height: parentRect.height,
				left: parentRect.left,
				top: parentRect.top,
			},
			computedStyle: {
				width: parentStyle.width,
				height: parentStyle.height,
				padding: parentStyle.padding,
				margin: parentStyle.margin,
				border: parentStyle.border,
				boxSizing: parentStyle.boxSizing,
			},
		} : null,
		viewport: {
			width: window.innerWidth,
			height: window.innerHeight,
		},
		screen: {
			width: window.screen.width,
			height: window.screen.height,
		},
		devicePixelRatio: window.devicePixelRatio || 1,
		isFullscreen: !!document.fullscreenElement,
	};

	console.group('Container Dimension Analysis');
	console.log('Container Rect:', analysis.container.rect);
	console.log('Container Computed Style:', analysis.container.computedStyle);
	if (analysis.parent) {
		console.log('Parent Rect:', analysis.parent.rect);
		console.log('Parent Computed Style:', analysis.parent.computedStyle);
	}
	console.log('Viewport:', analysis.viewport);
	console.log('Screen:', analysis.screen);

	// Check for fractional dimension causes
	const expectedTargetWidth = 640; // Base width
	const expectedTargetHeight = 480; // Base height
	const actualScale = Math.min(analysis.viewport.width / expectedTargetWidth, analysis.viewport.height / expectedTargetHeight);
	const fractionalWidth = analysis.container.rect.width % 1;
	const fractionalHeight = analysis.container.rect.height % 1;

	console.log(`Expected scale: ${actualScale.toFixed(4)}`);
	console.log(`Fractional width: ${fractionalWidth.toFixed(4)}px`);
	console.log(`Fractional height: ${fractionalHeight.toFixed(4)}px`);
	console.log(`Width is fractional: ${fractionalWidth > 0.01}`);
	console.log(`Height is fractional: ${fractionalHeight > 0.01}`);

	analysis.scaling = {
		expectedScale: actualScale,
		fractionalWidth,
		fractionalHeight,
		hasFractionalDimensions: fractionalWidth > 0.01 || fractionalHeight > 0.01,
	};

	console.groupEnd();
	return analysis;
};

// Make container analysis function globally available
window.analyzeContainerDimensions = analyzeContainerDimensions;

// Function to calculate optimal scanline thickness that eliminates fractional rendering
const calculateOptimalScanlineThickness = (targetZoom = null) => {
	const container = document.querySelector('#container');
	if (!container) {
		return { error: 'Container not found' };
	}

	const currentZoom = targetZoom || parseFloat(container.style.zoom) || 1;
	const devicePixelRatio = window.devicePixelRatio || 1;

	console.group('Calculating Optimal Scanline Thickness');
	console.log(`Current zoom: ${currentZoom.toFixed(4)}`);
	console.log(`Device pixel ratio: ${devicePixelRatio}`);

	// Calculate possible thickness values that result in whole pixel rendering
	const candidates = [];

	// Test thickness values from 0.1 to 3.0 in 0.001 increments
	for (let thickness = 0.1; thickness <= 3.0; thickness += 0.001) {
		const renderedHeight = thickness * currentZoom * devicePixelRatio;
		const fractionalPart = renderedHeight % 1;

		// If the rendered height is very close to a whole number
		if (fractionalPart < 0.001 || fractionalPart > 0.999) {
			const wholePixelHeight = Math.round(renderedHeight);
			candidates.push({
				thickness: Math.round(thickness * 1000) / 1000, // Round to 3 decimal places
				renderedHeight: wholePixelHeight,
				actualRendered: renderedHeight,
				error: Math.abs(renderedHeight - wholePixelHeight),
			});
		}
	}

	// Sort by error (closest to whole pixel) and prefer reasonable thickness values
	candidates.sort((a, b) => {
		if (Math.abs(a.error - b.error) < 0.0001) {
			// If errors are similar, prefer thickness closer to 1
			return Math.abs(a.thickness - 1) - Math.abs(b.thickness - 1);
		}
		return a.error - b.error;
	});

	// Take the best candidates for different pixel heights
	const recommendations = [];
	const seenHeights = new Set();

	candidates.some((candidate) => {
		if (!seenHeights.has(candidate.renderedHeight) && recommendations.length < 5) {
			seenHeights.add(candidate.renderedHeight);
			recommendations.push(candidate);
		}
		return recommendations.length >= 5; // Stop when we have 5 recommendations
	});

	console.log('Recommendations:');
	recommendations.forEach((rec, index) => {
		console.log(`${index + 1}. ${rec.thickness}px → ${rec.renderedHeight}px (error: ${rec.error.toFixed(6)})`);
	});

	const result = {
		currentZoom,
		devicePixelRatio,
		recommendations,
		bestRecommendation: recommendations[0] || null,
	};

	if (result.bestRecommendation) {
		console.log(`Best recommendation: ${result.bestRecommendation.thickness}px`);
		console.log(`   Will render as: ${result.bestRecommendation.renderedHeight}px`);
		console.log(`   Use: testScanlineScale(${result.bestRecommendation.thickness})`);
	}

	console.groupEnd();
	return result;
};

// Make optimal calculation function globally available
window.calculateOptimalScanlineThickness = calculateOptimalScanlineThickness;

// Function to analyze viewport and provide fullscreen optimization recommendations
const analyzeViewportOptimization = () => {
	const viewport = {
		width: window.innerWidth,
		height: window.innerHeight,
		screen: {
			width: window.screen.width,
			height: window.screen.height,
		},
		devicePixelRatio: window.devicePixelRatio || 1,
		isFullscreen: !!document.fullscreenElement,
		isKiosk: settings.kiosk?.value || false,
	};

	// Check for fractional viewport dimensions
	const hasFractionalViewport = (viewport.width % 1 !== 0) || (viewport.height % 1 !== 0);

	// Check for common kiosk viewport sizes
	const isKnownKioskSize = (
		(viewport.width === 1023 && viewport.height === 767) // Common Chrome kiosk issue
		|| (viewport.width === 1024 && viewport.height === 768) // Perfect kiosk size
	);

	// Minimize debug output for production use
	if (window.debugMode) {
		console.group('Viewport Optimization Analysis');
		console.log('Current viewport:', `${viewport.width}x${viewport.height}`);
		console.log('Screen resolution:', `${viewport.screen.width}x${viewport.screen.height}`);
		console.log('Device pixel ratio:', viewport.devicePixelRatio);
		console.log('Has fractional viewport:', hasFractionalViewport);
		console.log('Is known kiosk size:', isKnownKioskSize);
		console.log('Is fullscreen:', viewport.isFullscreen);
		console.log('Is kiosk mode:', viewport.isKiosk);
	}

	// Kiosk-specific analysis
	const recommendations = [];

	if (viewport.isKiosk && isKnownKioskSize) {
		if (viewport.width === 1023 && viewport.height === 767) {
			recommendations.push('Detected 1023x767 kiosk viewport - using calculated optimal scanlines for perfect 2px rendering');
		} else if (viewport.width === 1024 && viewport.height === 768) {
			recommendations.push('Perfect 1024x768 kiosk viewport detected - optimal scanlines will be applied');
		}
	} else if (viewport.isKiosk && hasFractionalViewport) {
		recommendations.push('Custom kiosk viewport detected - scanlines will be optimized for exact dimensions');
	}

	// Calculate what the zoom scale would be with current dimensions
	const targetWidth = settings.wide?.value ? 640 + 107 + 107 : 640;
	const targetHeight = 480;

	const currentWidthRatio = viewport.width / targetWidth;
	const currentHeightRatio = viewport.height / targetHeight;
	const currentScale = Math.min(currentWidthRatio, currentHeightRatio);

	// Calculate scanline rendering for current setup
	const currentScanlineHeight = 1 * currentScale * viewport.devicePixelRatio;
	const willCauseAliasing = currentScanlineHeight < 1.0 || (currentScanlineHeight % 1 !== 0);

	if (window.debugMode) {
		console.log('Scaling Analysis:');
		console.log(`  Current scale: ${currentScale.toFixed(6)}`);
		console.log(`  Base scanline rendering: ${currentScanlineHeight.toFixed(6)}px`);
		console.log(`  Will cause aliasing: ${willCauseAliasing}`);

		if (viewport.isKiosk && isKnownKioskSize) {
			// Calculate what our optimal scanline thickness would be
			const targetRendered = 2.0; // We want 2px scanlines
			const optimalThickness = targetRendered / (currentScale * viewport.devicePixelRatio);
			console.log(`Optimal scanline thickness: ${optimalThickness.toFixed(6)}px`);
			console.log(`Expected rendered height: ${(optimalThickness * currentScale * viewport.devicePixelRatio).toFixed(6)}px`);
		}

		if (recommendations.length > 0) {
			console.log('Kiosk Optimization Status:');
			recommendations.forEach((rec) => console.log(`  • ${rec}`));
		} else if (viewport.isKiosk) {
			console.log('Custom kiosk configuration - using automatic optimization');
		} else {
			console.log('Not in kiosk mode - standard scaling applies');
		}

		console.groupEnd();
	}

	return {
		viewport,
		hasFractionalViewport,
		isKnownKioskSize,
		recommendations,
		scaling: {
			current: currentScale,
			scanlineRendering: currentScanlineHeight,
			willCauseAliasing,
		},
	};
};

// Make function globally available for debugging
window.analyzeViewportOptimization = analyzeViewportOptimization;

// Function to test fullscreen API capabilities
const testFullscreenCapabilities = () => {
	const element = document.querySelector('#divTwc');

	console.group('Fullscreen API Test');

	const capabilities = {
		requestFullscreen: !!element.requestFullscreen,
		webkitRequestFullscreen: !!element.webkitRequestFullscreen,
		mozRequestFullScreen: !!element.mozRequestFullScreen,
		msRequestFullscreen: !!element.msRequestFullscreen,
		fullscreenEnabled: !!document.fullscreenEnabled,
		currentlyFullscreen: !!document.fullscreenElement,
	};

	console.log('API Support:', capabilities);

	// Determine the best method
	const requestMethod = element.requestFullscreen || element.webkitRequestFullscreen
		|| element.mozRequestFullScreen || element.msRequestFullscreen;

	if (requestMethod) {
		console.log('Fullscreen API available');
		console.log('Can attempt programmatic fullscreen for viewport optimization');
	} else {
		console.log('Fullscreen API not supported');
	}

	console.groupEnd();

	return capabilities;
};

// Make function globally available for debugging
window.testFullscreenCapabilities = testFullscreenCapabilities;

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
};

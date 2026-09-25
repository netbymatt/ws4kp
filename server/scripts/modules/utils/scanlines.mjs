import { debugFlag } from './debug.mjs';
import settings from '../settings.mjs';

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
				// Standard DPI desktop: 1px stays crisp and reads better than 2px on an unscaled display
				cssThickness = '1px';
				reason = 'Auto: 1px unscaled (standard DPI desktop)';
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

export default applyScanlineScaling;

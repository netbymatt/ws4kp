/**
 * Parses weather.gov icon URLs and extracts weather condition information
 * Handles both single and dual condition formats according to the weather.gov API spec
 *
 * NOTE: The 'icon' properties are marked as deprecated in the API documentation. This
 * is because it will eventually be replaced with a more generic value that is not a URL.
 */

import { debugFlag } from '../utils/debug.mjs';

/**
 * Parses a weather.gov icon URL and extracts condition and timing information
 * @param {string} iconUrl - Icon URL from weather.gov API (e.g., "/icons/land/day/skc?size=medium")
 * @param {boolean} _isNightTime - Optional override for night time determination
 * @returns {Object} Parsed icon data with conditionIcon, probability, and isNightTime
 */
const parseIconUrl = (iconUrl, _isNightTime) => {
	if (!iconUrl) {
		throw new Error('No icon URL provided');
	}

	// Parse icon URL according to API spec: /icons/{set}/{timeOfDay}/{condition}?{params}
	// where {condition} might be single (skc) or dual (tsra_hi,20/rain,50)
	// Each period will have an icon, or two if there is changing weather during that period
	// see https://github.com/weather-gov/api/discussions/557#discussioncomment-9949521
	// (On the weather.gov site, changing conditions results in a "dualImage" forecast icon)
	const iconUrlPattern = /\/icons\/(?<set>\w+)\/(?<timeOfDay>day|night)\/(?<condition>[^?]+)(?:\?(?<params>.*))?$/i;
	const match = iconUrl.match(iconUrlPattern);

	if (!match?.groups) {
		throw new Error(`Unable to parse icon URL format: ${iconUrl}`);
	}

	const { timeOfDay, condition } = match.groups;

	// Determine if it's night time with preference strategy:
	// 1. Primary: use _isNightTime parameter if provided (such as from API's isDaytime property)
	// 2. Secondary: use timeOfDay parsed from URL
	let isNightTime;
	if (_isNightTime !== undefined) {
		isNightTime = _isNightTime;
	} else if (timeOfDay === 'day') {
		isNightTime = false;
	} else if (timeOfDay === 'night') {
		isNightTime = true;
	} else {
		console.warn(`parseIconUrl: unexpected timeOfDay value: ${timeOfDay}`);
		isNightTime = false;
	}

	// Dual conditions can have a probability
	// Examples: "tsra_hi,30/sct", "rain_showers,30/tsra_hi,50", "hot/tsra_hi,70"
	let conditionIcon;
	let probability;
	if (condition.includes('/')) { // Two conditions
		const conditions = condition.split('/');
		const firstCondition = conditions[0] || '';
		const secondCondition = conditions[1] || '';

		const [firstIcon, firstProb] = firstCondition.split(',');
		const [secondIcon, secondProb] = secondCondition.split(',');

		// Default to 100% probability if not specified (high confidence)
		const firstProbability = parseInt(firstProb, 10) || 100;
		const secondProbability = parseInt(secondProb, 10) || 100;

		if (secondIcon !== firstIcon) {
			// When there's more than one condition, use the second condition
			// QUESTION: should the condition with the higher probability determine which one to use?
			// if (firstProbability >= secondProbability) { ... }
			conditionIcon = secondIcon;
			probability = secondProbability;
			if (debugFlag('icons')) {
				console.debug(`2️⃣ Using second condition: '${secondCondition}' instead of first '${firstCondition}'`);
			}
		} else {
			conditionIcon = firstIcon;
			probability = firstProbability;
		}
	} else { // Single condition
		const [name, prob] = condition.split(',');
		conditionIcon = name;
		probability = parseInt(prob, 10) || 100;
	}

	return {
		conditionIcon,
		probability,
		isNightTime,
	};
};

export default parseIconUrl;

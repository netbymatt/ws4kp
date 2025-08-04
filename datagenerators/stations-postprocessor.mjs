#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';

// Load station data
const stationInfo = JSON.parse(readFileSync('./datagenerators/output/stations-raw.json', 'utf8'));
// const regionalCities = JSON.parse(readFileSync('./datagenerators/output/regionalcities.json', 'utf8'));

// Airport exceptions for stations that require external knowledge NOT present in the original name
const airportNamingExceptions = {
	KLAS: 'Las Vegas', // Harry Reid International Airport - city requires external knowledge
	PHNL: 'Honolulu', // Daniel K Inouye International Airport - city requires external knowledge
	KMTH: 'Marathon', // The Florida Keys - Marathon International Airport - otherwise parsed as "The Florida Keys"
	KPVD: 'Providence', // Rhode Island TF Green International Airport - city requires external knowledge
	KIAD: 'Dulles', // Washington/Dulles International Airport, DC - "Dulles" is shorter/common name
	KLAN: 'Lansing', // Capital Region International Airport - city requires external knowledge
	KMBS: 'Saginaw', // MBS Internation Airport - city requires external knowledge
	KOAK: 'Oakland', // San Francisco Bay Oakland International Airport - otherwise parsed as "San Francisco Bay Oakland"
	KGSP: 'Greenville', // Greenville Spartanburg International Airport - otherwise parsed as "Greenville Spartanburg"
	KNKX: 'Miramar', // San Diego, Miramar MCAS/Mitscher Field Airport - otherwise parsed as "Mitscher Field"
};

const airportPriorityExceptions = {
	KDTW: 'international', // Detroit Metropolitan is a major international airport
};

// Proper names that are removed to improve extraction algorithm
const namesToRemove = [
	'Addington',
	'Astronaut Kent Rominger',
	'Bruce Campbell',
	'Captain Jack Thomas',
	'Carl R Keller',
	'Chris Crusta',
	'Henry Tift Myers',
	'Hopkins',
	'J. Douglas Bake',
	'John Glenn',
	'Joseph A Hardy',
	'Karl Harder',
	'Kyle Oakley',
	'Lambert',
	'Lawrence Smith',
	'Le Tourneau',
	'Linder',
	'Lynch Bellinger',
	'Muhammad Ali',
	'Tom B. David',
];

const militaryAbbreviations = {
	'Air and Space Port': 'A&SP',
	'Air Force Base': 'AFB',
	'Air National Guard Base': 'ANGB',
	'Air National Guard Weather Facility Base': 'ANGB',
	'Air Reserve Base': 'ARB',
	'Airport Heliport': 'AHP',
	'Army Air Field': 'AAF',
	'Army Airfield': 'AAF',
	'Coast Guard Air Station': 'CGAS',
	'Marine Corps Air Station': 'MCAS',
	'Marine Corps Airfield': 'MCAF',
	'Marine Corps Mountain Warfare Training Center': 'MCMWTC',
	'National Air Center': 'NAC',
	'National Aviation Center': 'NAC',
	'Naval Air Station': 'NAS',
	'Naval Auxiliary Landing Field': 'NALF',
	'Naval Outlying Field': 'NOF',
	'Naval Station': 'NS',
	'Space Force Base': 'SFB',
	'Strategic Expeditionary Landing Field': 'SELF',
};

const generalSubstitutions = {
	'Airways Facilities Sector': '',
	'City of': '',
	'Drone Runway': '',
	Fort: 'Ft',
	'Intl.': 'International',
	Island: 'Is.',
	'National Park': '',
	'NWS Office: ': 'NWS ',
	'Public ': '',
	'Ranger Station': '',
	'Shuttle Landing Facility': 'SLF',
	'Subsea Development Platform': 'SDP',
	'U. S. ': '',
};

const substitutions = { ...militaryAbbreviations, ...generalSubstitutions };

// Extract the replacement part of substitution patterns (if it's not a "removal" substitution)
const substitutionValues = [
	...Object.values(militaryAbbreviations),
	...new Set(Object.values(generalSubstitutions).filter((v) => v !== '')),
];
const startOfMatchSubstitutionValuePattern = new RegExp(`^(${substitutionValues.join('|')})$`);
const wordBreakSubstitutionValuePattern = new RegExp(`\\b(${substitutionValues.join('|')})\\b`);

// Centralized airport suffix patterns for consistency
const airportPatterns = {
	// Basic facility types
	facilityTypes: ['Airport', 'Airfield', 'Field', 'Jetport', 'Heliport', 'Landing Strip', 'Air Park', 'Airpark', 'Seaplane Base', 'Auxiliary Field', 'Auxiliary Airfield', 'Auxiliary Landing Field', 'Airstrip', 'Aircenter', 'Air Center'],
	// Airport classifications (order matters - more specific patterns first)
	classifications: ['Regional Business', 'Intercontinental', 'International', 'Regional', 'Municipal', 'Executive', 'Memorial', 'Express', 'Business', 'County', 'State', 'National'],
	// Military designations
	military: [...Object.values(militaryAbbreviations)],

	// Generate pattern for highway detection (Interstate, US Highway, State Highway)
	get highwayPattern() {
		return /^(I\d+|US\d+|[A-Z]{2}\d+)/;
	},

	// Generate pattern for military facility detection (includes both full names and abbreviations)
	get militaryPattern() {
		const fullMilitaryNames = Object.keys(militaryAbbreviations);
		return new RegExp(`\\b(${fullMilitaryNames.join('|')}|${this.military.join('|')})\\b`, 'i');
	},

	// Generate pattern for comprehensive suffix removal (includes classifications)
	get fullSuffixPattern() {
		return new RegExp(`\\s+(?:${classificationsPattern})?\\s*(?:${facilityTypesPattern}|(?:-\\s*[A-Za-z\\s]+(?:${facilityTypesPattern}))).*$|(?:\\s+|\\b)(${classificationsPattern})(?=-[A-Za-z]).*$`, 'i');
	},

	// Generate pattern for airport type detection
	get classificationDetectionPattern() {
		return new RegExp(`(?:^|\\s)(${classificationsPattern})(?:\\s|$|-)`, 'i');
	},

	get simpleCountyPattern() {
		return new RegExp(`^(.+\\s+County)(?:\\s+(?:${facilityTypesPattern}))?$`, 'i');
	},
};

// Pre-compute regex patterns for airport types and classifications with proper word boundaries
// Each pattern: 1) escapes special regex chars, 2) adds word boundaries, 3) joins with alternation (|)
// Both patterns use standard word boundaries since substitutions handle punctuation conversion beforehand
const facilityTypesPattern = airportPatterns.facilityTypes.map((type) => `\\b${type.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).join('|');
const classificationsPattern = airportPatterns.classifications.map((cls) => `\\b${cls.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).join('|');

// Helper function to handle "City, City-..." pattern normalization
function normalizeDuplicateCityPattern(cityName) {
	// Handle "City, City-..." pattern where city name is duplicated
	// Examples: "Phoenix, Phoenix-Deer Valley Municipal Airport" → "Phoenix, Deer Valley Municipal Airport"
	const duplicateCityMatch = cityName.match(/^([^,]+),\s*\1-(.+)$/);
	if (duplicateCityMatch) {
		const cityPart = duplicateCityMatch[1].trim();
		const afterHyphen = duplicateCityMatch[2].trim();
		return `${cityPart}, ${afterHyphen}`;
	}
	return cityName;
}
function cleanupHyphenatedCityPattern(text, options = {}) {
	if (!text || !text.includes('-') || text.includes(' - ')) return text;

	const dashParts = text.split('-');
	const firstPart = dashParts[0].trim();
	const secondPart = dashParts[1] ? dashParts[1].trim() : '';

	// Special case: if first part is "SomeWord County", convert to "SomeWord Co"
	if (options.handleCounty && firstPart.match(/\bCounty$/i)) {
		return processingUtils.abbreviateCounty(firstPart);
	}

	// Skip military facility names (preserve compound military base names like "Wright-Patterson AFB")
	if (airportPatterns.militaryPattern.test(text)) {
		return text;
	}

	// Only apply this if it looks like "City-City" or "City-Geographic Area" pattern
	// Skip if first part looks like a compound word or if it contains "County"
	if (secondPart
		&& !firstPart.match(/^(Tri|Quad|Multi|New|Old|North|South|East|West|St|Saint)$/i)
		&& !text.match(/County|Co\./i)
		&& firstPart.length >= 3 && secondPart.length >= 3
		&& firstPart.match(/^[A-Za-z\s]+$/) && secondPart.match(/^[A-Za-z\s]+$/)) {
		return firstPart;
	}

	return text;
}

// Helper function for title casing
function toTitleCase(str) {
	const lowercaseWords = new Set(['at', 'near', 'of', 'the', 'and', 'or', 'in', 'on']);

	return str.toLowerCase().split(/\s+/).map((word, index) => {
		if (index === 0 || !lowercaseWords.has(word)) {
			return word.charAt(0).toUpperCase() + word.slice(1);
		}
		return word;
	}).join(' ');
}

// Consolidated text cleaning function
function cleanCityText(cityName) {
	if (!cityName) return '';

	// State abbreviation should already be removed by extractBaseCityName
	let cleaned = cityName.trim();

	// Handle ALL CAPS entries before any substitutions
	if (cleaned === cleaned.toUpperCase() && cleaned.length > 2) {
		const likelyAcronym = cleaned.length <= 4 || cleaned.match(wordBreakSubstitutionValuePattern);
		if (!likelyAcronym) {
			cleaned = toTitleCase(cleaned);
		} else {
			// For things like "SCHELL AHP", title case the non-acronym parts
			const parts = cleaned.split(/\s+/);
			cleaned = parts.map((part) => {
				if (part.match(startOfMatchSubstitutionValuePattern)) {
					return part;
				}
				return toTitleCase(part);
			}).join(' ');
		}
	}

	// Apply substitutions (longest first to avoid partial matches)
	Object.entries(substitutions)
		.sort((a, b) => b[0].length - a[0].length)
		.forEach(([full, abbr]) => {
			let regex;
			if (full.endsWith('.')) {
				// For patterns ending with period, ensure we don't match if followed by word characters
				const escapedPattern = full.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
				regex = new RegExp(`\\b${escapedPattern}(?!\\w)`, 'gi');
			} else {
				regex = new RegExp(`\\b${full}\\b`, 'gi');
			}
			cleaned = cleaned.replace(regex, abbr);
		});

	// Handle concatenated airport names (like "NEOSHOAIRPORT" -> "NEOSHO")
	cleaned = processingUtils.removeConcatenatedAirport(cleaned);

	// Remove periods from the cleaned name unless it's at the end ("Co." or "Is.")
	// cleaned = cleaned.replace(/\./g, '');

	// Replace "Mount " with "Mt " (except for city names like "Mount Pleasant")
	cleaned = cleaned.replace(/\bMount\s/, 'Mt ');

	// Replace "Mountain " with "Mtn " if NOT at the beginning of the string
	cleaned = cleaned.replace(/(?<!^)\bMountain\s/, 'Mtn ');

	// Replace "Mountain" at the end with "Mtn" (for cases like "Copper Mountain")
	cleaned = cleaned.replace(/\bMountain$/, 'Mtn');

	return cleaned;
}

// Helper function to get airport type and priority
function getAirportType(cityName, stationId = '') {
	// Check exceptions first
	if (airportPriorityExceptions[stationId]) {
		return airportPriorityExceptions[stationId].toLowerCase();
	}

	// Check for significant airport classifications first to ensure high priority
	const significantTypeMatch = cityName.match(/\b(International|Intercontinental|National)\b/i);
	if (significantTypeMatch) {
		return significantTypeMatch[1].toLowerCase();
	}

	// Check station ID for P prefix, indicating weather/water monitoring stations
	if (stationId.startsWith('P')) {
		return 'weather_station';
	}

	// Check for military facilities
	if (airportPatterns.militaryPattern.test(cityName)) return 'military';

	// Check for specific airport types
	if (/Airpark|Air Park/i.test(cityName)) return 'airpark';
	if (/Aircenter/i.test(cityName)) return 'aircenter';

	// Check for standard airport classifications
	const typeMatch = cityName.match(airportPatterns.classificationDetectionPattern);
	if (typeMatch) {
		return typeMatch[1].toLowerCase();
	}

	// Check for basic facility types that might indicate general aviation
	if (/\bField\b/i.test(cityName) && !airportPatterns.militaryPattern.test(cityName)) {
		return 'field'; // General aviation field
	}

	// Check for simple airports without classification
	if (/\bAirport\b/i.test(cityName) && !airportPatterns.classificationDetectionPattern.test(cityName)) {
		return 'airport'; // Basic airport
	}

	return null;
}

function getAirportPriority(type) {
	// A rough ranking, although things like "County" and "Municipal" aren't regulated terms
	const airportPriorityMap = {
		// Commercial aviation (scheduled passenger service)
		international: 1, // 1-90M+ pax/yr, customs facilities, wide-body gates
		intercontinental: 1,
		national: 2, // National airports - major facilities serving national routes
		regional: 3, // 100k-4M pax/yr, FAA non-hub/small hub, multiple airlines
		express: 4, // 200k-600k pax/yr, marketing term for uncongested commercial hubs
		// Corporate/business aviation (high operations, minimal passenger tracking)
		executive: 5, // 150k-200k ops/yr, corporate jets, extensive FBOs, minimal scheduled service
		aircenter: 5, // Business aviation centers, similar to executive airports
		// Government-owned with mixed service
		state: 6, // 30k-80k ops/yr, state-owned, mix of GA and essential air service
		// General aviation focused
		'regional business': 7, // <10k ops/yr, state-designated for business aviation
		business: 8, // 2k-15k ops/yr, corporate marketing focus, minimal infrastructure
		municipal: 9, // 5k-20k ops/yr, city-owned general aviation
		county: 10, // 30k-60k ops/yr, county-owned, GA-centric but can be busy near tourism
		memorial: 11, // 20k-40k ops/yr, honorific naming, predominantly general aviation
		field: 12, // General aviation field
		airport: 13, // Basic airport without specific classification
		// Military facilities (typically high activity but not passenger service)
		military: 14, // Military bases - high activity but not commercial passenger service
		// Basic facilities
		airpark: 15, // Private/recreational airparks
		airstrip: 16, // Basic airstrip, similar to field but typically smaller/simpler
		// Non-aviation facilities (lowest priority for aviation purposes)
		weather_station: 50, // Weather/water monitoring stations
	};

	return airportPriorityMap[type] || 99;
}

// Helper function to process a text fragment for county patterns and airport suffix removal
function processTextFragment(text) {
	if (!text) return text;

	// Apply Mountain/Mount abbreviations early in the process
	let processedText = text;
	processedText = processedText.replace(/\bMount\s/g, 'Mt ');
	// Only replace "Mountain " when followed by geographical terms
	processedText = processedText.replace(/\bMountain\s+(?=Pass|Ridge|Peak|Summit|Range|Top|Gap|Trail|Road|Highway)/gi, 'Mtn ');
	processedText = processedText.replace(/\bMountain$/g, 'Mtn');

	// Handle City-County patterns FIRST, before simpleCountyPattern
	if (processedText.includes('-') && !processedText.includes(' - ')) {
		// For "City-County Airport" patterns, extract just the city
		if (processedText.match(/^([^-]+)-.*County(?:\s+(?:Airport|Airfield|Field))?.*$/i)) {
			const firstPart = processedText.split('-')[0].trim();
			return firstPart;
		}
	}

	// Check if it's a county pattern first (before removing suffixes)
	const countyMatch = processedText.match(airportPatterns.simpleCountyPattern);
	if (countyMatch) {
		return processingUtils.abbreviateCounty(countyMatch[1]);
	}

	// Remove airport suffixes - handle both leading space and end-of-string patterns
	let cleanedText = processedText.replace(airportPatterns.fullSuffixPattern, '').trim();

	// Also handle cases where classification + facility is at the end (like "Butler Regional Airport")
	if (cleanedText === processedText) { // No change from the first pattern, try end-pattern
		const endPattern = new RegExp(`\\s*(?:(?:${classificationsPattern})\\s+)*(?:${facilityTypesPattern}).*$`, 'i');
		cleanedText = processedText.replace(endPattern, '').trim();
	}

	// Handle hyphenated city-city patterns by taking the first city
	// e.g., "Eveleth-Virginia" → "Eveleth", "Halifax-Northampton" → "Halifax"
	cleanedText = cleanupHyphenatedCityPattern(cleanedText);

	// Check if the final cleaned text matches the county pattern
	const finalCountyMatch = cleanedText.match(/^(.+\s+County)$/i);
	if (finalCountyMatch) {
		return processingUtils.abbreviateCounty(finalCountyMatch[1]);
	}

	return cleanedText || text;
}

// Extract base city name (without considering other stations)
function extractBaseCityName(originalCityName, stationId = '') {
	if (!originalCityName) return '';

	// Check exceptions first
	if (airportNamingExceptions[stationId]) {
		return airportNamingExceptions[stationId];
	}

	// Remove proper names first, then state abbreviation
	let cityName = processingUtils.removeProperNames(originalCityName);
	cityName = processingUtils.removeState(cityName);

	// Pre-cleaning: Handle "City, City-..." pattern where city name is duplicated
	cityName = normalizeDuplicateCityPattern(cityName);

	// Preprocess "Airport Name, City" so "City" is selected later
	// example: "George M Bryan Airport, Starkville" -> "Starkville, George M Bryan Airport" -> Starkville
	const airportCityMatch = cityName.match(new RegExp(`^([^,]+(?:${facilityTypesPattern})), ([A-Za-z\\s]+)$`));
	if (airportCityMatch) {
		cityName = `${airportCityMatch[2]}, ${airportCityMatch[1]}`;
	}

	let cleaned = cleanCityText(cityName);

	// Handle "at/near" patterns - find rightmost occurrence
	const atNearMatch = cleaned.match(/.*\b(at|near)\s+([^,]+?)$/i);
	if (atNearMatch) {
		const location = atNearMatch[2].trim();
		if (!location.match(/\b(Lane|Road|Street|Highway|Route|Drive|Avenue|Blvd)\b/i) && !location.includes(' at ') && !location.includes(' near ')) {
			cleaned = location;
		}
	}

	// Handle comma patterns
	const commaParts = patternMatchers.extractCommaParts(cleaned);
	if (commaParts) {
		const { before: beforeComma } = commaParts;
		if (beforeComma.includes('/')) {
			return beforeComma.split('/')[0].trim();
		}
		return processTextFragment(beforeComma);
	}

	// Handle compound hyphenated names (like "Tri-County", "Quad-City") - after comma handling
	if (cleaned.match(/\b(Tri|Quad)-(County|State|City)\b/i)) {
		// Extract just the compound part WITHOUT abbreviating (per user preference)
		const triMatch = cleaned.match(new RegExp(`^(.*?)(\\b(Tri|Quad)-(?:County|State|City))(?:\\s+Regional)?(?:\\s+(?:${facilityTypesPattern}))?.*$`, 'i'));
		if (triMatch) {
			const prefix = triMatch[1].trim();
			const compound = triMatch[2];
			return prefix ? `${prefix} ${compound}`.trim() : compound;
		}
		// For simple cases, just return the Tri-County/Tri-State/Quad-City part
		const simpleMatch = cleaned.match(/^(Tri|Quad)-(?:County|State|City)/i);
		if (simpleMatch) {
			return simpleMatch[1];
		}
		return cleaned;
	}

	// Handle dash patterns BEFORE slash patterns (highway logic needs priority)
	const dashParts = patternMatchers.extractDashParts(cleaned);
	if (dashParts) {
		const {
			before: beforeDash, after: afterDash, isBeforeHighway, isAfterCounty,
		} = dashParts;

		// Check for highway patterns
		if (!isBeforeHighway) {
			// For "City - County ..." patterns, prefer the city name
			// e.g., "Pittsburgh - Allegheny County Airport" → "Pittsburgh"
			// But for named facilities like "Boeing Field - King County", prefer the facility name
			if (isAfterCounty) {
				return beforeDash;
			}

			// Only prefer after-dash for very specific cases like "Las Vegas - Henderson Executive"
			// where the after-dash is clearly a more specific city location, not a regional descriptor
			const afterDashMatch = afterDash.match(/^([A-Z][a-z]+)\s+(Executive|Municipal)\s+Airport$/i);
			if (afterDashMatch && !afterDash.match(/County|Regional|State/i)) {
				// Extract specific city name only for clearly city-specific facilities
				// e.g., "Henderson Executive Airport" but NOT "West Michigan Regional Airport"
				return afterDashMatch[1].trim();
			}
			// Default: use before dash for most cases
			return processTextFragment(beforeDash);
		}
		// For highway patterns, return what's after the dash
		return afterDash.replace(/\s+(?:${facilityTypesPattern}).*$/i, '').trim();
	}

	// Handle hyphenated county patterns (like "Aspen-Pitkin County", "Lancaster County-Facility")
	if (cleaned.includes('-') && !cleaned.includes(' - ')) {
		// Check for "County-Facility" patterns (where first part contains "County")
		if (cleaned.match(/^([^-]+\s+County)-/i)) {
			const firstPart = cleaned.split('-')[0].trim();
			return processingUtils.abbreviateCounty(firstPart);
		}

		// For "City-County" patterns (where second part contains "County"), take the first part
		if (cleaned.match(/^([^-]+)-.*County/i)) {
			const firstPart = cleaned.split('-')[0].trim();
			// Remove "County" from the first part only if it ends with it AND the second part also has county info
			if (firstPart.match(/\s+County$/i) && cleaned.match(/^[^-]+-.*County/i)) {
				return processingUtils.removeCountySuffix(firstPart) || firstPart;
			}
			// Process the first part to remove airport classifications like "Regional"
			return processTextFragment(firstPart);
		}
	}

	// Handle slash patterns
	const slashParts = patternMatchers.extractSlashParts(cleaned);
	if (slashParts) {
		const {
			first: firstPart, second: secondPart, firstIsMilitary, secondIsMilitary,
		} = slashParts;

		// If we have two parts, check for military facility patterns
		if (secondPart) {
			// If first part is military facility and second part is not, prefer second (city)
			// e.g., "Craig Field / Selma" → "Selma", "Keesler Air Force Base / Biloxi" → "Biloxi"
			if (firstIsMilitary && !secondIsMilitary) {
				return processTextFragment(secondPart);
			}

			// If second part is military facility and first part is not, prefer first (city)
			// e.g., "Eastern WV Regional Airport / Shepherd Field" → "Eastern WV"
			if (secondIsMilitary && !firstIsMilitary) {
				return processTextFragment(firstPart);
			}
		}

		// Default: process the first part to remove any airport suffixes
		return processTextFragment(firstPart);
	}

	// Handle simple county patterns early - if it matches this pattern, keep County and stop processing
	// This should only match direct county patterns like "Delta County Airport", not "City Regional Airport of County"
	const simpleCountyMatch = cleaned.match(airportPatterns.simpleCountyPattern);
	if (simpleCountyMatch && !cleaned.match(/\s+(Regional\s+)?Airport\s+of\s+/i)) {
		const fullCountyName = simpleCountyMatch[1].trim();

		// Use utility function for county pattern handling
		return processingUtils.handleCountyPattern(fullCountyName, { preferCity: true });
	}

	// Handle county facilities with descriptive names (e.g., "Carroll County Regional Jack B Poage Field")
	const countyFacilityMatch = cleaned.match(new RegExp(`^([A-Za-z\\s]+\\s+County)\\s+.*(?:${facilityTypesPattern}).*$`, 'i'));
	if (countyFacilityMatch) {
		const countyName = countyFacilityMatch[1].trim();
		const words = countyName.split(/\s+/);

		// Check if this looks like "City County" (e.g., "Pikeville Pike County", "Jasper Walker County")
		if (words.length === 3 && words[2].toLowerCase() === 'county') {
			const extractedCityName = words[0];
			const countyWord = words[1];

			// Only apply "City County" logic if the county word is likely a proper county name
			// that's different from common multi-word place names
			// Examples where we DO want city: Pikeville Pike, Jasper Walker, Dallas Paulding
			// Examples where we DON'T want city: Santa Fe, Palm Beach, St Clair (these are proper place names)
			if (!['fe', 'beach', 'del', 'la', 'los', 'las', 'san', 'saint', 'st', 'clair', 'le', 'du'].includes(countyWord.toLowerCase())) {
				return extractedCityName;
			}
		}

		// For true county-named facilities (like "Carroll County Regional"), keep the county
		return processingUtils.abbreviateCounty(countyName);
	}

	// Remove airport suffixes
	const baseMatch = cleaned.match(new RegExp(`^(.+?)\\s+(?:(?:${classificationsPattern})\\s+)*(?:${facilityTypesPattern}).*$`, 'i'));
	if (baseMatch) {
		let result = baseMatch[1].trim();

		// Handle "City Classification-Name" pattern by removing the classification
		result = result.replace(new RegExp(`\\s+(${classificationsPattern})(?=-[A-Za-z]).*$`, 'i'), '');

		// Apply dash cleanup for city-city patterns (with county handling)
		return cleanupHyphenatedCityPattern(result, { handleCounty: true });
	}

	// Match classification at the end: "Cleveland Municipal"
	const municipalMatch = cleaned.match(new RegExp(`^(.+?)\\s+(${classificationsPattern})$`, 'i'));
	if (municipalMatch) {
		return municipalMatch[1].trim();
	}

	// Match classification followed by additional qualifiers: "South St. Paul Municipal-Richard E. Flemi"
	const municipalWithQualifierMatch = cleaned.match(new RegExp(`^(.+?)\\s+(${classificationsPattern})[-\\s]`, 'i'));
	if (municipalWithQualifierMatch) {
		return municipalWithQualifierMatch[1].trim();
	}

	// Clean up common patterns
	cleaned = processingUtils.removeCoordinates(cleaned);

	// Handle hyphenated city-city patterns by taking the first city
	// e.g., "Eveleth-Virginia" → "Eveleth", "Halifax-Northampton" → "Halifax"
	// But preserve legitimate hyphenated names like multi-word cities
	cleaned = cleanupHyphenatedCityPattern(cleaned);

	// Ensure no leading/trailing spaces from substitutions
	cleaned = cleaned.trim();

	return cleaned;
}

// Extract display name with qualifier when needed
function extractDisplayNameWithQualifier(cityName, baseName, stationId = '') {
	if (!cityName) return baseName || '';

	// Remove proper names first, then state abbreviation, like in extractBaseCityName
	let cleanedCityName = processingUtils.removeProperNames(cityName);
	cleanedCityName = processingUtils.removeState(cleanedCityName);

	// Pre-cleaning: Handle "City, City-..." pattern where city name is duplicated
	cleanedCityName = normalizeDuplicateCityPattern(cleanedCityName);

	const cleaned = cleanCityText(cleanedCityName);

	// Handle simple hyphenated patterns first (like "Milwaukee-Timmerman")
	if (cleaned.includes('-') && !cleaned.includes(' - ')) {
		const hyphenParts = cleaned.split('-').map((p) => p.trim());
		if (hyphenParts.length === 2 && hyphenParts[0].toLowerCase() === baseName.toLowerCase()) {
			// "Milwaukee-Timmerman" with baseName "Milwaukee" → return "Timmerman"
			// "Henderson-Oxford Airport" with baseName "Henderson" → return "Oxford" (remove Airport suffix)
			return processTextFragment(hyphenParts[1]);
		}
	}

	// Handle dash patterns for qualifiers (e.g., "Pittsburgh - Allegheny County Airport" → "Allegheny Co")
	const dashParts = patternMatchers.extractDashParts(cleaned);
	if (dashParts) {
		const { before: beforeDash, after: afterDash } = dashParts;

		// If before dash matches our base name, use the after-dash part as qualifier
		if (beforeDash.toLowerCase() === baseName.toLowerCase()) {
			// Process the after-dash part to get a clean qualifier
			const qualifier = processTextFragment(afterDash);
			return qualifier;
		}

		// For military facilities, if before dash starts with base name and contains military terms, return the military name
		const baseNameWithSpace = `${baseName.toLowerCase()} `;
		if (beforeDash.toLowerCase().startsWith(baseNameWithSpace) && airportPatterns.militaryPattern.test(beforeDash)) {
			return processTextFragment(beforeDash);
		}
	}

	// For slash patterns like "Detroit/Grosse Ile, Grosse Ile Airport"
	const slashParts = patternMatchers.extractSlashParts(cleaned);
	if (slashParts) {
		const {
			first: firstPart, second: secondPart, firstIsMilitary, secondIsMilitary,
		} = slashParts;

		// Check for military facility patterns first
		if (secondPart) {
			// Pattern: "Luke Air Force Base / Phoenix" with baseName "Phoenix" → return "Luke AFB"
			if (firstIsMilitary && !secondIsMilitary && secondPart.toLowerCase() === baseName.toLowerCase()) {
				return processTextFragment(firstPart);
			}

			// Pattern: "Dayton / Wright-Patterson Air Force Base" with baseName "Dayton" → return "Wright-Patterson AFB"
			if (!firstIsMilitary && secondIsMilitary && firstPart.toLowerCase() === baseName.toLowerCase()) {
				return processTextFragment(secondPart);
			}

			// If this is a military facility pattern but neither matches baseName, just return the base name
			if ((firstIsMilitary && !secondIsMilitary) || (secondIsMilitary && !firstIsMilitary)) {
				return baseName;
			}
		}

		// Original logic for non-military patterns
		// If the first part matches our base name, use the second part as qualifier
		if (firstPart.toLowerCase() === baseName.toLowerCase() || firstPart.toLowerCase().includes(baseName.toLowerCase())) {
			// Handle cases like "Detroit/Grosse Ile, Grosse Ile Airport"
			if (secondPart.includes(',')) {
				return processTextFragment(secondPart.split(',')[0].trim());
			}
			return processTextFragment(secondPart);
		}
	}

	// For comma patterns like "Detroit, Willow Run Airport"
	const commaParts = patternMatchers.extractCommaParts(cleaned);
	if (commaParts) {
		const { before: beforeComma, after: afterComma } = commaParts;

		// If before comma is just the base city name, use what's after
		if (beforeComma.toLowerCase() === baseName.toLowerCase()) {
			// "Detroit, Willow Run Airport" → "Willow Run"
			let cleanedAfter = afterComma.replace(airportPatterns.fullSuffixPattern, '').trim();

			// Handle multiple qualifiers separated by commas - take the first meaningful one
			if (cleanedAfter.includes(',')) {
				const qualifierParts = cleanedAfter.split(',').map((p) => p.trim());
				// Take the first non-empty, non-generic part
				const excludePattern = new RegExp(`^(${airportPatterns.facilityTypes.concat(airportPatterns.classifications, airportPatterns.military).join('|')})$`, 'i');
				const meaningfulPart = qualifierParts.find((part) => part && !part.match(excludePattern));
				if (meaningfulPart) {
					cleanedAfter = meaningfulPart;
				}
			}

			// For military designations that got abbreviated, combine with base name
			if (cleanedAfter.match(new RegExp(`^(${airportPatterns.military.join('|')})$`, 'i'))) {
				return `${baseName} ${cleanedAfter}`;
			}

			// Abbreviate county names in qualifiers
			if (cleanedAfter.match(/\bCounty$/i)) {
				cleanedAfter = processingUtils.abbreviateCounty(cleanedAfter);
			}

			return cleanedAfter;
		}

		// "Cleveland, Burke Lakefront Airport" → "Cleveland Burke" or "Burke Lakefront"
		// Handle qualifiers that may have descriptive words
		const qualifierMatch = afterComma.match(new RegExp(`^([A-Za-z\\s]+?)(?:\\s+(?:${facilityTypesPattern}))?$`, 'i'));
		if (qualifierMatch) {
			const qualifier = qualifierMatch[1].trim();
			// Don't combine if qualifier is just facility types or classifications
			if (!qualifier.match(new RegExp(`^(${airportPatterns.facilityTypes.concat(airportPatterns.classifications).join('|')})$`, 'i'))) {
				// For single-word qualifiers, combine with base name
				const qualifierWords = qualifier.split(/\s+/);
				if (qualifierWords.length === 1) {
					return `${baseName} ${qualifier}`;
				}
				// For multi-word qualifiers, return as-is if it makes sense
				return qualifier;
			}
		}
	}

	// Direct patterns like "Cleveland Municipal Airport" or extract type qualifier from anywhere in the name
	const lowerCleaned = cleaned.toLowerCase();
	const lowerBaseName = baseName.toLowerCase();

	// Check for type qualifiers in the name
	const typeMatch = cleaned.match(new RegExp(`\\b(${airportPatterns.classifications.slice(2).join('|')})\\b`, 'i'));
	if (typeMatch) {
		return `${baseName} ${typeMatch[1]}`;
	}

	if (lowerCleaned.startsWith(lowerBaseName)) {
		const suffix = cleaned.substring(baseName.length).trim();
		// Check for airport type qualifiers in suffix
		const suffixTypeMatch = suffix.match(new RegExp(`^(${airportPatterns.classifications.slice(2).join('|')})(?:\\s+(?:${airportPatterns.facilityTypes.slice(0, 4).join('|')}))?`, 'i'));
		if (suffixTypeMatch) {
			return `${baseName} ${suffixTypeMatch[1]}`;
		}
	}

	// Check once if this is an "at/near" pattern
	const isAtNearPattern = cleaned.match(/\b(at|near)\b/i);

	// For "at/near" patterns, just use the baseName (they're handled in extractBaseCityName)
	if (isAtNearPattern) {
		return baseName;
	}

	// For patterns like "Detroit Lakes Airport-Wething Field" → "Detroit Lakes"
	const fullBaseMatch = cleaned.match(new RegExp(`^([^,-]+?)(?:\\s+(?:${facilityTypesPattern}))?$`, 'i'));
	if (fullBaseMatch && fullBaseMatch[1].toLowerCase() !== baseName.toLowerCase() && fullBaseMatch[1].toLowerCase().includes(baseName.toLowerCase())) {
		return fullBaseMatch[1].trim();
	}

	// For slash patterns like "Cleveland / Cuyahoga"
	if (cleaned.includes('/')) {
		const parts = cleaned.split('/').map((p) => p.trim());
		if (parts[0].toLowerCase() === baseName.toLowerCase() && parts[1]) {
			return parts[1];
		}
	}

	// Default: just return the base name, but check if we need a fallback qualifier
	// If the extracted name would be the same as the base name, we need to differentiate
	if (cleaned.toLowerCase().trim() === baseName.toLowerCase()) {
		// For stations without clear airport type information, use the 3-letter ICAO code as fallback
		// This handles cases like KANJ "Sault Ste. Marie" vs KCIU "Sault Ste Marie, Chippewa County International"
		// Extract the 3-letter code from station IDs like KCIU -> CIU, KANJ -> ANJ
		if (stationId && stationId.length === 4 && stationId.startsWith('K')) {
			const icaoCode = stationId.substring(1); // Remove the 'K' prefix
			return icaoCode;
		}
		// Final fallback
		return `${baseName} ${stationId}`;
	}

	return baseName;
}

const patternMatchers = {
	// Extract parts from dash patterns with validation
	extractDashParts: (text) => {
		if (!text.includes(' - ')) return null;
		const parts = text.split(' - ');
		const beforePart = parts[0].trim();
		const afterPart = parts[1].trim();
		return {
			before: beforePart,
			after: afterPart,
			isBeforeHighway: airportPatterns.highwayPattern.test(beforePart),
			isAfterCounty: /^[A-Za-z\s]+\s+County\s+/i.test(afterPart),
		};
	},

	// Extract parts from slash patterns with military detection
	extractSlashParts: (text) => {
		if (!text.includes('/')) return null;
		const parts = text.split('/').map((p) => p.trim());
		const firstPart = parts[0];
		const secondPart = parts[1] || '';
		return {
			first: firstPart,
			second: secondPart,
			firstIsMilitary: airportPatterns.militaryPattern.test(firstPart),
			secondIsMilitary: secondPart ? airportPatterns.militaryPattern.test(secondPart) : false,
		};
	},

	// Extract parts from comma patterns
	extractCommaParts: (text) => {
		if (!text.includes(',')) return null;
		const commaIndex = text.indexOf(',');
		return {
			before: text.substring(0, commaIndex).trim(),
			after: text.substring(commaIndex + 1).trim(),
		};
	},
};

// Utility functions for common processing patterns
const processingUtils = {
	// Remove proper names from city names to improve extraction accuracy
	removeProperNames: (cityName) => {
		const namesToRemovePattern = new RegExp(`\\b(${namesToRemove.join('|')})([ -]+|$)`, 'g');
		return cityName.replace(namesToRemovePattern, '');
	},

	// Remove state abbreviations (or Idaho) at the end of city names or before a comma ("Lago Vista, TX")
	removeState: (text) => text.replace(/,?\s+(?:(?:[A-Z]{2}|[A-Z][a-z])\.?|Idaho)(,|$)/, '$1').trim(),

	// Standardize county name abbreviation
	abbreviateCounty: (countyName) => countyName.replace(/\bCounty\b/g, 'Co.'),

	// Remove concatenated "AIRPORT" suffix (like "NEOSHOAIRPORT" -> "NEOSHO")
	removeConcatenatedAirport: (text) => text.replace(/([A-Za-z])AIRPORT$/i, '$1'),

	// Remove "International" and everything after it
	removeInternationalSuffix: (text) => text.replace(/\s*International.*$/i, '').trim(),

	// Remove "County" suffix only (not the word "County" in the middle)
	removeCountySuffix: (text) => text.replace(/\s+County$/i, '').trim(),

	// Remove geographic coordinate patterns
	removeCoordinates: (text) => text
		.replace(/\s+\d+[NSEW]{1,2}$/, '') // Remove patterns like "12N", "34SW"
		.replace(/\s+\d+[A-Z]?$/, ''), // Remove patterns like "15", "8A"

	// Remove military abbreviations when not needed for differentiation
	removeMilitaryAbbreviations: (text) => {
		const endPattern = new RegExp(`\\s+(${airportPatterns.military.join('|')})$`, 'g');
		return text.replace(endPattern, '').trim();
	},

	// Process county patterns and return appropriate city/county name
	handleCountyPattern: (text, options = {}) => {
		const { preferCity = false } = options;

		// Check for "City CountyName County" patterns
		const words = text.split(/\s+/);
		if (words.length === 3 && words[2].toLowerCase() === 'county') {
			const firstWord = words[0].toLowerCase();

			// If first word is very short or looks like an article/prefix, likely a multi-word city
			if (firstWord.length <= 3 || ['hot', 'van', 'st', 'fort', 'new', 'old', 'big', 'du', 'lac'].includes(firstWord)) {
				return processingUtils.abbreviateCounty(text); // Keep the full "Multi Word County"
			}

			if (preferCity) {
				return words[0]; // Just return the city name for "City County County"
			}
		}

		// Check for multi-word city + county patterns (e.g., "New Castle Henry County")
		if (words.length === 4 && words[3].toLowerCase() === 'county') {
			if (preferCity) {
				return `${words[0]} ${words[1]}`;
			}
		}

		// Default: abbreviate county
		return processingUtils.abbreviateCounty(text);
	},

	// Remove periods from the cleaned name unless it's at the end ("Co." or "Is.") and any leading "The"'s
	finalCleanup: (text) => text
		.replace(/\.(?!$)/g, '')
		.replace(/^The\s+(?!Dalles)/i, ''),
};

// Main entry point
function processAllStations(stationsObject) {
	// Process all stations
	const stationsByStateAndCity = {};
	const displayNames = {};

	// Group all stations by city
	Object.entries(stationsObject).forEach(([stationId, station]) => {
		if (!station || !station.city || !station.state) return;

		const { state } = station;
		const baseName = extractBaseCityName(station.city, stationId);

		if (!baseName) return;

		// For grouping purposes, normalize military base names to their city name
		// This ensures "Little Rock" and "Little Rock AFB" are grouped together
		const groupingBaseName = processingUtils.removeMilitaryAbbreviations(baseName);

		const normalizedBase = groupingBaseName.trim().toLowerCase();
		const groupKey = `${state}:${normalizedBase}`;

		if (!stationsByStateAndCity[groupKey]) {
			stationsByStateAndCity[groupKey] = {
				state,
				baseName: normalizedBase,
				originalBaseName: baseName,
				stations: [],
			};
		}

		stationsByStateAndCity[groupKey].stations.push({
			...station,
			stationId,
			type: getAirportType(station.city, stationId),
			priority: getAirportPriority(getAirportType(station.city, stationId)),
		});
	});

	// Process each city group using priority-based conflict resolution
	Object.values(stationsByStateAndCity).forEach((group) => {
		const cityStations = group.stations;

		if (cityStations.length === 1) {
			// Only station for this city - use simple name without military abbreviations
			const cleanedName = processingUtils.removeMilitaryAbbreviations(group.originalBaseName);
			displayNames[cityStations[0].stationId] = cleanedName;
		} else {
			// Multiple stations - use priority to assign names
			const sortedStations = [...cityStations].sort((a, b) => a.priority - b.priority);

			// Give the highest priority station the simple base name
			// Use the clean base name from the highest priority station to preserve original capitalization
			const primaryStation = sortedStations[0];
			const primaryBaseName = extractBaseCityName(primaryStation.city, primaryStation.stationId);
			const cleanPrimaryBaseName = processingUtils.removeMilitaryAbbreviations(primaryBaseName);

			// Highest priority station gets the simple name
			displayNames[primaryStation.stationId] = cleanPrimaryBaseName;

			// All other stations get qualifiers
			sortedStations.slice(1).forEach((station) => {
				displayNames[station.stationId] = extractDisplayNameWithQualifier(
					station.city,
					cleanPrimaryBaseName,
					station.stationId,
				);
			});
		}
	});

	return displayNames;
}

// Priority-based deduplication phase
function resolveDuplicatesByPriority(displayNames, stationsObject) {
	// Group stations by state and cleaned name to find duplicates
	const duplicateGroups = {};

	Object.entries(displayNames).forEach(([stationId, cleanedName]) => {
		const station = stationsObject[stationId];
		if (!station) return;

		const key = `${station.state}:${cleanedName.toLowerCase()}`;

		if (!duplicateGroups[key]) {
			duplicateGroups[key] = [];
		}

		duplicateGroups[key].push({
			stationId,
			station,
			cleanedName,
			type: getAirportType(station.city, stationId),
			priority: getAirportPriority(getAirportType(station.city, stationId)),
		});
	});

	// Process groups with duplicates
	Object.values(duplicateGroups).forEach((group) => {
		if (group.length <= 1) return; // Skip non-duplicates

		// Sort by priority (lower number = higher priority)
		const sortedGroup = [...group].sort((a, b) => a.priority - b.priority);

		// Check if we can resolve this conflict using priorities
		const priorities = sortedGroup.map((item) => item.priority);
		const uniquePriorities = [...new Set(priorities)];

		// Helper function to assign qualifiers to a group of stations
		const assignQualifiers = (stations, baseNameSource) => {
			stations.forEach((item) => {
				const qualifier = extractDisplayNameWithQualifier(item.station.city, baseNameSource.cleanedName, item.stationId);
				if (qualifier.toLowerCase() === baseNameSource.cleanedName.toLowerCase()) {
					const fallbackName = item.stationId.startsWith('K') ? item.stationId.substring(1) : item.stationId;
					displayNames[item.stationId] = fallbackName;
				} else {
					displayNames[item.stationId] = qualifier;
				}
			});
		};

		if (uniquePriorities.length > 1) {
			// We have different priorities, try to use them to resolve

			// Check if the highest priority station has a very descriptive original name that should be preserved
			const primaryStation = sortedGroup[0];
			const primaryOriginal = primaryStation.station.city;
			const hasDescriptiveName = primaryOriginal.includes(',');

			if (hasDescriptiveName) {
				// Give the descriptive name to the primary station
				const descriptiveName = extractDisplayNameWithQualifier(primaryOriginal, primaryStation.cleanedName, primaryStation.stationId);
				if (descriptiveName !== primaryStation.cleanedName) {
					displayNames[primaryStation.stationId] = descriptiveName;

					// Give the simple name to the next highest priority station
					if (sortedGroup.length > 1) {
						displayNames[sortedGroup[1].stationId] = sortedGroup[0].cleanedName;

						// All remaining stations get qualifiers
						assignQualifiers(sortedGroup.slice(2), sortedGroup[0]);
					}
				} else {
					// Fallback to normal logic if descriptive name extraction didn't work
					displayNames[primaryStation.stationId] = primaryStation.cleanedName;

					// Give qualifiers to all other stations
					assignQualifiers(sortedGroup.slice(1), sortedGroup[0]);
				}
			} else {
				// Normal logic: Give the simple name to the highest priority station
				displayNames[primaryStation.stationId] = primaryStation.cleanedName;

				// Give qualifiers to all other stations
				assignQualifiers(sortedGroup.slice(1), sortedGroup[0]);
			}
		} else if (group.length > 1) {
			// All have same priority - use secondary criteria for tie-breaking
			// Prefer weather stations (P-prefix), then alphabetical by station ID
			const tieBreakingSorted = [...sortedGroup].sort((a, b) => {
				// Weather stations (P-prefix) win ties
				const aIsWeatherStation = a.stationId.startsWith('P');
				const bIsWeatherStation = b.stationId.startsWith('P');

				if (aIsWeatherStation && !bIsWeatherStation) return -1;
				if (!aIsWeatherStation && bIsWeatherStation) return 1;

				// If both are same type, use alphabetical order
				return a.stationId.localeCompare(b.stationId);
			});

			// Give the simple name to the tie-breaker winner
			const primaryStation = tieBreakingSorted[0];
			displayNames[primaryStation.stationId] = primaryStation.cleanedName;

			// Give qualifiers to all other stations
			assignQualifiers(tieBreakingSorted.slice(1), primaryStation);
		}
	});

	return displayNames;
}

function compactStringifyToArray(arr) {
	const entries = arr.map((value, _index) => {
		const compactValue = JSON.stringify(value);
		return `  ${compactValue}`;
	});

	return `[\n${entries.join(',\n')}\n]`;
}

function compactStringifyToObject(data) {
	const obj = {};
	data.forEach((item) => {
		obj[item.id] = item;
	});

	const entries = Object.entries(obj).map(([key, value]) => {
		const compactValue = JSON.stringify(value);
		return `  "${key}": ${compactValue}`;
	});

	return `{\n${entries.join(',\n')}\n}`;
}

/*
Command line arguments for filtering output

Before making changes to this file, created a baseline:
	node station-name-processor.mjs --diff > baseline.json
and then after any change, run:
	diff baseline.json <(node station-name-processor.mjs --diff)
to easily confirm the change (and also make sure it didn't have any unexpected impact!)

jq is also very useful, you can do queries like this:
	node ./datagenerators/stations-postprocessor.mjs | jq -c '.[] | select(.city | test("Phoenix")) | {state, city, name, priority}'
or to look for names over 20 characters:
	jq -c '.[] | select(.potentialIssues | index("reallyLong")) | {state, city, name, priority}'
or to see places where this algorithm differs from the original algorithm:
	jq -c '.[] | select(.name != .simple) | {state, city, simple, name}'
or where the fallback to the ICAO airport code occurred:
	jq -c '.[] | select(.name | test("^[A-Z]{3}$")) | {state, city, simple, name}'
*/

const diffMode = process.argv.includes('--diff');
const onlyProblems = process.argv.includes('--only-problems');
const noProblems = process.argv.includes('--no-problems');
const onlyDuplicates = process.argv.includes('--only-dupes');
const noPriority = process.argv.includes('--no-priority');
const noSimple = process.argv.includes('--no-simple');
const noCoordinates = process.argv.includes('--no-coords');
const writeFile = process.argv.includes('--write');

// Process ALL stations at once to get the display name map
let displayNameMap = processAllStations(stationInfo);

// Apply priority-based deduplication
displayNameMap = resolveDuplicatesByPriority(displayNameMap, stationInfo);

const results = [];

// Now iterate through stations and use the pre-computed display names
const stations = Object.values(stationInfo);
stations.forEach((station) => {
	const originalName = station.city;
	const processedName = processingUtils.finalCleanup(displayNameMap[station.id]); // Look up by station ID

	// Get airport type and priority for this station
	const airportType = getAirportType(originalName, station.id); // Pass station ID for enhanced detection
	const priority = getAirportPriority(airportType);

	const potentialIssues = [];
	// Check if the processed name contains punctuation (a period at the end is OK)
	if (/[,;!?/:.]/.test(processedName) && !processedName.endsWith('.')) {
		potentialIssues.push('punctuation');
	}
	if (processedName.length > 12) {
		potentialIssues.push('long');
	}
	if (processedName.length > 20) {
		potentialIssues.push('reallyLong');
	}
	// check if it contains any digits
	if (/\d/.test(processedName)) {
		potentialIssues.push('digits');
	}

	results.push({
		id: station.id,
		lat: station.lat,
		lon: station.lon,
		state: station.state,
		location: originalName, // original full location name
		city: processedName, // processed city name for display
		simple: originalName.match(/[^,/;\\-]*/)[0].substr(0, 12).trim(),
		type: airportType,
		priority,
		potentialIssues,
	});
});

// Check for duplicates by state
const cleanedMapByState = new Map();

results.forEach((result) => {
	const { state } = result;
	if (!cleanedMapByState.has(state)) {
		cleanedMapByState.set(state, new Map());
	}
	const stateMap = cleanedMapByState.get(state);
	if (stateMap.has(result.city)) {
		stateMap.get(result.city).push(result);
	} else {
		stateMap.set(result.city, [result]);
	}
});

cleanedMapByState.forEach((stateMap, _state) => {
	stateMap.forEach((originals, _cleaned) => {
		if (originals.length > 1) {
			originals.forEach((original) => {
				if (!original.potentialIssues.includes('duplicate')) {
					original.potentialIssues.push('duplicate');
				}
			});
		}
	});
});

// Filter results if requested
let finalResults = results;
if (onlyProblems) {
	finalResults = results.filter((r) => r.potentialIssues.length > 0);
}
if (onlyDuplicates) {
	finalResults = finalResults.filter((r) => r.potentialIssues.includes('duplicate'));
}

const outputResult = finalResults.map((result) => {
	let outputItem = result;

	// Don't include lat or long in diff mode
	if (noCoordinates || diffMode) {
		const {
			lat: _lat, lon: _lon, ...resultWithoutLocation
		} = result;
		outputItem = resultWithoutLocation;
	}

	// Don't include potentialIssues when --no-problems is specified
	if (noProblems || diffMode) {
		const { potentialIssues: _potentialIssues, ...resultWithoutIssues } = outputItem;
		outputItem = resultWithoutIssues;
	}

	// Remove type and priority if --no-priority is specified
	if (noPriority || diffMode) {
		const { type: _type, priority: _priority, ...resultWithoutPriority } = outputItem;
		outputItem = resultWithoutPriority;
	}

	// remove simple field if --no-simple is specified
	if (noSimple || diffMode) {
		const { simple: _simple, ...resultWithoutSimple } = outputItem;
		outputItem = resultWithoutSimple;
	}

	return outputItem;
});

if (writeFile) {
	const fileResults = results.map(({
		simple: _simple, type: _type, potentialIssues: _potentialIssues, ...rest
	}) => rest);

	writeFileSync('./datagenerators/output/stations.json', compactStringifyToObject(fileResults));
	console.log(`Wrote ${fileResults.length} processed stations to datagenerators/output/stations.json`);
} else {
	console.log(compactStringifyToArray(outputResult));
}

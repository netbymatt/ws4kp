// Data loader utility for fetching JSON data with cache-busting
const dataCache = {};

// Load data with version-based cache busting
const loadData = async (dataType, version = '') => {
	if (dataCache[dataType]) {
		return dataCache[dataType];
	}

	try {
		const url = `/data/${dataType}.json${version ? `?_=${version}` : ''}`;
		const response = await fetch(url);

		if (!response.ok) {
			throw new Error(`Failed to load ${dataType}: ${response.status}`);
		}

		const data = await response.json();
		dataCache[dataType] = data;
		return data;
	} catch (error) {
		console.error(`Error loading ${dataType}:`, error);
		throw error;
	}
};

// start off loading the data
const version = typeof OVERRIDES !== 'undefined' && OVERRIDES.VERSION ? OVERRIDES.VERSION : '';

const TravelCities = loadData('travelcities', version);
const RegionalCities = loadData('regionalcities', version);
const StationInfo = loadData('stations', version);

export {
	TravelCities,
	RegionalCities,
	StationInfo,
};

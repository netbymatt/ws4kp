// Data loader utility for fetching JSON data with cache-busting

let dataCache = {};

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

// Load all data types
const loadAllData = async (version = '') => {
	const [travelCities, regionalCities, stationInfo] = await Promise.all([
		loadData('travelcities', version),
		loadData('regionalcities', version),
		loadData('stations', version),
	]);

	// Set global variables for backward compatibility
	window.TravelCities = travelCities;
	window.RegionalCities = regionalCities;
	window.StationInfo = stationInfo;

	return { travelCities, regionalCities, stationInfo };
};

// Clear cache (useful for development)
const clearDataCache = () => {
	dataCache = {};
};

export {
	loadData,
	loadAllData,
	clearDataCache,
};

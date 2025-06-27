// Data loader utility for fetching JSON data with cache-busting
import { safeJson } from './utils/fetch.mjs';

// get version directly from the page to work around dependency cycle with progress.mjs
const version = document.querySelector('#version').innerHTML.replace(/\s/g, '');

// Load data with version-based cache busting
const loadData = async (dataType) => {
	try {
		const url = `/data/${dataType}.json${version ? `?_=${version}` : ''}`;
		const response = await safeJson(url);

		return response;
	} catch (error) {
		console.error(`Error loading ${dataType}:`, error);
		throw error;
	}
};

// get the three datatypes as promises
const TravelCities = loadData('travelcities');
const RegionalCities = loadData('regionalcities');
const StationInfo = loadData('stations');

// return the promises, the client will need to await for the data
export {
	TravelCities,
	RegionalCities,
	StationInfo,
};

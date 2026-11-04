// ATV fork: region configuration (single source of truth for geography)
// After editing, run: node custom/scripts/build-data.mjs

export default {
	name: 'Arkansas',

	// Communities shown on Travel Forecast, Regional Observations/Forecast and Latest Observations.
	// `station` is the ASOS/AWOS id used for observations. `point` (NWS grid point) is looked up
	// automatically and cached in custom/data/points-cache.json.
	communities: [
		{
			name: 'Fayetteville', role: 'Northwest', lat: 36.0626, lon: -94.1574, station: 'KFYV',
		},
		{
			name: 'Jonesboro', role: 'Northeast', lat: 35.8423, lon: -90.7043, station: 'KJBR',
		},
		{
			name: 'Fort Smith', role: 'West', lat: 35.3847, lon: -94.4214, station: 'KFSM',
		},
		{
			name: 'Little Rock', role: 'Central', lat: 34.7487, lon: -92.2749, station: 'KLIT',
		},
		{
			name: 'Pine Bluff', role: 'Southeast', lat: 34.2284, lon: -92.0032, station: 'KPBF',
		},
		{
			name: 'Texarkana', role: 'Southwest', lat: 33.4259, lon: -94.0485, station: 'KTXK',
		},
		{
			name: 'El Dorado', role: 'South', lat: 33.2076, lon: -92.6663, station: 'KELD',
		},
	],

	// Which observation stations ship in stations.json
	//   'communities' - only the stations above (map and Latest Observations show only these communities)
	//   'region'      - every upstream station inside `bounds` (denser map, more observations)
	stationsMode: 'communities',

	// Arkansas plus a small buffer; used by stationsMode 'region' and as a sanity check for communities
	bounds: {
		minLat: 32.9, maxLat: 36.6, minLon: -94.7, maxLon: -89.5,
	},
};

// station overrides are used to change the data for a station that is provided by the api
// the most common use is to adjust the city (station name) for formatting or to update an outdated name
// a complete station object looks like this:
// {
//   "id": "KMCO",	// 4-letter station identifier and key for lookups
//   "city": "Orlando International Airport", // name displayed for this station
//   "state": "FL",	// state
//   "lat": 28.41826,	// latitude of station
//   "lon": -81.32413 // longitude of station
// }
// any or all of the data for a station can be overwritten, follow the existing override patterns below

const overrides = {
	KBJC: {
		city: 'Rocky Mountain Metro',
	},
};

export default overrides;

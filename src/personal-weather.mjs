// testing data for use with personal weather stations via
// ambient-relay https://github.com/jasonkonen/ambient-relay
const ambientRelay = (req, res) => {
	res.json({
		"id": 123,
		"mac_address": "00:00:00:00:00:00",
		"device_name": "My Weather Station",
		"device_location": "Backyard",
		"dateutc": 1515436500000,
		"date": "2018-01-08T18:35:00.000Z",
		"tempf": 66.9,
		"humidity": 30,
		"windspeedmph": 0.9,
		"baromrelin": 30.05,
		"dailyrainin": 0,
		"raw_data": {}
	})
}

export default ambientRelay;
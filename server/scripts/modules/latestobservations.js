// current weather conditions display
/* globals WeatherDisplay, utils, STATUS, UNITS, draw, navigation, StationInfo */

// eslint-disable-next-line no-unused-vars
class LatestObservations extends WeatherDisplay {
	constructor(navId, elemId) {
		super(navId, elemId, 'Latest Observations');
		// pre-load background image (returns promise)
		this.backgroundImage = utils.image.load('images/BackGround1_1.png');

		// constants
		this.MaximumRegionalStations = 7;
	}

	async getData(_weatherParameters) {
		super.getData(_weatherParameters);
		const weatherParameters = _weatherParameters ?? this.weatherParameters;

		// calculate distance to each station
		const stationsByDistance = Object.keys(StationInfo).map((key) => {
			const station = StationInfo[key];
			const distance = utils.calc.distance(station.lat, station.lon, weatherParameters.latitude, weatherParameters.longitude);
			return { ...station, distance };
		});

		// sort the stations by distance
		const sortedStations = stationsByDistance.sort((a, b) => a.distance - b.distance);
		// try up to 30 regional stations
		const regionalStations = sortedStations.slice(0, 30);

		// get data for regional stations
		const allConditions = await Promise.all(regionalStations.map(async (station) => {
			try {
				const data = await utils.fetch.json(`https://api.weather.gov/stations/${station.id}/observations/latest`);
				// test for temperature, weather and wind values present
				if (data.properties.temperature.value === null
					|| data.properties.textDescription === ''
					|| data.properties.windSpeed.value === null) return false;
				// format the return values
				return {
					...data.properties,
					StationId: station.id,
					city: station.city,
				};
			} catch (e) {
				console.log(`Unable to get latest observations for ${station.id}`);
				return false;
			}
		}));
		// remove and stations that did not return data
		const actualConditions = allConditions.filter((condition) => condition);
		// cut down to the maximum of 7
		this.data = actualConditions.slice(0, this.MaximumRegionalStations);

		// test for at least one station
		if (this.data.length < 1) {
			this.setStatus(STATUS.noData);
			return;
		}
		this.setStatus(STATUS.loaded);
	}

	async drawCanvas() {
		super.drawCanvas();
		const conditions = this.data;

		// sort array by station name
		const sortedConditions = conditions.sort((a, b) => ((a.Name < b.Name) ? -1 : 1));

		this.context.drawImage(await this.backgroundImage, 0, 0);
		draw.horizontalGradientSingle(this.context, 0, 30, 500, 90, draw.topColor1, draw.topColor2);
		draw.triangle(this.context, 'rgb(28, 10, 87)', 500, 30, 450, 90, 500, 90);
		draw.horizontalGradientSingle(this.context, 0, 90, 52, 399, draw.sideColor1, draw.sideColor2);
		draw.horizontalGradientSingle(this.context, 584, 90, 640, 399, draw.sideColor1, draw.sideColor2);

		draw.titleText(this.context, 'Latest', 'Observations');

		if (navigation.units() === UNITS.english) {
			draw.text(this.context, 'Star4000 Small', '24pt', '#FFFFFF', 295, 105, `${String.fromCharCode(176)}F`, 2);
		} else {
			draw.text(this.context, 'Star4000 Small', '24pt', '#FFFFFF', 295, 105, `${String.fromCharCode(176)}C`, 2);
		}
		draw.text(this.context, 'Star4000 Small', '24pt', '#FFFFFF', 345, 105, 'WEATHER', 2);
		draw.text(this.context, 'Star4000 Small', '24pt', '#FFFFFF', 495, 105, 'WIND', 2);

		let y = 140;

		sortedConditions.forEach((condition) => {
			let Temperature = condition.temperature.value;
			let WindSpeed = condition.windSpeed.value;
			const windDirection = utils.calc.directionToNSEW(condition.windDirection.value);

			if (navigation.units() === UNITS.english) {
				Temperature = utils.units.celsiusToFahrenheit(Temperature);
				WindSpeed = utils.units.kphToMph(WindSpeed);
			}

			draw.text(this.context, 'Star4000', '24pt', '#FFFFFF', 65, y, condition.city.substr(0, 14), 2);
			draw.text(this.context, 'Star4000', '24pt', '#FFFFFF', 345, y, LatestObservations.shortenCurrentConditions(condition.textDescription).substr(0, 9), 2);

			if (WindSpeed > 0) {
				draw.text(this.context, 'Star4000', '24pt', '#FFFFFF', 495, y, windDirection + (Array(6 - windDirection.length - WindSpeed.toString().length).join(' ')) + WindSpeed.toString(), 2);
			} else if (WindSpeed === 'NA') {
				draw.text(this.context, 'Star4000', '24pt', '#FFFFFF', 495, y, 'NA', 2);
			} else {
				draw.text(this.context, 'Star4000', '24pt', '#FFFFFF', 495, y, 'Calm', 2);
			}

			const x = (325 - (Temperature.toString().length * 15));
			draw.text(this.context, 'Star4000', '24pt', '#FFFFFF', x, y, Temperature, 2);

			y += 40;
		});
		this.finishDraw();
	}

	static shortenCurrentConditions(_condition) {
		let condition = _condition;
		condition = condition.replace(/Light/, 'L');
		condition = condition.replace(/Heavy/, 'H');
		condition = condition.replace(/Partly/, 'P');
		condition = condition.replace(/Mostly/, 'M');
		condition = condition.replace(/Few/, 'F');
		condition = condition.replace(/Thunderstorm/, 'T\'storm');
		condition = condition.replace(/ in /, '');
		condition = condition.replace(/Vicinity/, '');
		condition = condition.replace(/ and /, ' ');
		condition = condition.replace(/Freezing Rain/, 'Frz Rn');
		condition = condition.replace(/Freezing/, 'Frz');
		condition = condition.replace(/Unknown Precip/, '');
		condition = condition.replace(/L Snow Fog/, 'L Snw/Fog');
		condition = condition.replace(/ with /, '/');
		return condition;
	}
}

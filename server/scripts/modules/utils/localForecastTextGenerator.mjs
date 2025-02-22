import { directionToNSEW } from './calc.mjs';

function generateLocalForecast(dateStamp, hourlyData) {
	const MORNING_HOURS = [...Array(12).keys()].map((h) => h + 6); // 6 AM - 6 PM
	const NIGHT_HOURS = [...Array(6).keys()].map((h) => h + 18).concat([...Array(6).keys()]); // 6 PM - 6 AM

	const phraseVariations = {
		'CHANCE OF PRECIPITATION': ['PRECIPITATION PROBABILITY', 'RAIN/SNOW CHANCES', 'EXPECTED PRECIPITATION LIKELIHOOD'],
		WIND: ['WINDS FROM THE', 'EXPECT WINDS COMING FROM', 'BREEZES BLOWING FROM'],
		CLOUDY: ['CLOUD COVER', 'SKIES WILL BE MOSTLY CLOUDY', 'OVERCAST CONDITIONS EXPECTED'],
		CLEAR: ['MOSTLY CLEAR SKIES', 'FEW CLOUDS EXPECTED', 'SKIES REMAINING CLEAR'],
		'SNOW SHOWERS': ['FLURRIES LIKELY', 'SNOWFALL EXPECTED', 'LIGHT SNOW POSSIBLE'],
	};

	const forecastTemplates = [
		'{period}... {weatherEvent}. {cloudCover}, WITH A {tempLabel} AROUND {temp}. {windInfo}. {precipChance}',
		'{period}: {weatherEvent}. EXPECT {cloudCover}, {tempLabel} NEAR {temp}. {windInfo}. {precipChance}',
		'{period}: {weatherEvent}. {cloudCover}, {tempLabel} CLOSE TO {temp}. {windInfo}. {precipChance}',
		'{weatherEvent} THIS {period}. {cloudCover}, WITH {tempLabel} AROUND {temp}. {windInfo}. {precipChance}',
		'{period} FORECAST: {weatherEvent}. {cloudCover}, {tempLabel} {temp}. {windInfo}. {precipChance}',
		'{period} OUTLOOK: {weatherEvent}. {cloudCover}, EXPECT A {tempLabel} AROUND {temp}. {windInfo}. {precipChance}',
		'{period} WEATHER: {weatherEvent}. {cloudCover}, {tempLabel} AT {temp}. {windInfo}. {precipChance}',
		'{period}: {weatherEvent}. {cloudCover}, {tempLabel} CLOSE TO {temp}. {windInfo}. {precipChance}',
	];

	function getMostFrequent(arr) {
		return arr.sort((a, b) => arr.filter((v) => v === a).length - arr.filter((v) => v === b).length).pop();
	}

	// eslint-disable-next-line no-shadow
	function processForecast(hourlyData, period) {
		const periodData = hourlyData.filter((entry) => (period === 'MORNING' ? MORNING_HOURS : NIGHT_HOURS).includes(new Date(entry.time).getHours()));

		if (!periodData.length) return null;

		const temps = periodData.map((entry) => entry.temperature_2m);
		const temp = period === 'MORNING' ? Math.max(...temps) : Math.min(...temps);
		const tempLabel = period === 'MORNING' ? 'HIGH' : 'LOW';

		const windSpeeds = periodData.map((entry) => entry.wind_speed_10m);
		const windDirs = periodData.map((entry) => entry.wind_direction_10m);
		const windInfo = `${directionToNSEW(getMostFrequent(windDirs))} WIND ${Math.min(...windSpeeds)} TO ${Math.max(...windSpeeds)} KPH`;

		const precipProbs = periodData.map((entry) => entry.precipitation_probability);
		const maxPrecip = Math.max(...precipProbs);
		let precipChance = 'PRECIPITATION NOT EXPECTED.';

		if (maxPrecip >= 30) {
			const peakHour = periodData.find((entry) => entry.precipitation_probability === maxPrecip)?.time;
			const hour = new Date(peakHour).getHours();
			const precipTime = `AFTER ${hour % 12 || 12} ${hour < 12 ? 'AM' : 'PM'}`;
			precipChance = `${phraseVariations['CHANCE OF PRECIPITATION'][Math.floor(Math.random() * 3)]} ${precipTime}. CHANCE IS ${maxPrecip}%.`;
		}

		const cloudCover = phraseVariations.CLOUDY[Math.floor(Math.random() * 3)];

		const weatherEvent = maxPrecip >= 30 ? 'A CHANCE OF SNOW SHOWERS' : 'CLEAR EXPECTED';

		const forecastText = forecastTemplates[Math.floor(Math.random() * forecastTemplates.length)]
			.replace('{period}', period)
			.replace('{weatherEvent}', weatherEvent)
			.replace('{cloudCover}', cloudCover)
			.replace('{tempLabel}', tempLabel)
			.replace('{temp}', temp)
			.replace('{windInfo}', windInfo)
			.replace('{precipChance}', precipChance)
			.replace(/\n/g, '')
			.replace(/\r/g, '');

		return {
			period,
			temperature: { label: tempLabel, value: temp },
			wind: windInfo,
			precipitation: precipChance,
			skyCondition: cloudCover,
			text: forecastText,
		};
	}

	// Generate forecast for the provided date
	const dayDate = new Date(dateStamp);
	const dayStr = dayDate.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();

	const dailyData = hourlyData.filter((entry) => new Date(entry.time).toDateString() === dayDate.toDateString());

	const morningForecast = processForecast(dailyData, 'MORNING');
	const nightForecast = processForecast(dailyData, 'NIGHT');

	const forecast = {
		date: dayStr,
		periods: {
			morning: morningForecast,
			night: nightForecast,
		},
	};

	return JSON.stringify(forecast, null, 2);
}

export {
	// eslint-disable-next-line import/prefer-default-export
	generateLocalForecast,
};

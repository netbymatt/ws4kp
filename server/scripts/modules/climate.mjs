// display text based precip and temperature information
import STATUS from './status.mjs';
import { safeJson } from './utils/fetch.mjs';
import WeatherDisplay from './weatherdisplay.mjs';
import { registerDisplay } from './navigation.mjs';
import { debugFlag } from './utils/debug.mjs';
import { DateTime } from '../vendor/auto/luxon.mjs';
import { timeZone } from './location.mjs';
import { distance } from './utils/calc.mjs';
import { temperature } from './utils/units.mjs';

class Climate extends WeatherDisplay {
	constructor(navId, elemId) {
		super(navId, elemId, 'Climate Information', true);
		this.showOnProgress = false;
	}

	async getData(weatherParameters, refresh) {
		if (!super.getData(weatherParameters, refresh)) return;

		// generate a station bounding box
		const { latitude: lat, longitude: lon } = this.weatherParameters;
		const west = (lon - 0.2).toFixed(2);
		const south = (lat - 0.2).toFixed(2);
		const east = (lon + 0.2).toFixed(2);
		const north = (lat + 0.2).toFixed(2);

		// compute month span (can't include today as we don't yet know the total precipitation)
		// so this may roll backwards into last month on the first of the month.
		const eDate = DateTime.local().setZone(timeZone()).plus({ days: -1 }).startOf('day');
		const sDate = eDate.startOf('month');

		// lookup the nearest ACIS station
		const rawStations = await safeJson('https://data.rcc-acis.org/StnMeta', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				bbox: `${west},${south},${east},${north}`,
				elems: 'pcpn,maxt,mint',
				sdate: sDate.toISODate(),
				edate: eDate.toISODate(),
				meta: 'name,sids,ll,valid_daterange',
			}),
		});

		if (!rawStations) {
			console.error('Could not find any stations for climate data');
			this.setStatus(STATUS.noData);
		}

		if (debugFlag('climate')) {
			console.log(`Climate: found ${rawStations.meta.length} nearby stations`);
		}

		// filter for stations that have all three elems with data, and where the data is as recent as yesterday
		const stationsWithData = rawStations.meta
			.filter((station) => station.valid_daterange.every((d) => d.length === 2))
			.filter((station) => station.valid_daterange.every((d) => (DateTime.fromISO(d[0]) <= sDate) && (DateTime.fromISO(d[1]) >= eDate)));

		if (debugFlag('climate')) {
			console.log(`Climate: found ${stationsWithData.length} stations with complete data`);
		}

		// sort remaining stations by distance, adding a distance property
		const stations = stationsWithData.map((station) => ({
			...station,
			distance: distance(lon, lat, station.ll[0], station.ll[1]),
		})).sort((a, b) => a.distance - b.distance);

		// grab the first station
		const station = stations[0];
		const sid = station.sids[0];

		if (!station) {
			console.error('After filtering, could not find any staitons with climate data');
			this.setStatus(STATUS.noData);
		}

		// query the station
		const [precip, normalTemperature] = await Promise.allSettled([
			getPrecip(sid, sDate, eDate),
			getTemperature(sid, sDate, eDate),
		]);

		// test for actual data
		if (!precip.value) {
			console.error('Unable to get precipitation climate data');
		}
		if (!normalTemperature.value) {
			console.error('Unable to get normal temperature climate data');
		}
		if (!precip.value || !normalTemperature.value) {
			this.setStatus(STATUS.failed);
			return;
		}

		// store the data
		this.data = {
			station,
			sid,
			sDate,
			eDate,
			precip: precip?.value,
			normalTemperature: normalTemperature?.value,
		};

		// update the status
		this.setStatus(STATUS.loaded);
	}

	async drawCanvas() {
		const fillValues = {};

		const {
			sDate, eDate, precip, normalTemperature,
		} = this.data;

		// dates
		fillValues['precip-dates'] = `${sDate.setLocale('en-US').toFormat('MMM d').toUpperCase()} TO ${eDate.setLocale('en-US').toFormat('MMM d').toUpperCase()}`;
		fillValues['temperature-dates'] = `${eDate.plus({ days: 1 }).setLocale('en-US').toFormat('MMMM d').toUpperCase()}`;

		// precipitation

		if (precip.trace && precip.actual === 0) {
			fillValues['actual-precip'] = 'TRACE';
		} else {
			fillValues['actual-precip'] = precip.actual;
		}
		fillValues['normal-precip'] = precip.normal;

		// high and low
		if (normalTemperature) {
			fillValues['normal-temp-high'] = normalTemperature.high;
			fillValues['normal-temp-low'] = normalTemperature.low;
		}

		// fill the tempalte
		const filledDisplay = this.fillTemplate('data', fillValues);
		const container = this.elem.querySelector('.container');
		container.innerHTML = '';
		container.append(filledDisplay);

		this.finishDraw();
	}
}

const getPrecip = async (sid, sDate, eDate) => {
	const precipRaw = await safeJson('https://data.rcc-acis.org/StnData', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			sid,
			sdate: sDate.toISODate(),
			edate: eDate.toISODate(),
			elems: [
				{ name: 'pcpn' },
				{ name: 'pcpn', normal: '1' },
			],
		}),

	});

	// do some calculations
	// precip is [date, actual rainfall, normal rainfall]
	const precip = precipRaw?.data?.reduce((prev, cur) => {
		const actualRaw = cur[1];
		const normal = parseFloat(cur[2]);
		let actual = 0;
		let trace = false;

		if (actualRaw === 'T' || actualRaw === 'M') {
			actual = 0;
			trace = true;
		} else {
			actual = parseFloat(actualRaw);
		}

		return {
			actual: prev.actual + actual,
			trace: prev.trace || trace,
			normal: prev.normal + normal,
		};
	}, {
		actual: 0,
		trace: false,
		normal: 0,
	});

	return precip;
};

const getTemperature = async (sid, eDate) => {
	const date = eDate.plus({ days: 1 }).toISODate();
	const temperatureRaw = await safeJson('https://data.rcc-acis.org/StnData', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			sid,
			sdate: date,
			edate: date,
			elems: [
				{ name: 'maxt', normal: '1' },
				{ name: 'mint', normal: '1' },
			],
		}),
	});

	const temperatureConverter = temperature('us');

	// format is [date,high,low]
	const normalTemperature = {
		high: temperatureConverter(parseFloat(temperatureRaw.data[0][1])),
		low: temperatureConverter(parseFloat(temperatureRaw.data[0][2])),
	};

	return normalTemperature;
};

// register display
registerDisplay(new Climate(11, 'climate'));

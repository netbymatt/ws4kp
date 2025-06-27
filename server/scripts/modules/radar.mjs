// current weather conditions display
import STATUS from './status.mjs';
import { DateTime } from '../vendor/auto/luxon.mjs';
import { safeText } from './utils/fetch.mjs';
import WeatherDisplay from './weatherdisplay.mjs';
import { registerDisplay, timeZone } from './navigation.mjs';
import * as utils from './radar-utils.mjs';
import setTiles from './radar-tiles.mjs';
import processRadar from './radar-processor.mjs';

// Use OVERRIDE_RADAR_HOST if provided, otherwise default to mesonet
const RADAR_HOST = (typeof OVERRIDES !== 'undefined' ? OVERRIDES?.RADAR_HOST : undefined) || 'mesonet.agron.iastate.edu';
class Radar extends WeatherDisplay {
	constructor(navId, elemId) {
		super(navId, elemId, 'Local Radar');

		this.okToDrawCurrentConditions = false;
		this.okToDrawCurrentDateTime = false;

		// set max images
		this.dopplerRadarImageMax = 6;
		// update timing
		this.timing.baseDelay = 350;
		this.timing.delay = [
			{ time: 4, si: 5 },
			{ time: 1, si: 0 },
			{ time: 1, si: 1 },
			{ time: 1, si: 2 },
			{ time: 1, si: 3 },
			{ time: 1, si: 4 },
			{ time: 4, si: 5 },
			{ time: 1, si: 0 },
			{ time: 1, si: 1 },
			{ time: 1, si: 2 },
			{ time: 1, si: 3 },
			{ time: 1, si: 4 },
			{ time: 4, si: 5 },
			{ time: 1, si: 0 },
			{ time: 1, si: 1 },
			{ time: 1, si: 2 },
			{ time: 1, si: 3 },
			{ time: 1, si: 4 },
			{ time: 12, si: 5 },
		];
	}

	async getData(weatherParameters, refresh) {
		if (!super.getData(weatherParameters, refresh)) return;

		// ALASKA AND HAWAII AREN'T SUPPORTED!
		if (this.weatherParameters.state === 'AK' || this.weatherParameters.state === 'HI') {
			this.setStatus(STATUS.noData);
			return;
		}

		const baseUrl = `https://${RADAR_HOST}/archive/data/`;
		const baseUrlEnd = '/GIS/uscomp/?F=0&P=n0r*.png'; // This URL returns an index of .png files for the given date

		// Always get today's data
		const today = DateTime.utc().startOf('day');
		const todayStr = today.toFormat('yyyy/LL/dd');
		const yesterday = today.minus({ days: 1 });
		const yesterdayStr = yesterday.toFormat('yyyy/LL/dd');
		const todayUrl = `${baseUrl}${todayStr}${baseUrlEnd}`;

		// Get today's data, then we'll see if we need yesterday's
		const todayList = await safeText(todayUrl);

		// Count available images from today
		let todayImageCount = 0;
		if (todayList) {
			const parser = new DOMParser();
			const xmlDoc = parser.parseFromString(todayList, 'text/html');
			const anchors = xmlDoc.querySelectorAll('a');
			todayImageCount = Array.from(anchors).filter((elem) => elem.innerHTML?.match(/n0r_\d{12}\.png/)).length;
		}

		// Only fetch yesterday's data if we don't have enough images from today
		// or if it's very early in the day when recent images might still be from yesterday
		const currentTimeUTC = DateTime.utc();
		const minutesSinceMidnight = currentTimeUTC.hour * 60 + currentTimeUTC.minute;
		const requiredTimeWindow = this.dopplerRadarImageMax * 5; // 5 minutes per image
		const needYesterday = todayImageCount < this.dopplerRadarImageMax || minutesSinceMidnight < requiredTimeWindow;

		// Build the final lists array
		const lists = [];
		if (needYesterday) {
			const yesterdayUrl = `${baseUrl}${yesterdayStr}${baseUrlEnd}`;
			const yesterdayList = await safeText(yesterdayUrl);
			if (yesterdayList) {
				lists.push(yesterdayList); // Add yesterday's data first
			}
		}
		if (todayList) {
			lists.push(todayList); // Add today's data
		}

		// convert to an array of png urls
		const pngs = lists.flatMap((html, htmlIdx) => {
			const parser = new DOMParser();
			const xmlDoc = parser.parseFromString(html, 'text/html');
			// add the base url - reconstruct the URL for each list
			const base = xmlDoc.createElement('base');
			if (htmlIdx === 0 && needYesterday) {
				// First item is yesterday's data when we fetched it
				base.href = `${baseUrl}${yesterdayStr}${baseUrlEnd}`;
			} else {
				// This is today's data (or the only data if yesterday wasn't fetched)
				base.href = `${baseUrl}${todayStr}${baseUrlEnd}`;
			}
			xmlDoc.head.append(base);
			const anchors = xmlDoc.querySelectorAll('a');
			const urls = [];
			Array.from(anchors).forEach((elem) => {
				if (elem.innerHTML?.match(/n0r_\d{12}\.png/)) {
					urls.push(elem.href);
				}
			});
			return urls;
		});

		// get the last few images
		const timestampRegex = /_(\d{12})\.png/;
		const sortedPngs = pngs.sort((a, b) => (a.match(timestampRegex)[1] < b.match(timestampRegex)[1] ? -1 : 1));
		const urls = sortedPngs.slice(-(this.dopplerRadarImageMax));

		// calculate offsets and sizes
		const offsetX = 120 * 2;
		const offsetY = 69 * 2;
		const sourceXY = utils.getXYFromLatitudeLongitudeMap(this.weatherParameters);
		const radarSourceXY = utils.getXYFromLatitudeLongitudeDoppler(this.weatherParameters, offsetX, offsetY);

		// set up the base map and overlay tiles
		setTiles({
			sourceXY,
			elemId: this.elemId,
		});

		// Load the most recent doppler radar images.
		try {
			const radarInfo = await Promise.all(urls.map(async (url) => {
				const processedRadar = await processRadar({
					url,
					RADAR_HOST,
					OVERRIDES,
					radarSourceXY,
				});

				// store the time
				const timeMatch = url.match(/_(\d{4})(\d\d)(\d\d)(\d\d)(\d\d)\./);

				const [, year, month, day, hour, minute] = timeMatch;
				const time = DateTime.fromObject({
					year,
					month,
					day,
					hour,
					minute,
				}, {
					zone: 'UTC',
				}).setZone(timeZone());

				const elem = this.fillTemplate('frame', { map: { type: 'img', src: processedRadar } });
				return {
					time,
					elem,
				};
			}));

			// put the elements in the container
			const scrollArea = this.elem.querySelector('.scroll-area');
			scrollArea.innerHTML = '';
			scrollArea.append(...radarInfo.map((r) => r.elem));

			// set max length
			this.timing.totalScreens = radarInfo.length;

			this.times = radarInfo.map((radar) => radar.time);
			this.setStatus(STATUS.loaded);
		} catch (_error) {
			// Radar fetch failed - skip this display in animation by setting totalScreens = 0
			this.timing.totalScreens = 0;
			if (this.isEnabled) this.setStatus(STATUS.failed);
		}
	}

	async drawCanvas() {
		super.drawCanvas();
		const time = this.times[this.screenIndex].toLocaleString(DateTime.TIME_SIMPLE);
		const timePadded = time.length >= 8 ? time : `&nbsp;${time}`;
		this.elem.querySelector('.header .right .time').innerHTML = timePadded;

		// get image offset calculation
		// is slides slightly because of scaling so we have to take a measurement from the rendered page
		const actualFrameHeight = this.elem.querySelector('.frame').scrollHeight;

		// scroll to image
		this.elem.querySelector('.scroll-area').style.top = `${-this.screenIndex * actualFrameHeight}px`;

		this.finishDraw();
	}
}

// register display
registerDisplay(new Radar(11, 'radar'));

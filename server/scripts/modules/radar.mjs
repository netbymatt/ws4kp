// current weather conditions display
import STATUS from './status.mjs';
import { DateTime } from '../vendor/auto/luxon.mjs';
import { text } from './utils/fetch.mjs';
import WeatherDisplay from './weatherdisplay.mjs';
import { registerDisplay, timeZone } from './navigation.mjs';
import * as utils from './radar-utils.mjs';
import { version } from './progress.mjs';
import { elemForEach } from './utils/elem.mjs';

// TEMPORARY fix to disable radar on ios safari. The same engine (webkit) is
// used for all ios browers (chrome, brave, firefox, etc) so it's safe to skip
// any subsequent narrowing of the user-agent.
const isIos = /iP(ad|od|hone)/i.test(window.navigator.userAgent);
// NOTE: iMessages/Messages preview is provided by an Apple scraper that uses a
// user-agent similar to: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_1)
// AppleWebKit/601.2.4 (KHTML, like Gecko) Version/9.0.1 Safari/601.2.4
// facebookexternalhit/1.1 Facebot Twitterbot/1.0`. There is currently a bug in
// Messages macos/ios where a constantly crashing website seems to cause an
// entire Messages thread to permanently lockup until the individual website
// preview is deleted! Messages ios will judder but allows the message to be
// deleted eventually. Messages macos beachballs forever and prevents the
// successful deletion. See
// https://github.com/netbymatt/ws4kp/issues/74#issuecomment-2921154962 for more
// context.
const isBot = /twitterbot|Facebot/i.test(window.navigator.userAgent);

const RADAR_HOST = 'mesonet.agron.iastate.edu';
class Radar extends WeatherDisplay {
	constructor(navId, elemId) {
		super(navId, elemId, 'Local Radar', !isIos && !isBot);

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

		// get the workers started
		if (!this.workers) {
			// get some web workers started
			this.workers = (new Array(this.dopplerRadarImageMax)).fill(null).map(() => radarWorker());
		}
		if (!this.fixedWorker) {
			// get the fixed background, overlay worker started
			this.fixedWorker = fixedRadarWorker();
		}

		const baseUrl = `https://${RADAR_HOST}/archive/data/`;
		const baseUrlEnd = '/GIS/uscomp/?F=0&P=n0r*.png';
		const baseUrls = [];
		let date = DateTime.utc().minus({ days: 1 }).startOf('day');

		// make urls for yesterday and today
		while (date <= DateTime.utc().startOf('day')) {
			baseUrls.push(`${baseUrl}${date.toFormat('yyyy/LL/dd')}${baseUrlEnd}`);
			date = date.plus({ days: 1 });
		}

		const lists = (await Promise.all(baseUrls.map(async (url) => {
			try {
				// get a list of available radars
				return text(url);
			} catch (error) {
				console.log('Unable to get list of radars');
				console.error(error);
				this.setStatus(STATUS.failed);
				return false;
			}
		}))).filter((d) => d);

		// convert to an array of gif urls
		const pngs = lists.flatMap((html, htmlIdx) => {
			const parser = new DOMParser();
			const xmlDoc = parser.parseFromString(html, 'text/html');
			// add the base url
			const base = xmlDoc.createElement('base');
			base.href = baseUrls[htmlIdx];
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
		const sourceXY = utils.getXYFromLatitudeLongitudeMap(this.weatherParameters, offsetX, offsetY);
		const radarSourceXY = utils.getXYFromLatitudeLongitudeDoppler(this.weatherParameters, offsetX, offsetY);

		const baseAndOverlayPromise = this.fixedWorker.processAssets({
			sourceXY,
			offsetX,
			offsetY,
		});

		// Load the most recent doppler radar images.
		const radarInfo = await Promise.all(urls.map(async (url, index) => {
			const processedRadar = await this.workers[index].processRadar({
				url,
				RADAR_HOST,
				OVERRIDES,
				sourceXY,
				radarSourceXY,
				offsetX,
				offsetY,
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

			const onscreenCanvas = document.createElement('canvas');
			onscreenCanvas.width = processedRadar.width;
			onscreenCanvas.height = processedRadar.height;
			const onscreenContext = onscreenCanvas.getContext('bitmaprenderer');
			onscreenContext.transferFromImageBitmap(processedRadar);

			const elem = this.fillTemplate('frame', { map: { type: 'canvas', canvas: onscreenCanvas } });
			return {
				time,
				elem,
			};
		}));
		// wait for the base and overlay
		const baseAndOverlay = await baseAndOverlayPromise;

		// calculate final tile size
		const finalTileSize = utils.mapSizeToFinalSize(utils.tileSize.x, utils.tileSize.y);
		// fill the tiles with the overlay
		elemForEach('.map-tiles img', (elem, index) => {
			// get the base image
			const base = baseAndOverlay[`t${index}Base`];
			// put it on a canvas
			const canvas = document.createElement('canvas');
			const context = canvas.getContext('bitmaprenderer');
			context.transferFromImageBitmap(base);
			// if it's not there, return (tile not needed)
			if (!base) return;
			// assign the bitmap to the image
			elem.width = finalTileSize.x;
			elem.height = finalTileSize.y;
			elem.src = canvas.toDataURL();
		});
		// shift the map tile container
		const tileShift = utils.modTile(sourceXY.x, sourceXY.y);
		const tileShiftStretched = utils.mapSizeToFinalSize(tileShift.x, tileShift.y);
		const mapTileContainer = this.elem.querySelector('.map-tiles');
		mapTileContainer.style.top = `${-tileShiftStretched.x}px`;
		mapTileContainer.style.left = `${-tileShiftStretched.y}px`;

		// put the elements in the container
		const scrollArea = this.elem.querySelector('.scroll-area');
		scrollArea.innerHTML = '';
		scrollArea.append(...radarInfo.map((r) => r.elem));

		// set max length
		this.timing.totalScreens = radarInfo.length;

		this.times = radarInfo.map((radar) => radar.time);
		this.setStatus(STATUS.loaded);
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

// create a radar worker with helper functions
const radarWorker = () => {
	// create the worker
	const worker = new Worker(`/resources/radar-worker.mjs?_=${version()}`, { type: 'module' });

	const processRadar = (data) => new Promise((resolve, reject) => {
		// prepare for done message
		worker.onmessage = (e) => {
			if (e?.data instanceof Error) {
				reject(e.data);
			} else if (e?.data instanceof ImageBitmap) {
				resolve(e.data);
			}
		};

		// start up the worker
		worker.postMessage(data);
	});

	// return the object
	return {
		processRadar,
	};
};

// create a radar worker for the fixed background images
const fixedRadarWorker = () => {
	// create the worker
	const worker = new Worker(`/resources/radar-worker-bg-fg.mjs?_=${version()}`, { type: 'module' });

	const processAssets = (data) => new Promise((resolve, reject) => {
		// prepare for done message
		worker.onmessage = (e) => {
			if (e?.data instanceof Error) {
				reject(e.data);
			} else if (e?.data?.t0Base instanceof ImageBitmap) {
				resolve(e.data);
			}
		};

		// start up the worker
		worker.postMessage(data);
	});

	// return the object
	return {
		processAssets,
	};
};

// register display
// TEMPORARY: except on IOS and bots
if (!isIos && !isBot) {
	registerDisplay(new Radar(11, 'radar'));
}

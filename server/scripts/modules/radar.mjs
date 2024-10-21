// current weather conditions display
import STATUS from './status.mjs';
import { DateTime } from '../vendor/auto/luxon.mjs';
import { loadImg } from './utils/image.mjs';
import { text } from './utils/fetch.mjs';
import { rewriteUrl } from './utils/cors.mjs';
import WeatherDisplay from './weatherdisplay.mjs';
import { registerDisplay, timeZone } from './navigation.mjs';
import * as utils from './radar-utils.mjs';

class Radar extends WeatherDisplay {
	constructor(navId, elemId) {
		super(navId, elemId, 'Local Radar', true);

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

	async getData(_weatherParameters) {
		if (!super.getData(_weatherParameters)) return;
		const weatherParameters = _weatherParameters ?? this.weatherParameters;

		// ALASKA AND HAWAII AREN'T SUPPORTED!
		if (weatherParameters.state === 'AK' || weatherParameters.state === 'HI') {
			this.setStatus(STATUS.noData);
			return;
		}

		// get the base map
		let src = 'images/4000RadarMap2.jpg';
		if (weatherParameters.State === 'HI') src = 'images/HawaiiRadarMap2.png';
		this.baseMap = await loadImg(src);

		const baseUrl = 'https://mesonet.agron.iastate.edu/archive/data/';
		const baseUrlEnd = '/GIS/uscomp/';
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
				return text(url, { cors: true });
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
				if (elem.innerHTML?.match(/n0r_\d{12}\.png/))	{
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
		let offsetX = 120;
		let offsetY = 69;
		const width = 2550;
		const height = 1600;
		offsetX *= 2;
		offsetY *= 2;
		const sourceXY = utils.getXYFromLatitudeLongitudeMap(weatherParameters, offsetX, offsetY);

		// create working context for manipulation
		const workingCanvas = document.createElement('canvas');
		workingCanvas.width = width;
		workingCanvas.height = height;
		const workingContext = workingCanvas.getContext('2d');
		workingContext.imageSmoothingEnabled = false;

		// calculate radar offsets
		const radarOffsetX = 120;
		const radarOffsetY = 70;
		const radarSourceXY = utils.getXYFromLatitudeLongitudeDoppler(weatherParameters, offsetX, offsetY);
		const radarSourceX = radarSourceXY.x / 2;
		const radarSourceY = radarSourceXY.y / 2;

		// Load the most recent doppler radar images.
		const radarInfo = await Promise.all(urls.map(async (url) => {
			// create destination context
			const canvas = document.createElement('canvas');
			canvas.width = 640;
			canvas.height = 367;
			const context = canvas.getContext('2d');
			context.imageSmoothingEnabled = false;

			// get the image
			const response = await fetch(rewriteUrl(url));

			// test response
			if (!response.ok) throw new Error(`Unable to fetch radar error ${response.status} ${response.statusText} from ${response.url}`);

			// get the blob
			const blob = await response.blob();

			// store the time
			const timeMatch = url.match(/_(\d{4})(\d\d)(\d\d)(\d\d)(\d\d)\./);
			let time;
			if (timeMatch) {
				const [, year, month, day, hour, minute] = timeMatch;
				time = DateTime.fromObject({
					year,
					month,
					day,
					hour,
					minute,
				}, {
					zone: 'UTC',
				}).setZone(timeZone());
			} else {
				time = DateTime.fromHTTP(response.headers.get('last-modified')).setZone(timeZone());
			}

			// assign to an html image element
			const imgBlob = await loadImg(blob);

			// draw the entire image
			workingContext.clearRect(0, 0, width, 1600);
			workingContext.drawImage(imgBlob, 0, 0, width, 1600);

			// get the base map
			context.drawImage(await this.baseMap, sourceXY.x, sourceXY.y, offsetX * 2, offsetY * 2, 0, 0, 640, 367);

			// crop the radar image
			const cropCanvas = document.createElement('canvas');
			cropCanvas.width = 640;
			cropCanvas.height = 367;
			const cropContext = cropCanvas.getContext('2d', { willReadFrequently: true });
			cropContext.imageSmoothingEnabled = false;
			cropContext.drawImage(workingCanvas, radarSourceX, radarSourceY, (radarOffsetX * 2), (radarOffsetY * 2.33), 0, 0, 640, 367);
			// clean the image
			utils.removeDopplerRadarImageNoise(cropContext);

			// merge the radar and map
			utils.mergeDopplerRadarImage(context, cropContext);

			const elem = this.fillTemplate('frame', { map: { type: 'img', src: canvas.toDataURL() } });

			return {
				canvas,
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
		// store the images
		this.data = radarInfo.map((radar) => radar.canvas);

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

// register display
registerDisplay(new Radar(10, 'radar'));

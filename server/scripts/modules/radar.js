// current weather conditions display
/* globals WeatherDisplay, utils, STATUS, draw, luxon */

// eslint-disable-next-line no-unused-vars
class Radar extends WeatherDisplay {
	constructor(navId, elemId) {
		super(navId, elemId, 'Local Radar');

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
		super.getData(_weatherParameters);
		const weatherParameters = _weatherParameters ?? this.weatherParameters;

		// ALASKA AND HAWAII AREN'T SUPPORTED!
		if (weatherParameters.state === 'AK' || weatherParameters.state === 'HI') {
			this.setStatus(STATUS.noData);
			return;
		}

		// date and time parsing
		const { DateTime } = luxon;

		// get the base map
		let src = 'images/4000RadarMap2.jpg';
		if (weatherParameters.State === 'HI') src = 'images/HawaiiRadarMap2.png';
		this.baseMap = await utils.image.load(src);

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
				const radarHtml = await utils.fetch.text(url, { cors: true });
				return radarHtml;
			} catch (e) {
				console.log('Unable to get list of radars');
				console.error(e);
				this.setStatus(STATUS.failed);
				return false;
			}
		}))).filter((d) => d);

		// convert to an array of gif urls
		const pngs = lists.map((html, htmlIdx) => {
			const parser = new DOMParser();
			const xmlDoc = parser.parseFromString(html, 'text/html');
			// add the base url
			const base = xmlDoc.createElement('base');
			base.href = baseUrls[htmlIdx];
			xmlDoc.head.append(base);
			const anchors = xmlDoc.getElementsByTagName('a');
			const urls = [];
			Array.from(anchors).forEach((elem) => {
				if (elem.innerHTML?.includes('.png') && elem.innerHTML?.includes('n0r_'))	{
					urls.push(elem.href);
				}
			});
			return urls;
		}).flat();

		// get the last few images
		const sortedPngs = pngs.sort((a, b) => (Date(a) < Date(b) ? -1 : 1));
		const urls = sortedPngs.slice(-(this.dopplerRadarImageMax));

		// calculate offsets and sizes
		let offsetX = 120;
		let offsetY = 69;
		const width = 2550;
		const height = 1600;
		offsetX *= 2;
		offsetY *= 2;
		const sourceXY = Radar.getXYFromLatitudeLongitudeMap(weatherParameters, offsetX, offsetY);

		// create working context for manipulation
		const workingCanvas = document.createElement('canvas');
		workingCanvas.width = width;
		workingCanvas.height = height;
		const workingContext = workingCanvas.getContext('2d');
		workingContext.imageSmoothingEnabled = false;

		// calculate radar offsets
		const radarOffsetX = 120;
		const radarOffsetY = 70;
		const radarSourceXY = Radar.getXYFromLatitudeLongitudeDoppler(weatherParameters, offsetX, offsetY);
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
			const response = await fetch(utils.cors.rewriteUrl(url));

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
				}).setZone();
			} else {
				time = DateTime.fromHTTP(response.headers.get('last-modified')).setZone();
			}

			// assign to an html image element
			const imgBlob = await utils.image.load(blob);

			// draw the entire image
			workingContext.clearRect(0, 0, width, 1600);
			workingContext.drawImage(imgBlob, 0, 0, width, 1600);

			// get the base map
			context.drawImage(await this.baseMap, sourceXY.x, sourceXY.y, offsetX * 2, offsetY * 2, 0, 0, 640, 367);

			// crop the radar image
			const cropCanvas = document.createElement('canvas');
			cropCanvas.width = 640;
			cropCanvas.height = 367;
			const cropContext = cropCanvas.getContext('2d');
			cropContext.imageSmoothingEnabled = false;
			cropContext.drawImage(workingCanvas, radarSourceX, radarSourceY, (radarOffsetX * 2), (radarOffsetY * 2.33), 0, 0, 640, 367);
			// clean the image
			Radar.removeDopplerRadarImageNoise(cropContext);

			// merge the radar and map
			Radar.mergeDopplerRadarImage(context, cropContext);

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
		if (this.screenIndex === -1) return;

		const { DateTime } = luxon;
		// Title
		draw.text(this.context, 'Arial', 'bold 28pt', '#ffffff', 155, 60, 'Local', 2);
		draw.text(this.context, 'Arial', 'bold 28pt', '#ffffff', 155, 95, 'Radar', 2);

		draw.text(this.context, 'Star4000', 'bold 18pt', '#ffffff', 438, 49, 'PRECIP', 2, 'center');
		draw.text(this.context, 'Star4000', 'bold 18pt', '#ffffff', 298, 73, 'Light', 2);
		draw.text(this.context, 'Star4000', 'bold 18pt', '#ffffff', 517, 73, 'Heavy', 2);

		let x = 362;
		const y = 52;
		draw.box(this.context, '#000000', x - 2, y - 2, 154, 28);
		draw.box(this.context, 'rgb(49, 210, 22)', x, y, 17, 24); x += 19;
		draw.box(this.context, 'rgb(28, 138, 18)', x, y, 17, 24); x += 19;
		draw.box(this.context, 'rgb(20, 90, 15)', x, y, 17, 24); x += 19;
		draw.box(this.context, 'rgb(10, 40, 10)', x, y, 17, 24); x += 19;
		draw.box(this.context, 'rgb(196, 179, 70)', x, y, 17, 24); x += 19;
		draw.box(this.context, 'rgb(190, 72, 19)', x, y, 17, 24); x += 19;
		draw.box(this.context, 'rgb(171, 14, 14)', x, y, 17, 24); x += 19;
		draw.box(this.context, 'rgb(115, 31, 4)', x, y, 17, 24); x += 19;

		this.context.drawImage(this.data[this.screenIndex], 0, 0, 640, 367, 0, 113, 640, 367);
		draw.text(this.context, 'Star4000 Small', '24pt', '#ffffff', 438, 105, this.times[this.screenIndex].toLocaleString(DateTime.TIME_SIMPLE), 2, 'center');

		// scroll to image
		this.elem.querySelector('.scroll-area').style.top = `${-this.screenIndex * 371}px`;

		this.finishDraw();
	}

	static getXYFromLatitudeLongitudeMap(pos, offsetX, offsetY) {
		let y = 0;
		let x = 0;
		const imgHeight = 3200;
		const imgWidth = 5100;

		y = (51.75 - pos.latitude) * 55.2;
		// center map
		y -= offsetY;

		// Do not allow the map to exceed the max/min coordinates.
		if (y > (imgHeight - (offsetY * 2))) {
			y = imgHeight - (offsetY * 2);
		} else if (y < 0) {
			y = 0;
		}

		x = ((-130.37 - pos.longitude) * 41.775) * -1;
		// center map
		x -= offsetX;

		// Do not allow the map to exceed the max/min coordinates.
		if (x > (imgWidth - (offsetX * 2))) {
			x = imgWidth - (offsetX * 2);
		} else if (x < 0) {
			x = 0;
		}

		return { x: x * 2, y: y * 2 };
	}

	static getXYFromLatitudeLongitudeDoppler(pos, offsetX, offsetY) {
		let y = 0;
		let x = 0;
		const imgHeight = 6000;
		const imgWidth = 2800;

		y = (51 - pos.latitude) * 61.4481;
		// center map
		y -= offsetY;

		// Do not allow the map to exceed the max/min coordinates.
		if (y > (imgHeight - (offsetY * 2))) {
			y = imgHeight - (offsetY * 2);
		} else if (y < 0) {
			y = 0;
		}

		x = ((-129.138 - pos.longitude) * 42.1768) * -1;
		// center map
		x -= offsetX;

		// Do not allow the map to exceed the max/min coordinates.
		if (x > (imgWidth - (offsetX * 2))) {
			x = imgWidth - (offsetX * 2);
		} else if (x < 0) {
			x = 0;
		}

		return { x: x * 2, y: y * 2 };
	}

	static removeDopplerRadarImageNoise(RadarContext) {
		const RadarImageData = RadarContext.getImageData(0, 0, RadarContext.canvas.width, RadarContext.canvas.height);

		// examine every pixel,
		// change any old rgb to the new-rgb
		for (let i = 0; i < RadarImageData.data.length; i += 4) {
			// i + 0 = red
			// i + 1 = green
			// i + 2 = blue
			// i + 3 = alpha (0 = transparent, 255 = opaque)
			let R = RadarImageData.data[i];
			let G = RadarImageData.data[i + 1];
			let B = RadarImageData.data[i + 2];
			let A = RadarImageData.data[i + 3];

			// is this pixel the old rgb?
			if ((R === 0 && G === 0 && B === 0)
            || (R === 0 && G === 236 && B === 236)
            || (R === 1 && G === 160 && B === 246)
            || (R === 0 && G === 0 && B === 246)) {
				// change to your new rgb

				// Transparent
				R = 0;
				G = 0;
				B = 0;
				A = 0;
			} else if ((R === 0 && G === 255 && B === 0)) {
				// Light Green 1
				R = 49;
				G = 210;
				B = 22;
				A = 255;
			} else if ((R === 0 && G === 200 && B === 0)) {
				// Light Green 2
				R = 0;
				G = 142;
				B = 0;
				A = 255;
			} else if ((R === 0 && G === 144 && B === 0)) {
				// Dark Green 1
				R = 20;
				G = 90;
				B = 15;
				A = 255;
			} else if ((R === 255 && G === 255 && B === 0)) {
				// Dark Green 2
				R = 10;
				G = 40;
				B = 10;
				A = 255;
			} else if ((R === 231 && G === 192 && B === 0)) {
				// Yellow
				R = 196;
				G = 179;
				B = 70;
				A = 255;
			} else if ((R === 255 && G === 144 && B === 0)) {
				// Orange
				R = 190;
				G = 72;
				B = 19;
				A = 255;
			} else if ((R === 214 && G === 0 && B === 0)
            || (R === 255 && G === 0 && B === 0)) {
				// Red
				R = 171;
				G = 14;
				B = 14;
				A = 255;
			} else if ((R === 192 && G === 0 && B === 0)
            || (R === 255 && G === 0 && B === 255)) {
				// Brown
				R = 115;
				G = 31;
				B = 4;
				A = 255;
			}

			RadarImageData.data[i] = R;
			RadarImageData.data[i + 1] = G;
			RadarImageData.data[i + 2] = B;
			RadarImageData.data[i + 3] = A;
		}

		RadarContext.putImageData(RadarImageData, 0, 0);

		// MapContext.drawImage(RadarContext.canvas, 0, 0);
	}

	static mergeDopplerRadarImage(mapContext, radarContext) {
		const mapImageData = mapContext.getImageData(0, 0, mapContext.canvas.width, mapContext.canvas.height);
		const radarImageData = radarContext.getImageData(0, 0, radarContext.canvas.width, radarContext.canvas.height);

		// examine every pixel,
		// change any old rgb to the new-rgb
		for (let i = 0; i < radarImageData.data.length; i += 4) {
			// i + 0 = red
			// i + 1 = green
			// i + 2 = blue
			// i + 3 = alpha (0 = transparent, 255 = opaque)

			// is this pixel the old rgb?
			if ((mapImageData.data[i] < 116 && mapImageData.data[i + 1] < 116 && mapImageData.data[i + 2] < 116)) {
				// change to your new rgb

				// Transparent
				radarImageData.data[i] = 0;
				radarImageData.data[i + 1] = 0;
				radarImageData.data[i + 2] = 0;
				radarImageData.data[i + 3] = 0;
			}
		}

		radarContext.putImageData(radarImageData, 0, 0);

		mapContext.drawImage(radarContext.canvas, 0, 0);
	}
}

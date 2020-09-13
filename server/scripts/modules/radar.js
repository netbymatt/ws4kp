// current weather conditions display
/* globals WeatherDisplay, utils, STATUS, draw, luxon */

// eslint-disable-next-line no-unused-vars
class Radar extends WeatherDisplay {
	constructor(navId,elemId) {
		super(navId,elemId,'Local Radar');

		// set max images
		this.dopplerRadarImageMax = 6;
		// update timing
		this.timing.baseDelay = 350;
		this.timing.delay = [
			{time: 4, si: 5},
			{time: 1, si: 0},
			{time: 1, si: 1},
			{time: 1, si: 2},
			{time: 1, si: 3},
			{time: 1, si: 4},
			{time: 4, si: 5},
			{time: 1, si: 0},
			{time: 1, si: 1},
			{time: 1, si: 2},
			{time: 1, si: 3},
			{time: 1, si: 4},
			{time: 4, si: 5},
			{time: 1, si: 0},
			{time: 1, si: 1},
			{time: 1, si: 2},
			{time: 1, si: 3},
			{time: 1, si: 4},
			{time: 12, si: 5},
		];

		// pre-load background image (returns promise)
		this.backgroundImage = utils.image.load('images/BackGround4_1.png');
	}

	async getData(weatherParameters) {
		super.getData();

		// ALASKA ISN'T SUPPORTED!
		if (weatherParameters.state === 'AK') {
			this.setStatus(STATUS.noData);
			return;
		}

		// date and time parsing
		const {DateTime} = luxon;

		// get the base map
		let src = 'images/4000RadarMap2.jpg';
		if (weatherParameters.State === 'HI') src = 'images/HawaiiRadarMap2.png';
		this.baseMap = await utils.image.load(src);

		const baseUrl = 'Conus/RadarImg/';

		let radarHtml;
		try {
			// get a list of available radars
			radarHtml = await $.ajax({
				type: 'GET',
				url: baseUrl,
				dataType: 'text',
				crossDomain: true,
			});
		} catch (e) {
			console.error('Unable to get list of radars');
			console.error(e);
			this.setStatus(STATUS.failed);
			return;
		}

		// convert to an array of gif urls
		const parser = new DOMParser();
		const xmlDoc = parser.parseFromString(radarHtml, 'text/html');
		const anchors = xmlDoc.getElementsByTagName('a');
		const gifs = [];
		for (let idx in anchors) {
			gifs.push(anchors[idx].innerHTML);
		}

		// filter for selected urls
		let filter = /Conus_\d/;
		if (weatherParameters.state === 'HI') filter = /hawaii_\d/;

		// get the last few images
		const urlsFull = gifs.filter(gif => gif && gif.match(filter));
		const urls = urlsFull.slice(-(this.dopplerRadarImageMax-1));

		// add additional 'latest.gif'
		if (weatherParameters.state !== 'HI') urls.push('latest_radaronly.gif');
		if (weatherParameters.state === 'HI') urls.push('hawaii_radaronly.gif');

		// calculate offsets and sizes
		let offsetX = 120;
		let offsetY = 69;
		let sourceXY;
		let width;
		let height;
		if (weatherParameters.State === 'HI') {
			width = 600;
			height = 571;
			sourceXY = this.getXYFromLatitudeLongitudeHI(weatherParameters.latitude, weatherParameters.longitude, offsetX, offsetY);
		} else {
			width = 2550;
			height = 1600;
			offsetX *= 2;
			offsetY *= 2;
			sourceXY = this.getXYFromLatitudeLongitudeDoppler(weatherParameters.latitude, weatherParameters.longitude, offsetX, offsetY);
		}

		// create working context for manipulation
		const workingCanvas = document.createElement('canvas');
		workingCanvas.width = width;
		workingCanvas.height = height;
		const workingContext = workingCanvas.getContext('2d');
		workingContext.imageSmoothingEnabled = false;

		// calculate radar offsets
		let radarOffsetX = 117;
		let radarOffsetY = 60;
		let radarSourceXY = this.getXYFromLatitudeLongitudeDoppler(weatherParameters.latitude, weatherParameters.longitude, offsetX, offsetY);
		let radarSourceX = radarSourceXY.x / 2;
		let radarSourceY = radarSourceXY.y / 2;

		if (weatherParameters.State === 'HI') {
			radarOffsetX = 120;
			radarOffsetY = 69;
			radarSourceXY = this.getXYFromLatitudeLongitudeHI(weatherParameters.latitude, weatherParameters.longitude, offsetX, offsetY);
			radarSourceX = radarSourceXY.x;
			radarSourceY = radarSourceXY.y;
		}

		// Load the most recent doppler radar images.
		const radarInfo = await Promise.all(urls.map(async (url) => {
			// create destination context
			const canvas = document.createElement('canvas');
			canvas.width = 640;
			canvas.height = 367;
			const context = canvas.getContext('2d');
			context.imageSmoothingEnabled = false;

			// get the image
			const [blob, status, xhr] = await (()=>new Promise((resolve, reject) => {
				$.ajaxCORS({
					type: 'GET',
					url: baseUrl + url,
					xhrFields: {
						responseType: 'blob',
					},
					crossDomain: true,
					success: (blob, status, xhr) => resolve([blob,status,xhr]),
					error: (xhr, status, e) => reject(e),
				});

			}))();

			// store the time
			const timeMatch = url.match(/_(\d{4})(\d\d)(\d\d)_(\d\d)(\d\d)_/);
			let time;
			if (timeMatch) {
				const [, year, month, day, hour, minute] = timeMatch;
				time = DateTime.fromObject({
					year,
					month,
					day,
					hour,
					minute,
					zone: 'UTC',
				}).setZone();
			} else {
				time = DateTime.fromHTTP(xhr.getResponseHeader('Last-Modified')).setZone();
			}

			// assign to an html image element
			const imgBlob = await utils.image.load(blob);

			// draw the entire image
			if (weatherParameters.State === 'HI') {
				workingContext.clearRect(0, 0, 571, 600);
				workingContext.drawImage(imgBlob, 0, 0, 571, 600);
			} else {
				workingContext.clearRect(0, 0, 2550, 1600);
				workingContext.drawImage(imgBlob, 0, 0, 2550, 1600);
			}

			// get the base map
			context.drawImage(await this.baseMap, sourceXY.x, sourceXY.y, offsetX*2, offsetY*2, 0, 0, 640, 367);

			// crop the radar image
			const cropCanvas = document.createElement('canvas');
			cropCanvas.width = 640;
			cropCanvas.height = 367;
			const cropContext = cropCanvas.getContext('2d');
			cropContext.imageSmoothingEnabled = false;
			cropContext.drawImage(workingCanvas, radarSourceX, radarSourceY, (radarOffsetX * 2), (radarOffsetY * 2.33), 0, 0, 640, 367);
			// clean the image
			this.removeDopplerRadarImageNoise(cropContext);

			// merge the radar and map
			this.mergeDopplerRadarImage(context, cropContext);

			return {
				canvas,
				time,
			};
		}));
		// set max length
		this.timing.totalScreens = radarInfo.length;
		// store the images
		this.data = radarInfo.map(radar=>radar.canvas);

		this.times = radarInfo.map(radar=>radar.time);
		this.setStatus(STATUS.loaded);
	}

	async drawCanvas() {
		super.drawCanvas();
		if (this.screenIndex === -1) return;
		this.context.drawImage(await this.backgroundImage, 0, 0);
		const {DateTime} = luxon;
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

		this.finishDraw();
	}

	// utility latitude/pixel conversions
	getXYFromLatitudeLongitude (Latitude, Longitude, OffsetX, OffsetY, state) {
		if (state === 'HI') return this.getXYFromLatitudeLongitudeHI(...arguments);
		let y = 0;
		let x = 0;
		const ImgHeight = 1600;
		const ImgWidth = 2550;

		y = (50.5 - Latitude) * 55.2;
		y -= OffsetY; // Centers map.
		// Do not allow the map to exceed the max/min coordinates.
		if (y > (ImgHeight - (OffsetY * 2))) {
			y = ImgHeight - (OffsetY * 2);
		} else if (y < 0) {
			y = 0;
		}

		x = ((-127.5 - Longitude) * 41.775) * -1;
		x -= OffsetX; // Centers map.
		// Do not allow the map to exceed the max/min coordinates.
		if (x > (ImgWidth - (OffsetX * 2))) {
			x = ImgWidth - (OffsetX * 2);
		} else if (x < 0) {
			x = 0;
		}

		return { x, y };
	}

	getXYFromLatitudeLongitudeHI(Latitude, Longitude, OffsetX, OffsetY) {
		let y = 0;
		let x = 0;
		const ImgHeight = 571;
		const ImgWidth = 600;

		y = (25 - Latitude) * 55.2;
		y -= OffsetY; // Centers map.
		// Do not allow the map to exceed the max/min coordinates.
		if (y > (ImgHeight - (OffsetY * 2))) {
			y = ImgHeight - (OffsetY * 2);
		} else if (y < 0) {
			y = 0;
		}

		x = ((-164.5 - Longitude) * 41.775) * -1;
		x -= OffsetX; // Centers map.
		// Do not allow the map to exceed the max/min coordinates.
		if (x > (ImgWidth - (OffsetX * 2))) {
			x = ImgWidth - (OffsetX * 2);
		} else if (x < 0) {
			x = 0;
		}

		return { x, y };
	}

	getXYFromLatitudeLongitudeDoppler (Latitude, Longitude, OffsetX, OffsetY) {
		let y = 0;
		let x = 0;
		const ImgHeight = 3200;
		const ImgWidth = 5100;

		y = (51.75 - Latitude) * 55.2;
		y -= OffsetY; // Centers map.
		// Do not allow the map to exceed the max/min coordinates.
		if (y > (ImgHeight - (OffsetY * 2))) {
			y = ImgHeight - (OffsetY * 2);
		} else if (y < 0) {
			y = 0;
		}

		x = ((-130.37 - Longitude) * 41.775) * -1;
		x -= OffsetX; // Centers map.
		// Do not allow the map to exceed the max/min coordinates.
		if (x > (ImgWidth - (OffsetX * 2))) {
			x = ImgWidth - (OffsetX * 2);
		} else if (x < 0) {
			x = 0;
		}

		return { x: x * 2, y: y * 2 };
	}

	removeDopplerRadarImageNoise (RadarContext) {
		const RadarImageData = RadarContext.getImageData(0, 0, RadarContext.canvas.width, RadarContext.canvas.height);

		// examine every pixel,
		// change any old rgb to the new-rgb
		for (let i = 0; i < RadarImageData.data.length; i += 4) {
			// i + 0 = red
			// i + 1 = green
			// i + 2 = blue
			// i + 3 = alpha (0 = transparent, 255 = opaque)
			let [R, G, B, A] = RadarImageData.data.slice(i,i+4);

			// is this pixel the old rgb?
			if ((R === 1 && G === 159 && B === 244)
				|| (R >= 200 && G >= 200 && B >= 200)
				|| (R === 4 && G === 233 && B === 231)
				|| (R === 3 && G === 0 && B === 244)) {
				// Transparent
				R = 0;
				G = 0;
				B = 0;
				A = 0;
			} else if (R === 2 && G === 253 && B === 2) {
				// Light Green 1
				R = 49;
				G = 210;
				B = 22;
				A = 255;
			} else if (R === 1 && G === 197 && B === 1) {
				// Light Green 2
				R = 0;
				G = 142;
				B = 0;
				A = 255;
			} else if (R === 0 && G === 142 && B === 0) {
				// Dark Green 1
				R = 20;
				G = 90;
				B = 15;
				A = 255;
			} else if (R === 253 && G === 248 && B === 2) {
				// Dark Green 2
				R = 10;
				G = 40;
				B = 10;
				A = 255;
			} else if (R === 229 && G === 188 && B === 0) {
				// Yellow
				R = 196;
				G = 179;
				B = 70;
				A = 255;
			} else if (R === 253 && G === 139 && B === 0) {
				// Orange
				R = 190;
				G = 72;
				B = 19;
				A = 255;
			} else if (R === 212 && G === 0 && B === 0) {
				// Red
				R = 171;
				G = 14;
				B = 14;
				A = 255;
			} else if (R === 188 && G === 0 && B === 0) {
				// Brown
				R = 115;
				G = 31;
				B = 4;
				A = 255;
			}

			// store new values
			RadarImageData.data[i] = R;
			RadarImageData.data[i + 1] = G;
			RadarImageData.data[i + 2] = B;
			RadarImageData.data[i + 3] = A;
		}

		// rewrite the image
		RadarContext.putImageData(RadarImageData, 0, 0);
	}

	mergeDopplerRadarImage (mapContext, radarContext) {
		var mapImageData = mapContext.getImageData(0, 0, mapContext.canvas.width, mapContext.canvas.height);
		var radarImageData = radarContext.getImageData(0, 0, radarContext.canvas.width, radarContext.canvas.height);

		// examine every pixel,
		// change any old rgb to the new-rgb
		for (var i = 0; i < radarImageData.data.length; i += 4) {
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
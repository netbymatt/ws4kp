// current weather conditions display
/* globals WeatherDisplay, utils, STATUS, draw */

// eslint-disable-next-line no-unused-vars
class Radar extends WeatherDisplay {
	constructor(navId,elemId,weatherParameters) {
		super(navId,elemId);

		// set max images
		this.dopplerRadarImageMax = 6;
		// update timing
		this.timing.baseDelay = 350;
		this.timing.delay = [4,1,1,1,1,1,12];

		// pre-load background image (returns promise)
		this.backgroundImage = utils.image.load('images/BackGround4_1.png');

		// get the data
		this.getData(weatherParameters);
	}

	async getData(weatherParameters) {
		super.getData();

		// ALASKA ISN'T SUPPORTED!
		if (weatherParameters.state === 'AK') {
			this.setStatus(STATUS.noData);
			return;
		}

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
			this.setStatus(STATUS.error);
			return;
		}

		// convert to an array of gif urls
		const $list = $(radarHtml);
		const gifs = $list.find('a[href]').map((i,elem) => elem.innerHTML).get();

		// filter for selected urls
		let filter = /^Conus_\d/;
		if (weatherParameters.State === 'HI') filter = /hawaii_\d/;

		// get the last few images
		const urlsFull = gifs.filter(gif => gif.match(filter));
		const urls = urlsFull.slice(-this.dopplerRadarImageMax);

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
		const radarCanvases = await Promise.all(urls.map(async (url) => {
			// create destination context
			const canvas = document.createElement('canvas');
			canvas.width = 640;
			canvas.height = 367;
			const context = canvas.getContext('2d');
			context.imageSmoothingEnabled = false;

			// get the image
			const blob = await $.ajaxCORS({
				type: 'GET',
				url: baseUrl + url,
				xhrFields: {
					responseType: 'blob',
				},
				crossDomain: true,
			});

			// assign to an html image element
			const imgBlob = await utils.image.load(blob);

			// draw the entire image
			if (weatherParameters.State === 'HI') {
				workingContext.drawImage(imgBlob, 0, 0, 571, 600);
			} else {
				workingContext.drawImage(imgBlob, 0, 0, 2550, 1600);
			}

			// clean the image
			this.removeDopplerRadarImageNoise(workingContext);

			// get the base map
			context.drawImage(await this.baseMap, sourceXY.x, sourceXY.y, offsetX*2, offsetY*2, 0, 0, 640, 367);

			// put the radar on top
			context.drawImage(workingCanvas, radarSourceX, radarSourceY, (radarOffsetX * 2), (radarOffsetY * 2.33), 0, 0, 640, 367);

			return canvas;
		}));
		// set max length
		this.timing.totalScreens = radarCanvases.length;
		// store the images
		this.data = radarCanvases;
		this.drawCanvas();
	}

	async drawCanvas() {
		super.drawCanvas();
		this.context.drawImage(await this.backgroundImage, 0, 0);

		// Title
		draw.text(this.context, 'Arial', 'bold 28pt', '#ffffff', 175, 65, 'Local', 2);
		draw.text(this.context, 'Arial', 'bold 28pt', '#ffffff', 175, 100, 'Radar', 2);

		draw.text(this.context, 'Arial', 'bold 18pt', '#ffffff', 390, 49, 'PRECIP', 2);
		draw.text(this.context, 'Arial', 'bold 18pt', '#ffffff', 298, 73, 'Light', 2);
		draw.text(this.context, 'Arial', 'bold 18pt', '#ffffff', 517, 73, 'Heavy', 2);

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

		draw.box(this.context, 'rgb(143, 73, 95)', 318, 83, 32, 24);
		draw.box(this.context, 'rgb(250, 122, 232)', 320, 85, 28, 20);
		draw.text(this.context, 'Arial', 'bold 18pt', '#ffffff', 355, 105, '= Incomplete Data', 2);

		this.context.drawImage(this.data[this.screenIndex], 0, 0, 640, 367, 0, 113, 640, 367);

		this.finishDraw();
		this.setStatus(STATUS.loaded);
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
}
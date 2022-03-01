// display sun and moon data

/* globals WeatherDisplay, utils, STATUS, draw, SunCalc, luxon */

// eslint-disable-next-line no-unused-vars
class Almanac extends WeatherDisplay {
	constructor(navId, elemId) {
		super(navId, elemId, 'Almanac');

		// pre-load background images (returns promises)
		this.backgroundImage0 = utils.image.load('images/BackGround3_1.png');
		this.backgroundImage1 = utils.image.load('images/BackGround1_1.png');

		// load all images in parallel (returns promises)
		this.moonImages = [
			utils.image.load('images/2/Full-Moon.gif'),
			utils.image.load('images/2/Last-Quarter.gif'),
			utils.image.load('images/2/New-Moon.gif'),
			utils.image.load('images/2/First-Quarter.gif'),
		];

		this.timing.totalScreens = 2;
	}

	async getData(_weatherParameters) {
		super.getData(_weatherParameters);
		const weatherParameters = _weatherParameters ?? this.weatherParameters;

		// get images for outlook
		const imagePromises = [
			utils.image.load('https://www.cpc.ncep.noaa.gov/products/predictions/30day/off14_temp.gif', true),
			utils.image.load('https://www.cpc.ncep.noaa.gov/products/predictions/30day/off14_prcp.gif', true),
		];

		// get sun/moon data
		const { sun, moon } = this.calcSunMoonData(weatherParameters);

		// process images for outlook
		const [outlookTemp, outlookPrecip] = await Promise.all(imagePromises);

		const outlook = Almanac.parseOutlooks(weatherParameters.latitude, weatherParameters.longitude, outlookTemp, outlookPrecip);

		// store the data
		this.data = {
			sun,
			moon,
			outlook,
		};
		// update status
		this.setStatus(STATUS.loaded);

		// share data
		this.getDataCallback();
	}

	calcSunMoonData(weatherParameters) {
		const { DateTime } = luxon;

		const sun = [
			SunCalc.getTimes(new Date(), weatherParameters.latitude, weatherParameters.longitude),
			SunCalc.getTimes(DateTime.local().plus({ days: 1 }).toJSDate(), weatherParameters.latitude, weatherParameters.longitude),
		];

		// brute force the moon phases by scanning the next 30 days
		const moon = [];
		// start with yesterday
		let moonDate = DateTime.local().minus({ days: 1 });
		let { phase } = SunCalc.getMoonIllumination(moonDate.toJSDate());
		let iterations = 0;
		do {
			// get yesterday's moon info
			const lastPhase = phase;
			// calculate new values
			moonDate = moonDate.plus({ days: 1 });
			phase = SunCalc.getMoonIllumination(moonDate.toJSDate()).phase;
			// check for 4 cases
			if (lastPhase < 0.25 && phase >= 0.25) moon.push(this.getMoonTransition(0.25, 'First', moonDate));
			if (lastPhase < 0.50 && phase >= 0.50) moon.push(this.getMoonTransition(0.50, 'Full', moonDate));
			if (lastPhase < 0.75 && phase >= 0.75) moon.push(this.getMoonTransition(0.75, 'Last', moonDate));
			if (lastPhase > phase) moon.push(this.getMoonTransition(0.00, 'New', moonDate));

			// stop after 30 days or 4 moon phases
			iterations += 1;
		} while (iterations <= 30 && moon.length < 4);

		return {
			sun,
			moon,
		};
	}

	// get moon transition from one phase to the next by drilling down by hours, minutes and seconds
	getMoonTransition(threshold, phaseName, start, iteration = 0) {
		let moonDate = start;
		let { phase } = SunCalc.getMoonIllumination(moonDate.toJSDate());
		let iterations = 0;
		const step = {
			hours: iteration === 0 ? -1 : 0,
			minutes: iteration === 1 ? 1 : 0,
			seconds: iteration === 2 ? -1 : 0,
			milliseconds: iteration === 3 ? 1 : 0,
		};

		// increasing test
		let test = (lastPhase, testPhase) => lastPhase < threshold && testPhase >= threshold;
		// decreasing test
		if (iteration % 2 === 0) test = (lastPhase, testPhase) => lastPhase > threshold && testPhase <= threshold;

		do {
		// store last phase
			const lastPhase = phase;
			// calculate new phase after step
			moonDate = moonDate.plus(step);
			phase = SunCalc.getMoonIllumination(moonDate.toJSDate()).phase;
			// wrap phases > 0.9 to -0.1 for ease of detection
			if (phase > 0.9) phase -= 1.0;
			// compare
			if (test(lastPhase, phase)) {
			// last iteration is three, return value
				if (iteration >= 3) break;
				// iterate recursively
				return this.getMoonTransition(threshold, phaseName, moonDate, iteration + 1);
			}
			iterations += 1;
		} while (iterations < 1000);

		return { phase: phaseName, date: moonDate };
	}

	// use the color of the pixel to determine the outlook
	static parseOutlooks(lat, lon, temp, precip) {
		const { DateTime } = luxon;
		const month = DateTime.local();
		const thisMonth = month.toLocaleString({ month: 'short' });
		const nextMonth = month.plus({ months: 1 }).toLocaleString({ month: 'short' });

		// draw the images on the canvases
		const tempContext = utils.image.drawLocalCanvas(temp);
		const precipContext = utils.image.drawLocalCanvas(precip);

		// get the color from each canvas
		const tempColor = Almanac.getOutlookColor(lat, lon, tempContext);
		const precipColor = Almanac.getOutlookColor(lat, lon, precipContext);

		return {
			thisMonth,
			nextMonth,
			temperature: Almanac.getOutlookTemperatureIndicator(tempColor),
			precipitation: Almanac.getOutlookPrecipitationIndicator(precipColor),
		};
	}

	static getOutlookColor(lat, lon, context) {
		let x = 0;
		let y = 0;

		// The height is in the range of latitude 75'N (top) - 15'N (bottom)
		y = ((75 - lat) / 53) * 707;

		if (lat < 48.83) {
			y -= Math.abs(48.83 - lat) * 2.9;
		}
		if (lon < -100.46) {
			y -= Math.abs(-100.46 - lon) * 1.7;
		} else {
			y -= Math.abs(-100.46 - lon) * 1.7;
		}

		// The width is in the range of the longitude ???
		x = ((-155 - lon) / -110) * 719; // -155 - -40

		if (lon < -100.46) {
			x -= Math.abs(-100.46 - lon) * 1;

			if (lat > 40) {
				x += Math.abs(40 - lat) * 4;
			} else {
				x -= Math.abs(40 - lat) * 4;
			}
		} else {
			x += Math.abs(-100.46 - lon) * 2;

			if (lat < 36 && lon > -90) {
				x += Math.abs(36 - lat) * 8;
			} else {
				x -= Math.abs(36 - lat) * 6;
			}
		}

		// The further left and right from lat 45 and lon -97 the y increases
		x = Math.round(x);
		y = Math.round(y);

		// Determine if there is any "non-white" colors around the area.
		// Search a 16x16 region.
		for (let colorX = x - 8; colorX <= x + 8; colorX += 1) {
			for (let colorY = y - 8; colorY <= y + 8; colorY += 1) {
				const pixelColor = Almanac.getPixelColor(context, colorX, colorY);
				if ((pixelColor.r !== 0 && pixelColor.g !== 0 && pixelColor.b !== 0)
					|| (pixelColor.r !== 255 && pixelColor.g !== 255 && pixelColor.b !== 255)) {
					return pixelColor;
				}
			}
		}

		return false;
	}

	// get rgb values of a pixel
	static getPixelColor(context, x, y) {
		const pixelData = context.getImageData(x, y, 1, 1).data;
		return {
			r: pixelData[0],
			g: pixelData[1],
			b: pixelData[2],
		};
	}

	// get temperature outlook from color
	static getOutlookTemperatureIndicator(pixelColor) {
		if (pixelColor.b > pixelColor.r) {
			return 'Below Normal';
		} if (pixelColor.r > pixelColor.b) {
			return 'Above Normal';
		}
		return 'Normal';
	}

	// get precipitation outlook from color
	static getOutlookPrecipitationIndicator(pixelColor) {
		if (pixelColor.g > pixelColor.r) {
			return 'Above Normal';
		} if (pixelColor.r > pixelColor.g) {
			return 'Below Normal';
		}
		return 'Normal';
	}

	async drawCanvas() {
		super.drawCanvas();
		const info = this.data;
		const { DateTime } = luxon;
		const Today = DateTime.local();
		const Tomorrow = Today.plus({ days: 1 });

		// extract moon images
		const [FullMoonImage, LastMoonImage, NewMoonImage, FirstMoonImage] = await Promise.all(this.moonImages);

		switch (this.screenIndex) {
		case 1: {
			this.context.drawImage(await this.backgroundImage1, 0, 0);
			draw.horizontalGradientSingle(this.context, 0, 30, 500, 90, draw.topColor1, draw.topColor2);
			draw.triangle(this.context, 'rgb(28, 10, 87)', 500, 30, 450, 90, 500, 90);
			draw.horizontalGradientSingle(this.context, 0, 90, 52, 399, draw.sideColor1, draw.sideColor2);
			draw.horizontalGradientSingle(this.context, 584, 90, 640, 399, draw.sideColor1, draw.sideColor2);

			draw.titleText(this.context, 'Almanac', 'Outlook');

			draw.text(this.context, 'Star4000', '24pt', '#FFFFFF', 320, 180, '30 Day Outlook', 2, 'center');

			const DateRange = `MID-${info.outlook.thisMonth.toUpperCase()} TO MID-${info.outlook.nextMonth.toUpperCase()}`;
			draw.text(this.context, 'Star4000', '24pt', '#FFFFFF', 320, 220, DateRange, 2, 'center');

			const Temperature = info.outlook.temperature;
			draw.text(this.context, 'Star4000', '24pt', '#FFFFFF', 70, 300, `Temperatures:  ${Temperature}`, 2);

			const Precipitation = info.outlook.precipitation;
			draw.text(this.context, 'Star4000', '24pt', '#FFFFFF', 70, 380, `Precipitation: ${Precipitation}`, 2);
			break;
		}
		case 0:
		default:
			// sun and moon data
			this.context.drawImage(await this.backgroundImage0, 0, 0);
			draw.horizontalGradientSingle(this.context, 0, 30, 500, 90, draw.topColor1, draw.topColor2);
			draw.triangle(this.context, 'rgb(28, 10, 87)', 500, 30, 450, 90, 500, 90);
			draw.horizontalGradientSingle(this.context, 0, 90, 640, 190, draw.sideColor1, draw.sideColor2);

			draw.titleText(this.context, 'Almanac', 'Astronomical');

			draw.text(this.context, 'Star4000', '24pt', '#FFFF00', 320, 120, Today.toLocaleString({ weekday: 'long' }), 2, 'center');
			draw.text(this.context, 'Star4000', '24pt', '#FFFF00', 500, 120, Tomorrow.toLocaleString({ weekday: 'long' }), 2, 'center');

			draw.text(this.context, 'Star4000', '24pt', '#FFFFFF', 70, 150, 'Sunrise:', 2);
			draw.text(this.context, 'Star4000', '24pt', '#FFFFFF', 270, 150, DateTime.fromJSDate(info.sun[0].sunrise).toLocaleString(DateTime.TIME_SIMPLE).toLowerCase(), 2);
			draw.text(this.context, 'Star4000', '24pt', '#FFFFFF', 450, 150, DateTime.fromJSDate(info.sun[1].sunrise).toLocaleString(DateTime.TIME_SIMPLE).toLowerCase(), 2);

			draw.text(this.context, 'Star4000', '24pt', '#FFFFFF', 70, 180, ' Sunset:', 2);
			draw.text(this.context, 'Star4000', '24pt', '#FFFFFF', 270, 180, DateTime.fromJSDate(info.sun[0].sunset).toLocaleString(DateTime.TIME_SIMPLE).toLowerCase(), 2);
			draw.text(this.context, 'Star4000', '24pt', '#FFFFFF', 450, 180, DateTime.fromJSDate(info.sun[1].sunset).toLocaleString(DateTime.TIME_SIMPLE).toLowerCase(), 2);

			draw.text(this.context, 'Star4000', '24pt', '#FFFF00', 70, 220, 'Moon Data:', 2);

			info.moon.forEach((MoonPhase, Index) => {
				const date = MoonPhase.date.toLocaleString({ month: 'short', day: 'numeric' });

				draw.text(this.context, 'Star4000', '24pt', '#FFFFFF', 120 + Index * 130, 260, MoonPhase.phase, 2, 'center');
				draw.text(this.context, 'Star4000', '24pt', '#FFFFFF', 120 + Index * 130, 390, date, 2, 'center');

				const image = (() => {
					switch (MoonPhase.phase) {
					case 'Full':
						return FullMoonImage;
					case 'Last':
						return LastMoonImage;
					case 'New':
						return NewMoonImage;
					case 'First':
					default:
						return FirstMoonImage;
					}
				})();
				this.context.drawImage(image, 75 + Index * 130, 270);
			});
			break;
		}

		this.finishDraw();
	}

	// make sun and moon data available outside this class
	// promise allows for data to be requested before it is available
	async getSun() {
		return new Promise((resolve) => {
			if (this.data) resolve(this.data);
			// data not available, put it into the data callback queue
			this.getDataCallbacks.push(resolve);
		});
	}
}

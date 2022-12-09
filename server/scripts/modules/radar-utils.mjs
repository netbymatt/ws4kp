const getXYFromLatitudeLongitudeMap = (pos, offsetX, offsetY) => {
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
};

const getXYFromLatitudeLongitudeDoppler = (pos, offsetX, offsetY) => {
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
};

const removeDopplerRadarImageNoise = (RadarContext) => {
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
};

const mergeDopplerRadarImage = (mapContext, radarContext) => {
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
};

export {
	getXYFromLatitudeLongitudeDoppler,
	getXYFromLatitudeLongitudeMap,
	removeDopplerRadarImageNoise,
	mergeDopplerRadarImage,
};

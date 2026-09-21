// map projection tools

// lat/lon boundaries for the associated map images
const BOUNDS = {
	'forecast-conus': {
		x: [-126, -65.5],
		y: [50.5, 23.5],
	},
	'radar-conus': {
		x: [-126, -65.5],
		y: [50.5, 23.5],
	},
};

const PROJECTIONS = {
	'forecast-conus': (lon0) => `+proj=merc +lon_0=${lon0} +datum=WGS84 +units=m +no_defs`,
	'radar-conus': (lon0) => `+proj=merc +lon_0=${lon0} +datum=WGS84 +units=m +no_defs`,
};

const OUTPUTSIZES = {
	'forecast-conus': {
		width: 3400,
		height: 2133,
	},
	'radar-conus': {
		width: 5100,
		height: 3200,
	},
};

// mapName from choices above
const createProjection = (mapName, _bounds, _outputSize) => {
	// get the projection and bounds
	const projString = PROJECTIONS[mapName];
	const bounds = _bounds ?? BOUNDS[mapName];
	const outputSize = _outputSize ?? OUTPUTSIZES[mapName];
	if (!projString || !bounds || !outputSize) throw new Error(`mapName '${mapName}' not found when creating projection`);

	// name the provided variables
	const [lonA, lonB] = bounds.x;
	const [latA, latB] = bounds.y;
	const { width, height } = outputSize;

	// center the projection on the bounds
	const lon0 = (lonA + lonB) / 2;
	const converter = proj4('WGS84', projString(lon0));

	// projected coordinates (meters) of the corners that map to pixel [0,0] and [width,height]
	const [x0, y0] = converter.forward([lonA, latA]);
	const [x1, y1] = converter.forward([lonB, latB]);

	// signed scales, so y flips automatically when y[0] is north
	let scaleX = width / (x1 - x0);
	let scaleY = height / (y1 - y0);
	let offsetX = 0;
	let offsetY = 0;

	// grow the input (lat/lon) boundaries as needed to keep aspect ratio
	const scale = Math.min(Math.abs(scaleX), Math.abs(scaleY));
	offsetX = (width - Math.abs(x1 - x0) * scale) / 2;
	offsetY = (height - Math.abs(y1 - y0) * scale) / 2;
	scaleX = Math.sign(scaleX) * scale;
	scaleY = Math.sign(scaleY) * scale;

	// [lon, lat] -> [px, py]
	const forward = ([lon, lat]) => {
		const [x, y] = converter.forward([lon, lat]);
		return [
			(x - x0) * scaleX + offsetX,
			(y - y0) * scaleY + offsetY,
		];
	};

	// [px, py] -> [lon, lat]
	const inverse = ([px, py]) => {
		const x = (px - offsetX) / scaleX + x0;
		const y = (py - offsetY) / scaleY + y0;
		return converter.inverse([x, y]);
	};

	return { forward, inverse };
};

export default createProjection;

export {
	BOUNDS,
	OUTPUTSIZES,
};

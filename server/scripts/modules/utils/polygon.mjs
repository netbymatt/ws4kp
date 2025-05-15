// handle multi-polygon and holes
const testPolygon = (point, _polygons) => {
	// turn everything into a multi polygon for ease of processing
	let polygons = [[..._polygons.coordinates]];
	if (_polygons.type === 'MultiPolygon') polygons = [..._polygons.coordinates];

	let inArea = false;

	polygons.forEach((_polygon) => {
		// copy the polygon
		const polygon = [..._polygon];
		// if a match has been found don't do anything more
		if (inArea) return;

		// polygons are defined as [[area], [optional hole 1], [optional hole 2], ...]
		const area = polygon.shift();
		// test if inside the initial area
		inArea = pointInPolygon(point, area);

		// if not in the area return false
		if (!inArea) return;

		// test the holes, if in any hole return false
		polygon.forEach((hole) => {
			if (pointInPolygon(point, hole)) {
				inArea = false;
			}
		});
	});
	return inArea;
};

const pointInPolygon = (point, polygon) => {
	// ray casting method from https://github.com/substack/point-in-polygon
	const x = point[0];
	const y = point[1];
	let inside = false;
	// eslint-disable-next-line no-plusplus
	for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
		const xi = polygon[i][0];
		const yi = polygon[i][1];
		const xj = polygon[j][0];
		const yj = polygon[j][1];
		const intersect = ((yi > y) !== (yj > y))
			&& (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);
		if (intersect) inside = !inside;
	}
	return inside;
};

export default testPolygon;

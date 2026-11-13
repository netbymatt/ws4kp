// map of the warnings in effect around the location, drawn over the radar base map
// only shown when at least one warning polygon falls inside the map

import STATUS from './status.mjs';
import WeatherDisplay from './weatherdisplay.mjs';
import { registerDisplay } from './navigation.mjs';
import { safeJson } from './utils/fetch.mjs';
import { debugFlag } from './utils/debug.mjs';
import createCanvas from './utils/create-canvas.mjs';
import { StationInfo } from './utils/data-loader.mjs';
import setTiles from './radar/tiles.mjs';
import calcView from './radar/view.mjs';
import getRecentRadars from './radar/get-recent.mjs';
import {
	RADAR_FINAL_SIZE, RADAR_IMAGE_COUNT, PX, PY,
} from './radar/constants.mjs';

// the warnings that are issued with a polygon, most significant first. the order is used for the
// color key and to draw the most significant warning on top
const WARNING_TYPES = [
	{ event: 'Tornado Warning', label: 'Tornado', color: '#ff0000' },
	{ event: 'Severe Thunderstorm Warning', label: 'Severe T\'Storm', color: '#ffff00' },
	{ event: 'Flash Flood Warning', label: 'Flash Flood', color: '#00ff00' },
	{ event: 'Extreme Wind Warning', label: 'Extreme Wind', color: '#ff00ff' },
	{ event: 'Snow Squall Warning', label: 'Snow Squall', color: '#ffffff' },
	{ event: 'Dust Storm Warning', label: 'Dust Storm', color: '#deb887' },
	{ event: 'Special Marine Warning', label: 'Special Marine', color: '#ffa500' },
	{ event: 'Flood Warning', label: 'Flood', color: '#00ffff' },
];

// any other warning that arrives with a polygon takes one of these, in alphabetical order of the event
const OTHER_COLORS = ['#ff80c0', '#b080ff', '#c0c0c0'];

// the header has room for this many lines in the color key
const KEY_MAX = 6;

const OUTLINE_WIDTH = 3;
const FILL_OPACITY = 0.15;
// matches the defaults of the text-shadow mixin in shared/_utils.scss
const SHADOW_OFFSET = 3;
const SHADOW_OUTLINE = 1.5;

// alerts are requested by state. states are found from the observation stations inside the map,
// plus this many pixels around it to catch a state that has a corner in view but no station there
const STATE_MARGIN = 60;

// time between radar images
const RADAR_INTERVAL = 300_000;

const isWarning = (alert) => /\bWarning$/i.test(alert?.properties?.event ?? '');

// the states that have a station on or near the map
const statesInView = async ({ user, projection, radarFinalSize }, state) => {
	const reach = {
		x: (radarFinalSize.width / 2) + STATE_MARGIN,
		y: (radarFinalSize.height / 2) + STATE_MARGIN,
	};
	const states = new Set([state]);
	Object.values(await StationInfo).forEach((station) => {
		const position = projection.forward([station.lon, station.lat]);
		if (Math.abs(position[PX] - user[PX]) <= reach.x && Math.abs(position[PY] - user[PY]) <= reach.y) states.add(station.state);
	});
	return [...states].filter((code) => /^[A-Z]{2}$/.test(code ?? ''));
};

const fetchAlerts = (params, options) => {
	const url = new URL('https://api.weather.gov/alerts/active');
	url.searchParams.append('status', 'actual');
	Object.entries(params).forEach(([key, value]) => url.searchParams.append(key, value));
	return safeJson(url, options);
};

// all the warnings that have a polygon for the provided states, or null if the request failed
const getWarnings = async (states, stillWaiting) => {
	const [land, marine] = await Promise.all([
		fetchAlerts({ area: states.join(',') }, { retryCount: 3, stillWaiting }),
		// marine zones are not part of any state. special marine warnings are the only marine
		// warning issued with a polygon, and there are few enough to ask for all of them
		fetchAlerts({ event: 'Special Marine Warning' }, { retryCount: 1 }),
	]);
	if (!land) return null;

	const warnings = new Map();
	[...(land.features ?? []), ...(marine?.features ?? [])].forEach((alert) => {
		if (alert.geometry && isWarning(alert)) warnings.set(alert.id, alert);
	});
	return [...warnings.values()];
};

// clip a ring of [x, y] to the view, what is left has fewer than 3 points when the ring is outside
const clipToView = (ring, size) => [
	// axis, limit, true when the inside is the greater side
	[PX, 0, true],
	[PX, size.width, false],
	[PY, 0, true],
	[PY, size.height, false],
].reduce((points, [axis, limit, greater]) => {
	const inside = (point) => (greater ? point[axis] >= limit : point[axis] <= limit);
	const crossing = (a, b) => {
		const t = (limit - a[axis]) / (b[axis] - a[axis]);
		return [a[PX] + ((b[PX] - a[PX]) * t), a[PY] + ((b[PY] - a[PY]) * t)];
	};
	const result = [];
	points.forEach((point, index) => {
		const previous = points.at(index - 1);
		if (inside(point)) {
			if (!inside(previous)) result.push(crossing(previous, point));
			result.push(point);
		} else if (inside(previous)) {
			result.push(crossing(previous, point));
		}
	});
	return result;
}, ring);

// geojson coordinates as a list of polygons, each [outline, hole, hole, ...]
const polygonsOf = (geometry) => {
	if (geometry.type === 'Polygon') return [geometry.coordinates];
	if (geometry.type === 'MultiPolygon') return geometry.coordinates;
	return [];
};

// the warnings that have at least one polygon on the map, with those polygons in view pixels
const warningsInView = (alerts, { user, projection, radarFinalSize }) => {
	const left = user[PX] - (radarFinalSize.width / 2);
	const top = user[PY] - (radarFinalSize.height / 2);
	const toView = (lonLat) => {
		const position = projection.forward(lonLat);
		return [position[PX] - left, position[PY] - top];
	};

	return alerts.map((alert) => ({
		event: alert.properties.event,
		polygons: polygonsOf(alert.geometry)
			.map((rings) => rings.map((ring) => ring.map(toView)))
			.filter((rings) => rings[0] && clipToView(rings[0], radarFinalSize).length >= 3),
	})).filter((warning) => warning.polygons.length > 0);
};

// label and color for each type of warning provided, most significant first
const keyFor = (warnings) => {
	const events = [...new Set(warnings.map((warning) => warning.event))];
	const known = WARNING_TYPES.filter((type) => events.includes(type.event));
	const other = events
		.filter((event) => !WARNING_TYPES.some((type) => type.event === event))
		.sort()
		.map((event, index) => ({
			event,
			label: event.replace(/\s+Warning$/i, ''),
			color: OTHER_COLORS[index % OTHER_COLORS.length],
		}));
	return [...known, ...other];
};

// a solid outline with a light fill of the same color for each warning
const drawWarnings = (warnings, key, size) => {
	const [canvas, context] = createCanvas(size);
	context.lineJoin = 'round';

	// the most significant is drawn last so it ends up on top
	const rank = (warning) => key.findIndex((type) => type.event === warning.event);
	[...warnings].sort((a, b) => rank(b) - rank(a)).forEach((warning) => {
		const { color } = key[rank(warning)];
		const path = new Path2D();
		warning.polygons.flat().forEach((ring) => {
			ring.forEach((point, index) => {
				if (index === 0) {
					path.moveTo(point[PX], point[PY]);
				} else {
					path.lineTo(point[PX], point[PY]);
				}
			});
			path.closePath();
		});

		context.globalAlpha = FILL_OPACITY;
		context.fillStyle = color;
		context.fill(path, 'evenodd');
		context.globalAlpha = 1;

		// the same shadow as the text (see text-shadow in shared/_utils.scss): a black copy of the
		// line offset down and to the right, and a black edge all the way around it
		context.strokeStyle = 'black';
		context.lineWidth = OUTLINE_WIDTH;
		context.translate(SHADOW_OFFSET, SHADOW_OFFSET);
		context.stroke(path);
		context.translate(-SHADOW_OFFSET, -SHADOW_OFFSET);
		context.lineWidth = OUTLINE_WIDTH + (SHADOW_OUTLINE * 2);
		context.stroke(path);
		context.strokeStyle = color;
		context.lineWidth = OUTLINE_WIDTH;
		context.stroke(path);
	});

	return canvas;
};

class ActiveWarnings extends WeatherDisplay {
	constructor(navId, elemId) {
		super(navId, elemId, 'Active Warnings', true);

		// the map fills the area where the current conditions scroll, and there is no clock in the header
		this.okToDrawCurrentConditions = false;
		this.okToDrawCurrentDateTime = false;
		// don't display on progress/navigation screen
		this.showOnProgress = false;

		// warnings change quickly, use the same 1-minute refresh as hazards
		this.refreshTime = 60_000;

		// 0 screens skips this during "play" until a warning is found
		this.timing.totalScreens = 0;
	}

	async getData(weatherParameters, refresh) {
		// a new location has nothing to show until its warnings are loaded
		if (!refresh) this.setScreens(0);
		if (!super.getData(weatherParameters, refresh)) return;

		// the base map does not cover alaska and hawaii
		if (this.weatherParameters.state === 'AK' || this.weatherParameters.state === 'HI') {
			this.setScreens(0);
			this.setStatus(STATUS.noData);
			return;
		}

		try {
			const view = calcView(this.weatherParameters);
			const states = await statesInView(view, this.weatherParameters.state);
			const warnings = await getWarnings(states, () => this.stillWaiting());
			// turned off while the request was running
			if (!this.isEnabled) return;

			// no fall back to a previous fetch, a warning that can not be confirmed is not shown
			if (!warnings) {
				if (debugFlag('verbose-failures')) {
					console.warn(`Active Warnings request failed for ${states.join(',')}`);
				}
				this.setScreens(0);
				this.setStatus(STATUS.failed);
				return;
			}

			this.data = warnings;
			await this.buildMap(view);
		} catch (error) {
			console.error(`Unexpected Active Warnings error: ${error.message}`);
			this.setScreens(0);
			if (this.isEnabled) this.setStatus(STATUS.failed);
		}
	}

	// all of the rendering happens here so that drawCanvas() has nothing to do but show the result
	async buildMap(view) {
		this.view = view;
		const warnings = warningsInView(this.data, view);

		if (debugFlag(this.elemId)) {
			console.log(`ActiveWarnings: ${warnings.length} of ${this.data.length} warning polygons are on the map [${warnings.map((warning) => warning.event).join(', ')}]`);
		}

		// nothing on the map, skip the display
		if (warnings.length === 0) {
			this.setScreens(0);
			this.setStatus(STATUS.noData);
			return;
		}

		const key = keyFor(warnings);
		const polygons = drawWarnings(warnings, key, view.radarFinalSize);
		const radar = await this.getRadar(view);
		if (!this.isEnabled) return;

		// base map and overlay tiles, with the radar between them and the warnings on top
		setTiles({
			user: view.user,
			elemId: this.elemId,
		});
		this.elem.querySelector('.radar-layer').replaceChildren(...(radar ? [radar] : []));
		this.elem.querySelector('.polygon-layer').replaceChildren(polygons);

		// color key for the warnings on the map only
		const legend = document.createElement('div');
		legend.classList.add('legend');
		legend.append(...key.slice(0, KEY_MAX).map((type) => {
			const line = document.createElement('div');
			line.textContent = type.label;
			line.style.color = type.color;
			return line;
		}));
		this.elem.querySelector('.header .right').replaceChildren(legend);

		this.setScreens(1);
		this.setStatus(STATUS.loaded);
	}

	// the most recent radar image for the view, or null when it is not available. the map is still
	// worth showing without it
	async getRadar({ user, projection, radarFinalSize }) {
		const key = `${user[PX]}-${user[PY]}-${radarFinalSize.width}x${radarFinalSize.height}-${Math.floor(Date.now() / RADAR_INTERVAL)}`;
		if (this.radar?.key === key) return this.radar.canvas;

		try {
			const images = await getRecentRadars(RADAR_IMAGE_COUNT, user, projection);
			const latest = images.at(-1);
			if (!latest) return null;

			// the canvas belongs to the radar cache and may be on the radar display, so take a copy
			const [canvas, context] = createCanvas(radarFinalSize);
			context.drawImage(latest.canvas, 0, 0);
			this.radar = { key, canvas };
			return canvas;
		} catch (error) {
			if (debugFlag('verbose-failures')) {
				console.warn(`ActiveWarnings: radar image unavailable (${error.message})`);
			}
			return null;
		}
	}

	setScreens(count) {
		this.timing.totalScreens = count;
		this.calcNavTiming();
	}

	reset() {
		super.reset();
		this.setScreens(0);
	}

	// the map is drawn for one view size, and a larger view can bring more warnings on to it
	async modeChanged() {
		if (!this.isEnabled || !this.view) return;
		if (this.status !== STATUS.loaded && this.status !== STATUS.noData) return;

		const size = RADAR_FINAL_SIZE();
		if (size.width === this.view.radarFinalSize.width && size.height === this.view.radarFinalSize.height) return;

		// what is on the page was drawn for the previous view, remove it rather than show it out of place
		this.elem.querySelector('.radar-layer').replaceChildren();
		this.elem.querySelector('.polygon-layer').replaceChildren();
		setTiles({
			user: calcView(this.weatherParameters).user,
			elemId: this.elemId,
		});

		await this.getData(this.weatherParameters, true);
		if (this.active) this.drawCanvas();
	}

	drawCanvas() {
		super.drawCanvas();
		this.finishDraw();
	}
}

// register display, immediately after hazards
registerDisplay(new ActiveWarnings(1, 'active-warnings'));

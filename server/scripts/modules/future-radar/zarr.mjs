/* eslint-disable no-bitwise */
/**
 * Minimal Zarr v2 reader for the hrrrzarr archive.
 *
 * This deliberately does not use a general Zarr library. We only ever read a
 * handful of known chunks from a known layout, so direct fetch() plus a Blosc
 * decoder is smaller and more transparent than a full chunk-grid abstraction —
 * and the archive's doubled group nesting tends to fight generic readers.
 */

import { SOURCE, RUN } from './config.mjs';

/* ------------------------------------------------------------------ *
 * URL construction
 * ------------------------------------------------------------------ */

/** Zero-pad to two digits. */
const pad2 = (n) => String(n).padStart(2, '0');

/**
 * Format a Date as the archive's YYYYMMDD path segment.
 * Always UTC — HRRR run hours are UTC and using local time here is a silent,
 * timezone-dependent bug.
 */
const formatRunDate = (runDate) => `${runDate.getUTCFullYear()}${pad2(runDate.getUTCMonth() + 1)}${pad2(runDate.getUTCDate())}`;

/**
 * Base URL of the Zarr store for one model run.
 * e.g. https://.../sfc/20260908/20260908_12z_fcst.zarr
 */
const buildStoreUrl = (runDate) => {
	const day = formatRunDate(runDate);
	const hour = pad2(runDate.getUTCHours());
	return `${SOURCE.baseUrl}/${SOURCE.levelType}/${day}/${day}_${hour}z_${SOURCE.modelType}.zarr`;
};

/**
 * URL of the array group for our variable.
 *
 * The level/variable pair repeats twice. That is not a typo — the archive nests
 * the array inside a subgroup of the same name.
 */
const buildArrayUrl = (runDate) => {
	const { level, variable } = SOURCE;
	return `${buildStoreUrl(runDate)}/${level}/${variable}/${level}/${variable}`;
};

/**
 * URL of a single chunk object.
 *
 * Zarr v2 chunk keys carry one index per dimension. The analysis arrays are 2-D
 * so their keys look like "4.3", but the forecast arrays are 3-D (time, y, x)
 * so the same spatial chunk is keyed "0.4.3". We derive the prefix from the
 * array's real dimensionality rather than assuming either shape.
 */
const buildChunkUrl = (runDate, chunkId, ndim) => {
	const key = ndim === 3 ? `0.${chunkId}` : chunkId;
	return `${buildArrayUrl(runDate)}/${key}`;
};

/* ------------------------------------------------------------------ *
 * Run discovery
 * ------------------------------------------------------------------ */

/** Current UTC time truncated to the top of the hour. */
const currentRunHour = () => {
	const now = new Date();
	return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours()));
};

/**
 * Fetch and parse a run's .zarray metadata.
 * Returns null if the run is not published (any non-200).
 *
 * This doubles as the existence probe: .zarray is a few hundred bytes of JSON
 * and carries the dtype, shape and compressor config we need anyway, so there
 * is no reason to probe with a separate HEAD request.
 */
const fetchArrayMeta = async (runDate) => {
	const url = `${buildArrayUrl(runDate)}/.zarray`;
	try {
		const response = await fetch(url);
		if (!response.ok) return null;
		return await response.json();
	} catch {
		// Network failure or CORS rejection — treat the same as "not there".
		return null;
	}
};

/**
 * Walk backwards from the current UTC hour until a published run is found.
 *
 * The Zarr conversion is a processing step layered on top of the operational
 * GRIB2 publish, so its lag is not identical to the model's own availability.
 * Looking back more than one hour meaningfully reduces false "unavailable"
 * states for the cost of one or two extra small requests.
 *
 * Returns { runDate, meta } or null if nothing in the window is available.
 */
const findLatestRun = async (maxLookbackHours = RUN.maxLookbackHours) => {
	const start = currentRunHour();

	for (let back = 0; back <= maxLookbackHours; back += 1) {
		const candidate = new Date(start.getTime() - back * 3600 * 1000);
		// Sequential by design: stop at the first published run instead of
		// firing every lookback hour's probe at once.
		// eslint-disable-next-line no-await-in-loop
		const meta = await fetchArrayMeta(candidate);
		if (meta) return { runDate: candidate, meta };
	}
	return null;
};

/* ------------------------------------------------------------------ *
 * Chunk fetch and decode
 * ------------------------------------------------------------------ */

/**
 * Convert a half-precision bit pattern to a JS number.
 * Used only when the archive stores this variable as float16.
 */
const float16ToNumber = (bits) => {
	const sign = (bits & 0x8000) ? -1 : 1;
	const exponent = (bits & 0x7c00) >> 10;
	const fraction = bits & 0x03ff;

	if (exponent === 0) return sign * (2 ** -14) * (fraction / 1024);
	if (exponent === 0x1f) return fraction ? NaN : sign * Infinity;
	return sign * (2 ** (exponent - 15)) * (1 + fraction / 1024);
};

/**
 * Reinterpret decompressed bytes as a Float32Array according to the dtype
 * declared in .zarray.
 *
 * The archive originally wrote float16 and has been migrating variables to
 * float32, so we read the dtype rather than hard-coding either one.
 */
const bytesToFloat32 = (bytes, dtype) => {
	const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

	if (dtype === '<f4') return new Float32Array(buffer);

	if (dtype === '<f2') {
		const halves = new Uint16Array(buffer);
		const out = new Float32Array(halves.length);
		for (let i = 0; i < halves.length; i += 1) out[i] = float16ToNumber(halves[i]);
		return out;
	}

	throw new Error(`Unsupported dtype ${dtype} — expected <f2 or <f4`);
};

/**
 * Decoded chunks, keyed by full URL.
 *
 * A refresh within the same model run asks for exactly the same chunks, and a
 * small change of location usually changes the window by less than a chunk,
 * so most requests are served from here.
 */
const chunkCache = new Map();

/** Drop everything cached. Call when moving to a different model run. */
const clearChunkCache = () => {
	chunkCache.clear();
};

/**
 * The Blosc decoder, loaded on first use.
 *
 * blosc.js is ~600 KB (the WASM codec is inlined as base64) and only this
 * display needs it, so it is split out of the displays bundle and fetched the
 * first time chunks are decoded. The promise is shared so every chunk waits on
 * one download, and it is cleared on failure so the next refresh can retry
 * instead of replaying a cached rejection forever.
 */
let bloscPromise;
const loadBlosc = () => {
	bloscPromise ??= import(/* webpackChunkName: "blosc" */ '../../vendor/auto/blosc.js')
		.then((module) => module.default)
		.catch((error) => {
			bloscPromise = undefined;
			throw error;
		});
	return bloscPromise;
};

/**
 * Fetch one chunk and return it as a Float32Array plus its own shape.
 *
 * Forecast chunks are 3-D cubes of (forecastHours, 150, 150), which means a
 * single request returns every forecast hour for that chunk. Analysis chunks
 * are a flat (150, 150).
 */
const fetchChunk = async (runDate, chunkId, meta, codecPromise) => {
	const url = buildChunkUrl(runDate, chunkId, meta.shape.length);

	const cached = chunkCache.get(url);
	if (cached) return cached;

	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Chunk ${chunkId} unavailable (HTTP ${response.status})`);
	}

	const compressed = new Uint8Array(await response.arrayBuffer());

	const codec = await codecPromise;
	const raw = await codec.decode(compressed);

	const values = bytesToFloat32(raw, meta.dtype);

	// Chunk shape from metadata; the time dimension is however many hours this
	// run actually carries, which varies by HRRR version and run hour.
	const [chunkY, chunkX] = meta.chunks.slice(-2);
	const timeSteps = values.length / (chunkY * chunkX);

	const chunk = {
		chunkId, values, timeSteps, chunkY, chunkX,
	};
	chunkCache.set(url, chunk);
	return chunk;
};

/**
 * Fetch every requested chunk in parallel.
 *
 * Uses allSettled so one bad chunk surfaces as a partial result rather than
 * discarding the chunks that did come back.
 */
const fetchChunks = async (runDate, chunkIds, meta) => {
	const codecPromise = loadBlosc().then((Blosc) => Blosc.fromConfig(meta.compressor));
	// every chunk awaits this and reports a failure through allSettled; this
	// keeps the promise itself from being flagged as an unhandled rejection
	codecPromise.catch(() => { });

	const settled = await Promise.allSettled(
		chunkIds.map((id) => fetchChunk(runDate, id, meta, codecPromise)),
	);

	const chunks = [];
	const errors = [];

	settled.forEach((result, index) => {
		if (result.status === 'fulfilled') chunks.push(result.value);
		else errors.push(`${chunkIds[index]}: ${result.reason.message}`);
	});

	return { chunks, errors };
};

export {
	findLatestRun,
	fetchChunks,
	clearChunkCache,
};

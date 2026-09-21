const SOURCE = {
	// Public MesoWest / University of Utah HRRR Zarr archive.
	baseUrl: 'https://hrrrzarr.s3.amazonaws.com',

	// 'sfc' = surface / 2-D diagnostic fields, 'prs' = isobaric 3-D fields.
	levelType: 'sfc',

	// Vertical level folder and GRIB2 short name.
	// Composite ("simulated") reflectivity lives at entire_atmosphere/REFC.
	level: 'entire_atmosphere',
	variable: 'REFC',

	// 'fcst' = forecast cube (F01..FXX in one chunk object).
	// 'anl'  = analysis, a single F00 slice.
	modelType: 'fcst',
};

const RUN = {
	// How many hourly runs to walk backwards through before giving up.
	// Each probe is a small .zarray GET, so this is cheap.
	maxLookbackHours: 3,
};

/**
 * Native HRRR grid geometry.
 *
 * The projection and origin below were checked by projecting grid point
 * (1798, 1058) forward: it lands at 47.842 N, 60.917 W, which matches the
 * published HRRR north-east corner. Chunk 0.0 is the south-west corner, so row
 * index increases northward and column index increases eastward.
 */
const GRID = {
	chunkSize: 150,
	cellSizeMeters: 3000,
	nx: 1799,
	ny: 1059,

	proj: '+proj=lcc +lat_1=38.5 +lat_2=38.5 +lat_0=38.5 +lon_0=-97.5 '
		+ '+R=6371229 +units=m +no_defs',

	// [lon, lat] of grid point (0, 0) — the south-west corner.
	originLonLat: [-122.719528, 21.138123],
};

const RENDER = {
	// Reflectivity below this is treated as no echo and drawn transparent.
	floorDbz: 5,

	// Values at or below this are treated as missing rather than as real data.
	// HRRR uses large negatives for "no return"; NaN also appears after decode.
	missingBelowDbz: -50,
};

export {
	SOURCE,
	RUN,
	GRID,
	RENDER,
};

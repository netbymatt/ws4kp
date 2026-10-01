// entry for the vendored proj4 build (see buildProj4 in update-vendor.mjs)
// proj4's own build registers 31 projections and the mgrs package, the app only needs:
// merc and longlat, which are built into proj4's core, and lcc for the HRRR grid in future radar
// a projection added to the app later has to be registered here, or proj4() throws an unknown projection error
import core from 'proj4/lib/core.js';
import Proj from 'proj4/lib/Proj.js';
import lcc from 'proj4/lib/projections/lcc.js';

Proj.projections.add(lcc);

// the app uses proj4 as a global, the same as proj4's own browser build
globalThis.proj4 = core;

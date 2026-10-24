// vendor scripts first so they're available on global objects
import './vendor/auto/swiped-events.js';
import './vendor/auto/proj4.js';
// app scripts
import './modules/hazards.mjs';
import './modules/currentweatherscroll.mjs';
import './modules/currentweather.mjs';
import './modules/almanac.mjs';
import './modules/spc-outlook.mjs';
import './modules/extendedforecast.mjs';
import './modules/hourly-graph.mjs';
import './modules/hourly.mjs';
import './modules/latestobservations.mjs';
import './modules/localforecast.mjs';
import './modules/regionalforecast.mjs';
import './modules/travelforecast.mjs';
import './modules/progress.mjs';
import './modules/radar.mjs';
import './modules/future-radar.mjs';
import './modules/climate.mjs';
import './modules/settings.mjs';
import './modules/media.mjs';
import './modules/custom-scroll-text.mjs';
// eslint-disable-next-line import-x/no-useless-path-segments
import './index.mjs';

// radar loop display
import getRecentRadars from './radar/get-recent.mjs';
import FilmstripWeatherDisplay from './filmstrip-weather-display.mjs';
import { registerDisplay } from './navigation.mjs';
import { RADAR_IMAGE_COUNT } from './radar/constants.mjs';

class Radar extends FilmstripWeatherDisplay {
	constructor(navId, elemId) {
		super(navId, elemId, 'Local Radar', {
			imageMax: RADAR_IMAGE_COUNT,
			startOnLastFrame: true,
		});
	}

	getImages({ user, projection }) {
		return getRecentRadars(this.imageMax, user, projection);
	}
}

// register display
registerDisplay(new Radar(13, 'radar'));

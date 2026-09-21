// radar loop display
import getRecentRadars from './radar/get-recent.mjs';
import FilmstripWeatherDisplay from './filmstrip-weather-display.mjs';
import { registerDisplay } from './navigation.mjs';

class Radar extends FilmstripWeatherDisplay {
	constructor(navId, elemId) {
		super(navId, elemId, 'Local Radar', {
			imageMax: 6,
			startOnLastFrame: true,
		});
	}

	getImages({ user, projection }) {
		return getRecentRadars(this.imageMax, user, projection);
	}
}

// register display
registerDisplay(new Radar(11, 'radar'));

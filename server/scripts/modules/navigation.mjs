// navigation handles progress, next/previous and initial load messages from the parent frame
import noSleep from './utils/nosleep.mjs';
import STATUS from './status.mjs';
import { wrap } from './utils/calc.mjs';
import settings from './settings.mjs';

document.addEventListener('DOMContentLoaded', () => {
	init();
});

const displays = [];
let playing = false;
let progress;

const init = async () => {
	window.addEventListener('display-mode-change', () => {
		// one display failing to update must not stop the others or the redraw below
		displays.forEach((display) => {
			try {
				Promise.resolve(display.modeChanged()).catch((error) => console.error(`${display.elemId} modeChanged failed: ${error.message}`));
			} catch (error) {
				console.error(`${display.elemId} modeChanged failed: ${error.message}`);
			}
		});
		currentDisplay()?.drawCanvas();
	});

	generateCheckboxes();
};

const message = (data) => {
	// dispatch event
	if (!data.type) return false;
	if (data.type === 'navButton') return handleNavButton(data.message);
	return console.error(`Unknown event ${data.type}`);
};

// receive a status update from a module {id, value}
const updateStatus = (value) => {
	if (value.id < 0) return;
	if (!progress && !settings?.kiosk?.value) return;

	if (progress) progress.drawCanvas(displays, countLoadedDisplays());

	// first display is hazards and it must load before evaluating the first display
	if (!displays[0] || displays[0].status === STATUS.loading) return;

	// calculate first enabled display
	const firstDisplayIndex = displays.findIndex((display) => display?.enabled && display?.timing?.totalScreens > 0);

	// value.id = 0 is hazards, if they fail to load hot-wire a new value.id to the current display to see if it needs to be loaded
	// typically this plays out as current conditions loads, then hazards fails.
	if (value.id === 0 && (value.status === STATUS.failed || value.status === STATUS.retrying)) {
		value.id = firstDisplayIndex;
		value.status = displays[firstDisplayIndex].status;
	}

	// if hazards data arrives after the firstDisplayIndex loads, then we need to hot wire this to the first display
	if (value.id === 0 && value.status === STATUS.loaded && displays[0] && displays[0].timing && displays[0].timing.totalScreens === 0) {
		value.id = firstDisplayIndex;
		value.status = displays[firstDisplayIndex].status;
	}

	// if this is the first display and we're playing, load it up so it starts playing
	if (isPlaying() && value.id === firstDisplayIndex && value.status === STATUS.loaded) {
		navTo(msg.command.firstFrame);
	}
};

// note: a display that is "still waiting"/"retrying" is considered loaded intentionally
// the weather.gov api has long load times for some products when you are the first
// requester for the product after the cache expires
const countLoadedDisplays = () => displays.reduce((acc, display) => {
	if (display.status !== STATUS.loading) return acc + 1;
	return acc;
}, 0);

const hideAllCanvases = () => {
	displays.forEach((display) => display.hideCanvas());
};

// is playing interface
const isPlaying = () => playing;

// navigation message constants
const msg = {
	response: {	// display to navigation
		previous: Symbol('previous'), // already at first frame, calling function should switch to previous canvas
		inProgress: Symbol('inProgress'),	// have data to display, calling function should do nothing
		next: Symbol('next'), // end of frames reached, calling function should switch to next canvas
	},
	command: {	// navigation to display
		firstFrame: Symbol('firstFrame'),
		previousFrame: Symbol('previousFrame'),
		nextFrame: Symbol('nextFrame'),
		lastFrame: Symbol('lastFrame'),	// used when navigating backwards from the begining of the next canvas
	},
};

// receive navigation messages from displays
const displayNavMessage = (myMessage) => {
	if (myMessage.type === msg.response.previous) loadDisplay(-1);
	if (myMessage.type === msg.response.next) loadDisplay(1);
};

// navigate to next or previous
const navTo = (direction) => {
	// test for a current display
	const current = currentDisplay();
	if (progress) progress.hideCanvas();
	if (!current) {
		// special case for no active displays (typically on progress screen)
		// find the first ready display
		let firstDisplay;
		let displayCount = 0;
		do {
			// Check if displayCount is within bounds and the display exists
			if (displayCount < displays.length && displays[displayCount]) {
				const display = displays[displayCount];
				if (display.status === STATUS.loaded && display.timing?.totalScreens > 0) {
					firstDisplay = display;
				}
			}
			displayCount += 1;
		} while (!firstDisplay && displayCount < displays.length);

		if (!firstDisplay) return;

		// In kiosk mode, hide the loading screen when we start showing the first display
		if (settings?.kiosk?.value) {
			document.querySelector('#loading').style.display = 'none';
		}

		firstDisplay.navNext(msg.command.firstFrame);
		firstDisplay.showCanvas();
		return;
	}
	if (direction === msg.command.nextFrame) currentDisplay().navNext();
	if (direction === msg.command.previousFrame) currentDisplay().navPrev();
};

// find the next or previous available display
const loadDisplay = (direction) => {
	const totalDisplays = displays.length;
	const curIdx = currentDisplayIndex();
	let idx;
	let foundSuitableDisplay = false;

	for (let i = 0; i < totalDisplays; i += 1) {
		// convert form simple 0-10 to start at current display index +/-1 and wrap
		idx = wrap(curIdx + (i + 1) * direction, totalDisplays);
		if (displays[idx].status === STATUS.loaded && displays[idx].timing.totalScreens > 0) {
			// Prevent infinite recursion by ensuring we don't select the same display
			if (idx !== curIdx) {
				foundSuitableDisplay = true;
				break;
			}
		}
	}

	// If no other suitable display was found, but current display is still suitable (e.g. user only enabled one display), stay on it
	if (!foundSuitableDisplay && displays[curIdx] && displays[curIdx].status === STATUS.loaded && displays[curIdx].timing.totalScreens > 0) {
		idx = curIdx;
		foundSuitableDisplay = true;
	}

	// if no suitable display was found at all, do NOT proceed to avoid infinite recursion
	if (!foundSuitableDisplay) {
		console.warn('No suitable display found for navigation');
		return;
	}

	const newDisplay = displays[idx];
	// hide all displays
	hideAllCanvases();
	// show the new display and navigate to an appropriate display
	if (direction < 0) newDisplay.showCanvas(msg.command.lastFrame);
	if (direction > 0) newDisplay.showCanvas(msg.command.firstFrame);
};

// show a specific display, used by the display list below the player
// the play state is unchanged: when playing, it continues on from this display
const showDisplay = (display) => {
	if (display.status !== STATUS.loaded || !display.canShowOnRequest()) return;
	if (progress) progress.hideCanvas();
	hideAllCanvases();
	// after hiding, so a display that is already showing starts over
	display.prepareShowOnRequest();
	display.showCanvas(msg.command.firstFrame);
};

// get the current display index or value
const currentDisplayIndex = () => displays.findIndex((display) => display.active);
const currentDisplay = () => displays[currentDisplayIndex()];

const setPlaying = (newValue) => {
	playing = newValue;
	const playButton = document.querySelector('#NavigatePlay');
	localStorage.setItem('play', playing);

	if (playing) {
		noSleep(true).catch(() => {
			// Wake lock failed, but continue normally
		});
		playButton.title = 'Pause';
		playButton.setAttribute('aria-label', 'Pause');
		playButton.querySelector('img').src = 'images/nav/ic_pause_white_24dp_2x.png';
	} else {
		noSleep(false).catch(() => {
			// Wake lock disable failed, but continue normally
		});
		playButton.title = 'Play';
		playButton.setAttribute('aria-label', 'Play');
		playButton.querySelector('img').src = 'images/nav/ic_play_arrow_white_24dp_2x.png';
	}
	// if we're playing and on the progress screen (or in kiosk mode), jump to the next screen
	if (playing && !currentDisplay()) {
		if (progress || settings?.kiosk?.value) {
			navTo(msg.command.firstFrame);
		}
	}
};

// handle all navigation buttons
const handleNavButton = (button) => {
	switch (button) {
		case 'play':
			setPlaying(true);
			break;
		case 'playToggle':
			setPlaying(!playing);
			break;
		case 'stop':
			setPlaying(false);
			break;
		case 'next':
			setPlaying(false);
			navTo(msg.command.nextFrame);
			break;
		case 'previous':
			setPlaying(false);
			navTo(msg.command.previousFrame);
			break;
		case 'menu':
			setPlaying(false);
			window.dispatchEvent(new CustomEvent('current-weather-scroll', { detail: 'hide' }));
			hideAllCanvases();
			if (progress) {
				progress.showCanvas();
				// close the render-start hideAllCanvases() just triggered, instead of leaving it
				// to whichever display's status happens to change next
				progress.drawCanvas(displays, countLoadedDisplays());
			} else if (settings?.kiosk?.value) {
				// In kiosk mode without progress, show the loading screen
				document.querySelector('#loading').style.display = 'flex';
			}

			break;
		default:
			console.error(`Unknown navButton ${button}`);
	}
};

// return the specificed display
const getDisplay = (index) => displays[index];

// reset all statuses to loading on all displays, used to keep the progress bar accurate during refresh
const resetStatuses = () => {
	displays.forEach((display) => {
		display.status = STATUS.loading;
	});
};

// allow displays to register themselves
const registerDisplay = (display) => {
	if (displays[display.navId]) console.warn(`Display nav ID ${display.navId} already in use`);
	displays[display.navId] = display;
};

const generateCheckboxes = () => {
	const availableDisplays = document.querySelector('#enabledDisplays');

	if (!availableDisplays) return;
	// generate checkboxes
	const checkboxes = displays.map((d) => d.generateCheckbox(d.defaultEnabled)).filter((d) => d);

	// write to page
	availableDisplays.innerHTML = '';
	availableDisplays.append(...checkboxes);
};

// special registration method for progress display
const registerProgress = (_progress) => {
	progress = _progress;
};

// a location is ready: show progress and ask every display for data
// location.mjs calls this, so navigation doesn't need to import it
const startDisplays = async (weatherParameters) => {
	hideAllCanvases();
	if (!settings?.kiosk?.value) {
		// In normal mode, hide loading screen and show progress
		// (In kiosk mode, keep the loading screen visible until autoplay starts)
		document.querySelector('#loading').style.display = 'none';
		if (progress) {
			await progress.drawCanvas();
			progress.showCanvas();
		}
	}

	// call for new data on each display
	displays.forEach((display) => display.getData(weatherParameters));
};

export {
	updateStatus,
	displayNavMessage,
	resetStatuses,
	isPlaying,
	registerDisplay,
	registerProgress,
	currentDisplay,
	showDisplay,
	getDisplay,
	startDisplays,
	msg,
	message,
};

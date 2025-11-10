import { text } from './utils/fetch.mjs';
import Setting from './utils/setting.mjs';
import { registerHiddenSetting } from './share.mjs';

let playlist;
let currentTrack = 0;
let player;
let sliderTimeout = null;
let volumeSlider = null;
let volumeSliderInput = null;

const mediaPlaying = new Setting('mediaPlaying', {
	name: 'Media Playing',
	type: 'boolean',
	defaultValue: false,
	sticky: true,
});

document.addEventListener('DOMContentLoaded', () => {
	// add the event handler to the page
	document.getElementById('ToggleMedia').addEventListener('click', handleClick);
	// get the slider elements
	volumeSlider = document.querySelector('#ToggleMediaContainer .volume-slider');
	volumeSliderInput = volumeSlider.querySelector('input');

	// catch interactions with the volume slider (timeout handler)
	// called on any interaction via 'input' (vs change) for immediate volume response
	volumeSlider.addEventListener('input', setSliderTimeout);
	volumeSlider.addEventListener('input', sliderChanged);

	// add listener for mute (pause) button under the volume slider
	volumeSlider.querySelector('img').addEventListener('click', stopMedia);

	// get the playlist
	getMedia();

	// register the volume setting
	registerHiddenSetting(mediaVolume.elemId, mediaVolume);
});

const scanMusicDirectory = async () => {
	const parseDirectory = async (path, prefix = '') => {
		const listing = await text(path);
		const matches = [...listing.matchAll(/href="([^"]+\.mp3)"/gi)];
		return matches.map((m) => `${prefix}${m[1]}`);
	};

	try {
		let files = await parseDirectory('music/');
		if (files.length === 0) {
			files = await parseDirectory('music/default/', 'default/');
		}
		return { availableFiles: files };
	} catch (e) {
		console.error('Unable to scan music directory');
		console.error(e);
		return { availableFiles: [] };
	}
};

const getMedia = async () => {
	let playlistSource = '';

	try {
		const response = await fetch('playlist.json');
		if (response.ok) {
			playlist = await response.json();
			playlistSource = 'from server';
		} else if (response.status === 404 && response.headers.get('X-Weatherstar') === 'true') {
			// Expected behavior in static deployment mode
			playlist = await scanMusicDirectory();
			playlistSource = 'via directory scan (static deployment)';
		} else {
			playlist = { availableFiles: [] };
			playlistSource = `failed (${response.status} ${response.statusText})`;
		}
	} catch (_e) {
		// Network error or other fetch failure - fall back to directory scanning
		playlist = await scanMusicDirectory();
		playlistSource = 'via directory scan (after fetch failed)';
	}

	const fileCount = playlist?.availableFiles?.length || 0;
	if (fileCount > 0) {
		console.log(`Loaded playlist ${playlistSource} - found ${fileCount} music file${fileCount === 1 ? '' : 's'}`);
	} else {
		console.log(`No music files found ${playlistSource}`);
	}

	enableMediaPlayer();
};

const enableMediaPlayer = () => {
	// see if files are available
	if (playlist?.availableFiles?.length > 0) {
		// randomize the list
		randomizePlaylist();
		// enable the icon
		const icon = document.getElementById('ToggleMediaContainer');
		icon.classList.add('available');
		// set the button type
		setIcon();
		// if we're already playing (sticky option) then try to start playing
		if (mediaPlaying.value === true) {
			startMedia();
		}
	}
};

const setIcon = () => {
	// get the icon
	const icon = document.getElementById('ToggleMediaContainer');
	if (mediaPlaying.value === true) {
		icon.classList.add('playing');
	} else {
		icon.classList.remove('playing');
	}
};

const handleClick = () => {
	// if media is off, start it
	if (mediaPlaying.value === false) {
		mediaPlaying.value = true;
	}

	if (mediaPlaying.value === true && !volumeSlider.classList.contains('show')) {
		// if media is playing and the slider isn't open, open it
		showVolumeSlider();
	} else {
		// hide the volume slider
		hideVolumeSlider();
	}

	// handle the state change
	stateChanged();
};

// set a timeout for the volume slider (called by interactions with the slider)
const setSliderTimeout = () => {
	// clear existing timeout
	if (sliderTimeout) clearTimeout(sliderTimeout);
	// set a new timeout
	sliderTimeout = setTimeout(hideVolumeSlider, 5000);
};

// show the volume slider and configure a timeout
const showVolumeSlider = () => {
	setSliderTimeout();

	// show the slider
	if (volumeSlider) {
		volumeSlider.classList.add('show');
	}
};

// hide the volume slider and clean up the timeout
const hideVolumeSlider = () => {
	// clear the timeout handler
	if (sliderTimeout) clearTimeout(sliderTimeout);
	sliderTimeout = null;

	// hide the element
	if (volumeSlider) {
		volumeSlider.classList.remove('show');
	}
};

const startMedia = async () => {
	// if there's not media player yet, enable it
	if (!player) {
		initializePlayer();
	} else {
		try {
			await player.play();
			setTrackName(playlist.availableFiles[currentTrack]);
		} catch (e) {
			// report the error
			console.error('Couldn\'t play music');
			console.error(e);
			// set state back to not playing for good UI experience
			mediaPlaying.value = false;
			stateChanged();
			setTrackName('Not playing');
		}
	}
};

const stopMedia = () => {
	hideVolumeSlider();
	if (!player) return;
	player.pause();
	mediaPlaying.value = false;
	setTrackName('Not playing');
	setIcon();
};

const stateChanged = () => {
	// update the icon
	setIcon();
	// react to the new state
	if (mediaPlaying.value) {
		startMedia();
	} else {
		stopMedia();
	}
};

const randomizePlaylist = () => {
	let availableFiles = [...playlist.availableFiles];
	const randomPlaylist = [];
	while (availableFiles.length > 0) {
		// get a randon item from the available files
		const i = Math.floor(Math.random() * availableFiles.length);
		// add it to the final list
		randomPlaylist.push(availableFiles[i]);
		// remove the file from the available files
		availableFiles = availableFiles.filter((file, index) => index !== i);
	}
	playlist.availableFiles = randomPlaylist;
};

const setVolume = (newVolume) => {
	if (player) {
		player.volume = newVolume;
	}
};

const sliderChanged = () => {
	// get the value of the slider
	if (volumeSlider) {
		const newValue = volumeSliderInput.value;
		const cleanValue = parseFloat(newValue) / 100;
		setVolume(cleanValue);
		mediaVolume.value = cleanValue;
	}
};

const mediaVolume = new Setting('mediaVolume', {
	name: 'Volume',
	type: 'select',
	defaultValue: 0.75,
	values: [
		[1, '100%'],
		[0.75, '75%'],
		[0.50, '50%'],
		[0.25, '25%'],
	],
	changeAction: setVolume,
});

const initializePlayer = () => {
	// basic sanity checks
	if (!playlist.availableFiles || playlist?.availableFiles.length === 0) {
		throw new Error('No playlist available');
	}
	if (player) {
		return;
	}
	// create the player
	player = new Audio();

	// reset the playlist index
	currentTrack = 0;

	// add event handlers
	player.addEventListener('canplay', playerCanPlay);
	player.addEventListener('ended', playerEnded);

	// get the first file
	player.src = `music/${playlist.availableFiles[currentTrack]}`;
	setTrackName(playlist.availableFiles[currentTrack]);
	player.type = 'audio/mpeg';
	// set volume and slider indicator
	setVolume(mediaVolume.value);
	volumeSliderInput.value = Math.round(mediaVolume.value * 100);
};

const playerCanPlay = async () => {
	// check to make sure they user still wants music (protect against slow loading music)
	if (!mediaPlaying.value) return;
	// start playing
	startMedia();
};

const playerEnded = () => {
	// next track
	currentTrack += 1;
	// roll over and re-randomize the tracks
	if (currentTrack >= playlist.availableFiles.length) {
		randomizePlaylist();
		currentTrack = 0;
	}
	// update the player source
	player.src = `music/${playlist.availableFiles[currentTrack]}`;
	setTrackName(playlist.availableFiles[currentTrack]);
};

const setTrackName = (fileName) => {
	const baseName = fileName.split('/').pop();
	const trackName = decodeURIComponent(
		baseName.replace(/\.mp3/gi, '').replace(/(_-)/gi, ''),
	);
	document.getElementById('musicTrack').innerHTML = trackName;
};

export {
	// eslint-disable-next-line import/prefer-default-export
	handleClick,
};

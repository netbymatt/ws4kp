import { json } from './utils/fetch.mjs';
import Setting from './utils/setting.mjs';

let playlist;
let currentTrack = 0;
let player;

const mediaPlaying = new Setting('mediaPlaying', 'Media Playing', 'boolean', false, null, true);

document.addEventListener('DOMContentLoaded', () => {
	// add the event handler to the page
	document.getElementById('ToggleMedia').addEventListener('click', toggleMedia);
	// get the playlist
	getMedia();
});

const getMedia = async () => {
	try {
		// fetch the playlist
		const rawPlaylist = await json('playlist.json');
		// store the playlist
		playlist = rawPlaylist;
		// enable the media player
		enableMediaPlayer();
	} catch (e) {
		console.error("Couldn't get playlist");
		console.error(e);
	}
};

const enableMediaPlayer = () => {
	// see if files are available
	if (playlist?.availableFiles?.length > 0) {
		// randomize the list
		randomizePlaylist();
		// enable the icon
		const icon = document.getElementById('ToggleMedia');
		icon.classList.add('available');
		// set the button type
		setIcon();
	}
};

const setIcon = () => {
	// get the icon
	const icon = document.getElementById('ToggleMedia');
	if (mediaPlaying.value === true) {
		icon.classList.add('playing');
	} else {
		icon.classList.remove('playing');
	}
};

const toggleMedia = (forcedState) => {
	// handle forcing
	if (typeof forcedState === 'boolean') {
		mediaPlaying.value = forcedState;
	} else {
		// toggle the state
		mediaPlaying.value = !mediaPlaying.value;
	}
	// handle the state change
	stateChanged();
};

const startMedia = () => {
	// if there's not media player yet, enable it
	if (!player) {
		initializePlayer();
	} else {
		player.play();
	}
};

const stopMedia = () => {
	if (!player) return;
	player.pause();
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

	// add the tracks
	const tracks = playlist.availableFiles.map((file) => {
		const elem = document.createElement('source');
		elem.src = `music/${file}`;
		elem.type = 'audio/mpeg';
		return elem;
	});

	// add the track to the player
	player.append(...tracks);
	console.log('tracks added');
};

const playerCanPlay = () => {
	// check to make sure they user still wants music (protect against slow loading music)
	if (!mediaPlaying.value) return;
	// start playing
	player.play();
};

const playerEnded = () => {
	console.log('end of playlist reached');
};

export {
	// eslint-disable-next-line import/prefer-default-export
	toggleMedia,
};

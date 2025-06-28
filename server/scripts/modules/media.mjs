import { text } from './utils/fetch.mjs';
import Setting from './utils/setting.mjs';

let playlist;
let currentTrack = 0;
let player;

const mediaPlaying = new Setting('mediaPlaying', {
	name: 'Media Playing',
	type: 'boolean',
	defaultValue: false,
	sticky: true,
});

document.addEventListener('DOMContentLoaded', () => {
	// add the event handler to the page
	document.getElementById('ToggleMedia').addEventListener('click', toggleMedia);
	// get the playlist
	getMedia();
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
	try {
		const response = await fetch('playlist.json');
		if (response.ok) {
			playlist = await response.json();
		} else if (response.status === 404
			&& response.headers.get('X-Weatherstar') === 'true') {
			console.warn("Couldn't get playlist.json, falling back to directory scan");
			playlist = await scanMusicDirectory();
		} else {
			console.warn(`Couldn't get playlist.json: ${response.status} ${response.statusText}`);
			playlist = { availableFiles: [] };
		}
	} catch (e) {
		console.warn("Couldn't get playlist.json, falling back to directory scan");
		playlist = await scanMusicDirectory();
	}

	enableMediaPlayer();
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
		// if we're already playing (sticky option) then try to start playing
		if (mediaPlaying.value === true) {
			startMedia();
		}
		// add the volume control to the page
		const settingsSection = document.querySelector('#settings');
		settingsSection.append(mediaVolume.generate());
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
	if (!player) return;
	player.pause();
	setTrackName('Not playing');
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
	setVolume(mediaVolume.value);
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
	toggleMedia,
};

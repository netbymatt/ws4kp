import { text } from './utils/fetch.mjs';
import Setting from './utils/setting.mjs';
import { registerHiddenSetting } from './share.mjs';
import settings from './settings.mjs';

let playlist;
let currentTrack = 0;
let player;
let spotifyEmbed;
let spotifyPanel;
let spotifyController;
let spotifyIFrameApi;
let spotifyApiReady = false;
let spotifyApiRequested = false;
let pendingSpotifyUri = '';
let youtubePlayer = null;
let youtubeApiRequested = false;
let youtubeApiReady = false;
let youtubePendingMedia = null;
let youtubeRestartInProgress = false;
let spotifyLastPlaybackState = null;
let sliderTimeout = null;
let volumeSlider = null;
let volumeSliderInput = null;
let youtubePanel;
let youtubeFrame;
let customMusicMessage;
let mediaReady = false;
let mediaMuted = false;

const getCustomMusicSource = () => settings.customMusicSource;
const getCustomMusicEnabled = () => settings.customMusicEnabled;
const isCustomMusicEnabled = () => getCustomMusicEnabled()?.value === true;

const mediaPlaying = new Setting('mediaPlaying', {
	name: 'Media Playing',
	type: 'boolean',
	defaultValue: false,
	sticky: true,
});

document.addEventListener('DOMContentLoaded', () => {
	document.getElementById('ToggleMedia').addEventListener('click', handleClick);
	window.addEventListener('custom-music-change', () => {
		updateCustomMusicControls();
	});
	setInterval(() => {
		runYouTubeEndOfQueueCheck();
	}, 1000);
	volumeSlider = document.querySelector('#ToggleMediaContainer .volume-slider');
	volumeSliderInput = volumeSlider.querySelector('input');

	const stopBubble = (event) => event.stopPropagation();
	volumeSlider.addEventListener('click', stopBubble);
	volumeSlider.addEventListener('pointerdown', stopBubble);
	volumeSlider.addEventListener('mousedown', stopBubble);
	volumeSlider.addEventListener('input', setSliderTimeout);
	volumeSlider.addEventListener('input', sliderChanged);
	volumeSlider.querySelector('img').addEventListener('click', (event) => {
		event.stopPropagation();
		toggleMute();
		hideVolumeSlider();
	});
	volumeSliderInput.addEventListener('click', stopBubble);
	volumeSliderInput.addEventListener('pointerdown', stopBubble);
	volumeSliderInput.addEventListener('mousedown', stopBubble);

	mountCustomMusicControls();
	createSpotifyPlayer();
	createYouTubePlayer();

	getMedia();

	registerHiddenSetting(mediaVolume.elemId, mediaVolume);
	mediaReady = true;
	mountCustomMusicControls();
	enableMediaPlayer(false);
});

const getSpotifyPlaylistId = (value) => {
	const cleanValue = value?.trim?.() ?? '';
	if (cleanValue.length === 0) return '';

	const spotifyUriMatch = cleanValue.match(/^spotify:playlist:([a-zA-Z0-9]+)$/);
	if (spotifyUriMatch) return spotifyUriMatch[1];

	try {
		const parsedUrl = new URL(cleanValue);
		if (!/(^|\.)spotify\.com$/i.test(parsedUrl.hostname)) return '';
		const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
		const playlistIndex = pathParts.indexOf('playlist');
		if (playlistIndex === -1) return '';
		return pathParts[playlistIndex + 1]?.match(/^[a-zA-Z0-9]+$/)?.[0] ?? '';
	} catch (_e) {
		return '';
	}
};

const spotifyPlaylistUri = (playlistId) => `spotify:playlist:${playlistId}`;
const hasYouTubePlayerMethod = (methodName) => Boolean(youtubePlayer && typeof youtubePlayer[methodName] === 'function');
const syncYouTubeAudioState = () => {
	if (!hasYouTubePlayerMethod('mute') && !hasYouTubePlayerMethod('unMute')) return;
	if (mediaMuted || mediaVolume.value <= 0) {
		if (hasYouTubePlayerMethod('mute')) youtubePlayer.mute();
		return;
	}
	if (hasYouTubePlayerMethod('unMute')) youtubePlayer.unMute();
	if (hasYouTubePlayerMethod('setVolume')) {
		youtubePlayer.setVolume(Math.round(mediaVolume.value * 100));
	}
};

const youtubeEmbedUrl = (media) => {
	if (!media) return '';
	const params = new URLSearchParams({
		autoplay: '1',
		playsinline: '1',
		rel: '0',
		loop: '1',
		enablejsapi: '1',
		origin: window.location.origin,
	});
	if (media.type === 'playlist') {
		params.set('playlist', media.id);
		return `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(media.id)}&${params.toString()}`;
	}
	if (media.list) {
		params.set('list', media.list);
		params.set('playlist', media.list);
	}
	return `https://www.youtube.com/embed/${encodeURIComponent(media.id)}?${params.toString()}`;
};

const loadYouTubeApi = () => {
	if (youtubeApiRequested) return;
	youtubeApiRequested = true;

	window.onYouTubeIframeAPIReady = () => {
		youtubeApiReady = true;
		if (!youtubeFrame || youtubePlayer) return;

		youtubePlayer = new window.YT.Player('YouTubePlayerFrame', {
			events: {
				onReady: () => {
					if (youtubePendingMedia) {
						applyYouTubeMedia(youtubePendingMedia);
					}
				},
				onStateChange: (event) => {
					handleYouTubeStateChange(event);
				},
			},
		});
	};

	if (document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) return;
	const tag = document.createElement('script');
	tag.src = 'https://www.youtube.com/iframe_api';
	tag.async = true;
	document.body.appendChild(tag);
};

const applyYouTubeMedia = (media) => {
	if (!media || !hasYouTubePlayerMethod('loadVideoById')) return;

	if (media.type === 'playlist') {
		if (hasYouTubePlayerMethod('loadPlaylist')) {
			youtubePlayer.loadPlaylist({ list: media.id, listType: 'playlist' });
		}
	} else if (media.list) {
		if (hasYouTubePlayerMethod('loadPlaylist')) {
			youtubePlayer.loadPlaylist({ list: media.list, listType: 'playlist' });
		}
	} else {
		youtubePlayer.loadVideoById(media.id);
	}

	syncYouTubeAudioState();

	if (mediaPlaying.value && hasYouTubePlayerMethod('playVideo')) {
		youtubePlayer.playVideo();
	} else if (hasYouTubePlayerMethod('pauseVideo')) {
		youtubePlayer.pauseVideo();
	}
};

const restartYouTubePlaylistFromStart = (mode) => {
	if (youtubeRestartInProgress) return;
	youtubeRestartInProgress = true;
	const playlistId = mode.mediaType === 'playlist' ? mode.id : mode.list;
	if (playlistId && hasYouTubePlayerMethod('loadPlaylist')) {
		youtubePlayer.loadPlaylist({
			list: playlistId,
			listType: 'playlist',
			index: 0,
			startSeconds: 0,
		});
	} else if (hasYouTubePlayerMethod('playVideoAt')) {
		youtubePlayer.playVideoAt(0);
	}
	setTimeout(() => {
		if (mediaPlaying.value && hasYouTubePlayerMethod('playVideo')) {
			youtubePlayer.playVideo();
		}
	}, 50);
	syncYouTubeAudioState();
	setTimeout(() => {
		youtubeRestartInProgress = false;
	}, 1200);
};

const runYouTubeEndOfQueueCheck = () => {
	const mode = getCustomMusicMode();
	if (mode.type !== 'youtube') return;
	const isPlaylistMode = mode.mediaType === 'playlist' || mode.list;
	if (!isPlaylistMode || !mediaPlaying.value || youtubeRestartInProgress) return;
	if (!hasYouTubePlayerMethod('getPlayerState')) return;

	const state = youtubePlayer.getPlayerState();
	const maybeEndedState = state === window.YT?.PlayerState?.ENDED
		|| state === window.YT?.PlayerState?.CUED
		|| state === window.YT?.PlayerState?.PAUSED;
	if (!maybeEndedState) return;

	if (hasYouTubePlayerMethod('getDuration') && hasYouTubePlayerMethod('getCurrentTime')) {
		const duration = youtubePlayer.getDuration();
		const current = youtubePlayer.getCurrentTime();
		const nearEnd = duration > 0 && current >= Math.max(0, duration - 0.75);
		if (!nearEnd && state !== window.YT?.PlayerState?.CUED) return;
	}

	restartYouTubePlaylistFromStart(mode);
};

const handleYouTubeStateChange = (event) => {
	const state = event?.data;
	const mode = getCustomMusicMode();
	if (mode.type !== 'youtube') return;

	if (
		state === window.YT?.PlayerState?.PLAYING
		|| state === window.YT?.PlayerState?.BUFFERING
		|| state === window.YT?.PlayerState?.CUED
	) {
		syncYouTubeAudioState();
	}
};

const ensureSpotifyController = (uri) => {
	const playlistId = getSpotifyPlaylistId(uri);
	if (!spotifyApiReady || spotifyController || !spotifyIFrameApi || playlistId.length === 0) return;
	const element = document.getElementById('SpotifyPlayerFrame');
	if (!element) return;

	spotifyIFrameApi.createController(element, { uri: spotifyPlaylistUri(playlistId) }, (controller) => {
		spotifyController = controller;
		spotifyLastPlaybackState = null;
		if (typeof spotifyController.addListener === 'function') {
			spotifyController.addListener('playback_update', (event) => {
				const data = event?.data;
				if (!data) return;
				const was = spotifyLastPlaybackState;
				spotifyLastPlaybackState = {
					isPaused: data.isPaused,
					position: data.position,
					duration: data.duration,
				};

				// Spotify embed pauses at playlist end after wrapping to first track.
				// Detect that transition and immediately resume so playback restarts.
				const wrappedToStartPaused = Boolean(
					was
					&& was.isPaused === false
					&& was.duration > 0
					&& was.position >= Math.max(0, was.duration - 1500)
					&& data.isPaused === true
					&& data.position === 0
					&& data.duration > 0,
				);
				if (wrappedToStartPaused && activeProvider() === 'spotify' && mediaPlaying.value && !mediaMuted) {
					spotifyController.resume();
				}
			});
		}
		if (activeProvider() === 'spotify' && !mediaMuted) {
			spotifyController.resume();
		} else {
			spotifyController.pause();
		}
	});
};

const loadSpotifyApi = () => {
	if (spotifyApiRequested) return;
	spotifyApiRequested = true;

	const existingCallback = window.onSpotifyIframeApiReady;
	window.onSpotifyIframeApiReady = (IFrameAPI) => {
		spotifyIFrameApi = IFrameAPI;
		spotifyApiReady = true;
		if (typeof existingCallback === 'function') existingCallback(IFrameAPI);

		const currentPlaylistId = getSpotifyPlaylistId(getCustomMusicSource()?.value);
		const currentUri = pendingSpotifyUri || (currentPlaylistId.length > 0 ? spotifyPlaylistUri(currentPlaylistId) : '');
		if (currentUri) ensureSpotifyController(currentUri);
	};

	if (document.querySelector('script[src="https://open.spotify.com/embed/iframe-api/v1"]')) return;
	const script = document.createElement('script');
	script.src = 'https://open.spotify.com/embed/iframe-api/v1';
	script.async = true;
	document.body.append(script);
};

const getYouTubeMedia = (value) => {
	const cleanValue = value?.trim?.() ?? '';
	if (cleanValue.length === 0) return null;

	try {
		const parsedUrl = new URL(cleanValue);
		if (!/(^|\.)youtube\.com$/i.test(parsedUrl.hostname)
			&& !/(^|\.)youtube-nocookie\.com$/i.test(parsedUrl.hostname)
			&& !/(^|\.)music\.youtube\.com$/i.test(parsedUrl.hostname)
			&& !/^youtu\.be$/i.test(parsedUrl.hostname)) {
			return null;
		}

		if (/^youtu\.be$/i.test(parsedUrl.hostname)) {
			const videoId = parsedUrl.pathname.split('/').filter(Boolean)[0];
			return videoId ? { type: 'video', id: videoId } : null;
		}

		const videoId = parsedUrl.searchParams.get('v');
		if (videoId) {
			const playlistId = parsedUrl.searchParams.get('list');
			return playlistId
				? { type: 'video', id: videoId, list: playlistId }
				: { type: 'video', id: videoId };
		}

		const playlistId = parsedUrl.searchParams.get('list');
		if (playlistId) {
			return { type: 'playlist', id: playlistId };
		}

		const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
		if (pathParts[0] === 'channel' && pathParts[1]?.match(/^UC[a-zA-Z0-9_-]+$/)) {
			const channelId = pathParts[1];
			return { type: 'playlist', id: `UU${channelId.slice(2)}` };
		}
		if (pathParts[0] === 'playlist' && parsedUrl.searchParams.get('list')) {
			return { type: 'playlist', id: parsedUrl.searchParams.get('list') };
		}
		const videoPathIndex = pathParts.findIndex((part) => ['embed', 'shorts', 'live'].includes(part));
		if (videoPathIndex !== -1 && pathParts[videoPathIndex + 1]) {
			return { type: 'video', id: pathParts[videoPathIndex + 1] };
		}
	} catch (_e) {
		return null;
	}

	return null;
};

const getCustomMusicMode = (value = getCustomMusicSource()?.value, { ignoreEnabled = false } = {}) => {
	if (!ignoreEnabled && !isCustomMusicEnabled()) {
		return { type: 'local' };
	}

	const cleanValue = value?.trim?.() ?? '';
	if (cleanValue.length === 0) {
		return { type: 'local' };
	}

	const playlistId = getSpotifyPlaylistId(cleanValue);
	if (playlistId.length > 0) {
		return {
			type: 'spotify',
			playlistId,
		};
	}

	const youtubeMedia = getYouTubeMedia(cleanValue);
	if (youtubeMedia) {
		return {
			mediaType: youtubeMedia.type,
			...youtubeMedia,
			type: 'youtube',
		};
	}

	return {
		type: 'invalid',
	};
};

const activeProvider = () => {
	if (!isCustomMusicEnabled()) return 'local';
	const mode = getCustomMusicMode();
	if (mode.type === 'youtube') return 'youtube';
	if (mode.type === 'spotify') return 'spotify';
	return 'local';
};

const setIcon = () => {
	const icon = document.getElementById('ToggleMediaContainer');
	if (!icon) return;
	const provider = activeProvider();

	let showOn = false;
	if (provider === 'spotify') {
		showOn = mediaMuted === false;
	} else {
		showOn = mediaPlaying.value === true && mediaMuted === false;
	}

	icon.classList.toggle('playing', showOn);
};

const enableMediaPlayer = (autoStart = true) => {
	const mode = getCustomMusicMode();
	const hasMedia = playlist?.availableFiles?.length > 0 || ['spotify', 'youtube'].includes(mode.type);
	const icon = document.getElementById('ToggleMediaContainer');
	if (!icon) return;

	if (playlist?.availableFiles?.length > 0 && !playlist.randomized) {
		randomizePlaylist();
		playlist.randomized = true;
	}

	icon.classList.add('available');
	setIcon();
	if (!mediaReady) return;
	if (autoStart && hasMedia && mediaPlaying.value === true) {
		startMedia();
	}
};

const mountCustomMusicControls = () => {
	const settingsSection = document.querySelector('#settings');
	if (!settingsSection) return;

	const customMusicEnabledLabel = document.getElementById('settings-customMusicEnabled-label');
	const customMusicSourceLabel = document.getElementById('settings-customMusicSource-label');
	const customTextLabel = document.getElementById('settings-customText-label');
	const insertBeforeNode = customTextLabel ?? null;

	if (!customMusicEnabledLabel && getCustomMusicEnabled()?.generate) {
		const enabledControl = getCustomMusicEnabled().generate();
		if (insertBeforeNode) {
			settingsSection.insertBefore(enabledControl, insertBeforeNode);
		} else {
			settingsSection.append(enabledControl);
		}
	}

	if (!customMusicSourceLabel && getCustomMusicSource()?.generate) {
		const sourceControl = getCustomMusicSource().generate();
		if (insertBeforeNode) {
			settingsSection.insertBefore(sourceControl, insertBeforeNode);
		} else {
			settingsSection.append(sourceControl);
		}
	}

	document.getElementById('settings-customMusicEnabled-label')?.classList.add('custom-music-toggle-setting');
	document.getElementById('settings-customMusicSource-label')?.classList.add('custom-music-source-setting');
	updateCustomMusicControls();
};

const syncCustomMusicSource = (value = getCustomMusicSource()?.value) => {
	const mode = getCustomMusicMode(value, { ignoreEnabled: true });
	if (mode.type === 'spotify') {
		if (player) player.pause();
		clearYouTubePlayer();
		if (mediaReady) {
			mediaMuted = true;
			mediaPlaying.value = false;
		} else {
			mediaMuted = false;
			mediaPlaying.value = true;
		}
		configureSpotifyPlaylist(value, { autoplay: !mediaReady });
		setIcon();
		return;
	}
	if (mode.type === 'youtube') {
		if (player) player.pause();
		clearSpotifyPlayer();
		clearYouTubePlayer();
		mediaMuted = true;
		mediaPlaying.value = true;
		configureYouTubePlayer(value);
		showYouTubePlayer();
		setIcon();
		return;
	}
	if (player) player.pause();
	clearSpotifyPlayer();
	clearYouTubePlayer();
	if (customMusicMessage) {
		customMusicMessage.textContent = value?.trim?.()
			? 'That does not look like a Spotify or YouTube source.'
			: 'Paste a Spotify playlist or YouTube link.';
	}
	enableMediaPlayer(false);
};

const createSpotifyPlayer = () => {
	spotifyPanel = document.createElement('div');
	spotifyPanel.id = 'SpotifyPlayer';

	spotifyEmbed = document.createElement('div');
	spotifyEmbed.id = 'SpotifyPlayerFrame';

	spotifyPanel.append(spotifyEmbed);
	document.body.append(spotifyPanel);
	loadSpotifyApi();
};

const createYouTubePlayer = () => {
	youtubePanel = document.createElement('div');
	youtubePanel.id = 'YouTubePlayer';

	youtubeFrame = document.createElement('iframe');
	youtubeFrame.id = 'YouTubePlayerFrame';
	youtubeFrame.title = 'YouTube playlist player';
	youtubeFrame.loading = 'lazy';
	youtubeFrame.allow = 'autoplay; encrypted-media; fullscreen; picture-in-picture';

	youtubePanel.append(youtubeFrame);
	document.body.append(youtubePanel);
	loadYouTubeApi();
};

const configureYouTubePlayer = (value) => {
	const media = getYouTubeMedia(value);
	youtubePendingMedia = media;

	if (!media) {
		if (youtubePanel) youtubePanel.classList.remove('show');
		if (youtubeFrame) youtubeFrame.removeAttribute('src');
		if (customMusicMessage) {
			customMusicMessage.textContent = 'Invalid YouTube link. Please provide a valid video or playlist URL.';
		}
		enableMediaPlayer(false);
		return;
	}

	const src = youtubeEmbedUrl(media);
	if (youtubeFrame && youtubeFrame.src !== src) {
		youtubeFrame.src = src;
	}
	if (youtubePanel) youtubePanel.classList.add('show');
	if (youtubeApiReady && youtubePlayer) applyYouTubeMedia(media);
	enableMediaPlayer(false);
};

const configureSpotifyPlaylist = (value, { autoplay = false } = {}) => {
	const playlistId = getSpotifyPlaylistId(value);

	if (!spotifyEmbed) return;

	if (playlistId.length === 0) {
		clearSpotifyPlayer();
		enableMediaPlayer(false);
		return;
	}

	const uri = spotifyPlaylistUri(playlistId);
	pendingSpotifyUri = uri;
	ensureSpotifyController(uri);
	if (spotifyController) {
		spotifyController.loadUri(uri);
	} else if (!spotifyApiReady) {
		spotifyEmbed.textContent = '';
	}
	enableMediaPlayer(false);
	spotifyPanel?.classList.add('show');
	if (autoplay && spotifyController) {
		spotifyController.resume();
	}
};

const updateCustomMusicControls = () => {
	const enabled = getCustomMusicEnabled()?.value === true;
	const sourceLabel = document.getElementById('settings-customMusicSource-label');
	const sourceInput = document.getElementById('settings-customMusicSource-string');
	const sourceWidth = '310px';
	sourceLabel?.classList.add('custom-music-source-setting');
	sourceLabel?.classList.toggle('disabled', !enabled);
	if (sourceLabel) {
		sourceLabel.style.width = sourceWidth;
		sourceLabel.style.maxWidth = sourceWidth;
	}
	if (sourceInput) {
		sourceInput.style.width = sourceWidth;
		sourceInput.style.maxWidth = sourceWidth;
	}
	sourceLabel?.querySelectorAll('input, button').forEach((element) => { element.disabled = !enabled; });
	if (sourceLabel) {
		sourceLabel.style.display = enabled ? '' : 'none';
	}
	if (!enabled) {
		const hasLocalMusic = (playlist?.availableFiles?.length ?? 0) > 0;
		clearSpotifyPlayer();
		clearYouTubePlayer();
		enableMediaPlayer(false);
		if (hasLocalMusic) {
			mediaPlaying.value = true;
			startMedia();
		}
		return;
	}
	syncCustomMusicSource();
};

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
			playlist = await scanMusicDirectory();
			playlistSource = 'via directory scan (static deployment)';
		} else {
			playlist = { availableFiles: [] };
			playlistSource = `failed (${response.status} ${response.statusText})`;
		}
	} catch (_e) {
		playlist = await scanMusicDirectory();
		playlistSource = 'via directory scan (after fetch failed)';
	}

	const fileCount = playlist?.availableFiles?.length || 0;
	if (fileCount > 0) {
		console.log(`Loaded playlist ${playlistSource} - found ${fileCount} music file${fileCount === 1 ? '' : 's'}`);
	} else {
		console.log(`No music files found ${playlistSource}`);
	}

	enableMediaPlayer(false);
};

const handleClick = (event) => {
	if (event?.target?.closest?.('.volume-slider')) {
		return;
	}
	if (activeProvider() === 'spotify') {
		hideVolumeSlider();
		toggleMute();
		return;
	}
	if (mediaPlaying.value === false) {
		mediaPlaying.value = true;
		if (mediaMuted) {
			toggleMute();
		}
		showVolumeSlider();
		stateChanged();
		return;
	}
	if (mediaMuted) {
		toggleMute();
		showVolumeSlider();
		return;
	}
	if (!volumeSlider.classList.contains('show')) {
		showVolumeSlider();
	} else {
		hideVolumeSlider();
	}
};

const setSliderTimeout = () => {
	if (sliderTimeout) clearTimeout(sliderTimeout);
	sliderTimeout = setTimeout(hideVolumeSlider, 5000);
};

const showVolumeSlider = () => {
	setSliderTimeout();

	if (volumeSlider) {
		volumeSlider.classList.add('show');
	}
};

const hideVolumeSlider = () => {
	if (sliderTimeout) clearTimeout(sliderTimeout);
	sliderTimeout = null;

	if (volumeSlider) {
		volumeSlider.classList.remove('show');
	}
};

const startMedia = async () => {
	const provider = activeProvider();
	if (provider === 'youtube') {
		if (player) player.pause();
		stopSpotifyPlayer();
		startYouTubePlayer();
		setTrackName('YouTube');
		return;
	}

	if (provider === 'spotify') {
		if (player) player.pause();
		clearYouTubePlayer();
		resumeSpotifyPlayer();
		setTrackName('Spotify playlist');
		return;
	}

	if (!player) {
		initializePlayer();
	} else {
		try {
			await player.play();
			setTrackName(playlist.availableFiles[currentTrack]);
		} catch (e) {
			console.error('Couldn\'t play music');
			console.error(e);
			mediaPlaying.value = false;
			stateChanged();
			setTrackName('Not playing');
		}
	}
};

const stopMedia = () => {
	hideVolumeSlider();
	stopSpotifyPlayer();
	stopYouTubePlayer();
	mediaPlaying.value = false;
	setTrackName('Not playing');
	setIcon();
	if (!player) return;
	player.pause();
	player.muted = false;
};

const stateChanged = () => {
	setIcon();
	if (mediaPlaying.value) {
		startMedia();
	} else {
		stopMedia();
	}
};

const resumeSpotifyPlayer = () => {
	const mode = getCustomMusicMode();
	if (!spotifyPanel || mode.type !== 'spotify') return;
	const { playlistId } = mode;
	const uri = spotifyPlaylistUri(playlistId);
	pendingSpotifyUri = uri;
	ensureSpotifyController(uri);
	spotifyPanel.classList.add('show');
	if (spotifyController) {
		spotifyController.resume();
	}
	setTrackName('Spotify playlist');
};

const hideSpotifyPlayer = () => {
	if (!spotifyPanel) return;
	if (spotifyController) {
		spotifyController.pause();
	}
	spotifyPanel.classList.remove('show');
};

const stopSpotifyPlayer = () => {
	hideSpotifyPlayer();
};

const clearSpotifyPlayer = () => {
	hideSpotifyPlayer();
	if (spotifyController) {
		spotifyController.destroy();
		spotifyController = null;
	}
	if (spotifyEmbed) {
		spotifyEmbed.textContent = '';
	}
	pendingSpotifyUri = '';
};

const clearYouTubePlayer = () => {
	stopYouTubePlayer();
	youtubePendingMedia = null;
	if (youtubeFrame) {
		youtubeFrame.removeAttribute('src');
	}
};

const showYouTubePlayer = () => {
	if (!youtubePanel) return;
	youtubePanel.classList.add('show');
	setTrackName('YouTube');
};

const startYouTubePlayer = () => {
	showYouTubePlayer();
	if (hasYouTubePlayerMethod('playVideo') && mediaPlaying.value) {
		youtubePlayer.playVideo();
	}
};

const stopYouTubePlayer = () => {
	if (hasYouTubePlayerMethod('pauseVideo')) {
		youtubePlayer.pauseVideo();
	}
	if (youtubePanel) youtubePanel.classList.remove('show');
};

const randomizePlaylist = () => {
	let availableFiles = [...playlist.availableFiles];
	const randomPlaylist = [];
	while (availableFiles.length > 0) {
		const i = Math.floor(Math.random() * availableFiles.length);
		randomPlaylist.push(availableFiles[i]);
		availableFiles = availableFiles.filter((file, index) => index !== i);
	}
	playlist.availableFiles = randomPlaylist;
};

const setVolume = (newVolume) => {
	if (player) {
		player.volume = newVolume;
		player.muted = newVolume === 0 ? true : mediaMuted;
	}
	if (hasYouTubePlayerMethod('setVolume')) {
		youtubePlayer.setVolume(Math.round(newVolume * 100));
	}
	syncYouTubeAudioState();
};

const toggleMute = () => {
	mediaMuted = !mediaMuted;
	const mode = getCustomMusicMode();

	if (player) {
		player.muted = mediaMuted;
	}
	syncYouTubeAudioState();
	if (mode.type === 'spotify') {
		mediaPlaying.value = !mediaMuted;
	}
	if (spotifyController && mode.type === 'spotify') {
		if (mediaMuted) {
			spotifyController.pause();
		} else {
			spotifyController.resume();
		}
	}
	setIcon();
};

const sliderChanged = () => {
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
	if (!playlist.availableFiles || playlist?.availableFiles.length === 0) {
		throw new Error('No playlist available');
	}
	if (player) {
		return;
	}

	player = new Audio();
	currentTrack = 0;

	player.addEventListener('canplay', playerCanPlay);
	player.addEventListener('ended', playerEnded);

	player.src = `music/${playlist.availableFiles[currentTrack]}`;
	setTrackName(playlist.availableFiles[currentTrack]);
	player.type = 'audio/mpeg';
	setVolume(mediaVolume.value);
	volumeSliderInput.value = Math.round(mediaVolume.value * 100);
};

const playerCanPlay = async () => {
	if (!mediaPlaying.value) return;
	startMedia();
};

const playerEnded = () => {
	currentTrack += 1;
	if (currentTrack >= playlist.availableFiles.length) {
		randomizePlaylist();
		currentTrack = 0;
	}
	player.src = `music/${playlist.availableFiles[currentTrack]}`;
	setTrackName(playlist.availableFiles[currentTrack]);
};

const setTrackName = (fileName) => {
	const baseName = fileName.split('/').pop();
	const cleanBaseName = baseName.split(/[?#]/)[0];
	const trackName = decodeURIComponent(
		cleanBaseName.replace(/\.mp3/gi, '').replace(/(_-)/gi, ''),
	);
	document.getElementById('musicTrack').textContent = trackName;
};

export {
	// eslint-disable-next-line import/prefer-default-export
	handleClick,
};

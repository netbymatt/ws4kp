import fs from 'fs/promises';

const mp3Filter = (file) => file.match(/\.mp3$/);

const reader = async () => {
	// get the listing of files in the folder
	const rawFiles = await fs.readdir('./server/music');
	// filter for mp3 files
	const files = rawFiles.filter(mp3Filter);
	// if files were found return them
	if (files.length > 0) {
		return files;
	}

	// fall back to the default folder
	const defaultFiles = await fs.readdir('./server/music/default');
	return defaultFiles.map((file) => `default/${file}`).filter(mp3Filter);
};

export default reader;

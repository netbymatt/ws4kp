import fs from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseFile } from 'music-metadata';

const mp3Filter = (file) => file.match(/\.mp3$/);

const reader = async () => {
	// get the listing of files in the folder
	const rawFiles = await fs.readdir('./server/music');
	// filter for mp3 files
	const availableFiles = rawFiles.filter(mp3Filter);
	// fall back to the default folder if no files found
	if (availableFiles.length === 0) {
		const defaultFiles = await fs.readdir('./server/music/default');
		availableFiles.push(...defaultFiles.map((file) => `default/${file}`).filter(mp3Filter));
	}

	// read the metadata
	// key is file path
	const metaData = {};

	await Promise.allSettled(availableFiles.map(async (filePath) => {
		const file = resolve('./server/music', filePath);
		const fileData = await parseFile(file, { skipCovers: true });

		// combine metadata
		metaData[filePath] = {
			...fileData.common,
			duration: Math.round(fileData.format.duration),
		};
	}));

	// return the structure
	return {
		availableFiles,
		metaData,
	};
};

export default reader;

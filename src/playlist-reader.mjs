import fs from 'fs/promises';

const reader = async () => {
	// get the listing of files in the folder
	const rawFiles = await fs.readdir('./server/music');
	// filter for mp3 files
	const files = rawFiles.filter((file) => file.match(/\.mp3$/));
	console.log(files);
	return files;
};

export default reader;

import reader from './playlist-reader.mjs';

const playlistGenerator = async (req, res) => {
	try {
		const availableFiles = await reader();
		res.json({
			availableFiles,
		});
	} catch (e) {
		console.error(e);
		res.json({
			availableFiles: [],
		});
	}
};

export default playlistGenerator;

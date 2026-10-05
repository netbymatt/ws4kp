import reader from './playlist-reader.mjs';

const readerPromise = reader();

const playlistGenerator = async (req, res) => {
	try {
		const { availableFiles, metaData } = await readerPromise;
		res.json({
			availableFiles,
			metaData,
		});
	} catch (e) {
		console.error(e);
		res.json({
			availableFiles: [],
		});
	}
};

export default playlistGenerator;

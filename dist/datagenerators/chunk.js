// turn a long array into a set of smaller chunks

const chunk = (data, chunkSize = 10) => {
	const chunks = [];

	let thisChunk = [];

	data.forEach((d) => {
		if (thisChunk.length >= chunkSize) {
			chunks.push(thisChunk);
			thisChunk = [];
		}
		thisChunk.push(d);
	});

	// final chunk
	if (thisChunk.length > 0) chunks.push(thisChunk);

	return chunks;
};

module.exports = chunk;

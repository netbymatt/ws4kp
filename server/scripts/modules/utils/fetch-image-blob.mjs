// both fetch steps combined to allow for other image processing work to be done in parallel efficiently
const fetchImageBlob = async (url) => {
	const response = await fetch(url);
	// test response
	if (!response.ok) throw new Error(`Unable to fetch radar error ${response.status} ${response.statusText} from ${response.url}`);
	// get the blob
	return response.blob();
};

export default fetchImageBlob;

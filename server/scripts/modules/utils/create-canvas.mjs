const createCanvas = (size) => {
	const canvas = document.createElement('canvas');
	canvas.width = size.width;
	canvas.height = size.height;
	const context = canvas.getContext('2d');
	context.imageSmoothingEnabled = false;

	return [
		canvas,
		context,
	];
};

export default createCanvas;

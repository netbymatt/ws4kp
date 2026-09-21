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

// paint an ImageData onto a new canvas of its own size
const paintToCanvas = (image) => {
	const [canvas, context] = createCanvas(image);

	context.putImageData(image, 0, 0);

	return canvas;
};

export default createCanvas;

export {
	paintToCanvas,
};

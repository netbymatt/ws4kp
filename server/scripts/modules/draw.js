// drawing functionality and constants

// eslint-disable-next-line no-unused-vars
const draw = (() => {
	const horizontalGradient = (context, x1, y1, x2, y2, color1, color2) => {
		const linearGradient = context.createLinearGradient(0, y1, 0, y2);
		linearGradient.addColorStop(0, color1);
		linearGradient.addColorStop(0.4, color2);
		linearGradient.addColorStop(0.6, color2);
		linearGradient.addColorStop(1, color1);
		context.fillStyle = linearGradient;
		context.fillRect(x1, y1, x2 - x1, y2 - y1);
	};

	const horizontalGradientSingle = (context, x1, y1, x2, y2, color1, color2) => {
		const linearGradient = context.createLinearGradient(0, y1, 0, y2);
		linearGradient.addColorStop(0, color1);
		linearGradient.addColorStop(1, color2);
		context.fillStyle = linearGradient;
		context.fillRect(x1, y1, x2 - x1, y2 - y1);
	};

	const triangle = (context, color, x1, y1, x2, y2, x3, y3) => {
		context.fillStyle = color;
		context.beginPath();
		context.moveTo(x1, y1);
		context.lineTo(x2, y2);
		context.lineTo(x3, y3);
		context.fill();
	};

	const titleText = (context, title1, title2) => {
		const font = 'Star4000';
		const size = '24pt';
		const color = '#ffff00';
		const shadow = 3;
		const x = 170;
		let y = 55;

		if (title2) {
			text(context, font, size, color, x, y, title1, shadow); y += 30;
			text(context, font, size, color, x, y, title2, shadow); y += 30;
		} else {
			y += 15;
			text(context, font, size, color, x, y, title1, shadow); y += 30;
		}
	};

	const text = (context, font, size, color, x, y, myText, shadow = 0, align = 'start') => {
		context.textAlign = align;
		context.font = `${size} '${font}'`;
		context.shadowColor = '#000000';
		context.shadowOffsetX = shadow;
		context.shadowOffsetY = shadow;
		context.strokeStyle = '#000000';
		context.lineWidth = 2;
		context.strokeText(myText, x, y);
		context.fillStyle = color;
		context.fillText(myText, x, y);
		context.fillStyle = '';
		context.strokeStyle = '';
		context.shadowOffsetX = 0;
		context.shadowOffsetY = 0;
	};

	const box = (context, color, x, y, width, height) => {
		context.fillStyle = color;
		context.fillRect(x, y, width, height);
	};

	const border = (context, color, lineWith, x, y, width, height) => {
		context.strokeStyle = color;
		context.lineWidth = lineWith;
		context.strokeRect(x, y, width, height);
	};

	// TODO: implement full themes support
	const theme = 1;	// classic
	const topColor1 = 'rgb(192, 91, 2)';
	const topColor2 = 'rgb(72, 34, 64)';
	const sideColor1 = 'rgb(46, 18, 80)';
	const sideColor2 = 'rgb(192, 91, 2)';

	return {
		// methods
		horizontalGradient,
		horizontalGradientSingle,
		triangle,
		titleText,
		text,
		box,
		border,

		// constant-ish
		theme,
		topColor1,
		topColor2,
		sideColor1,
		sideColor2,
	};
})();

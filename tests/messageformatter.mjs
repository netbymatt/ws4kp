import chalk from 'chalk';

const describe = (jsHandle) => jsHandle.evaluate(
	// serialize |obj| however you want
	(obj) => `OBJ: ${typeof obj}, ${obj}`,
	jsHandle,
);

const colors = {
	LOG: chalk.grey,
	ERR: chalk.red,
	WAR: chalk.yellow,
	INF: chalk.cyan,
};

const formatter = async (message) => {
	const args = await Promise.all(message.args().map((arg) => describe(arg)));
	// make ability to paint different console[types]
	const type = message.type().substr(0, 3).toUpperCase();
	const color = colors[type] || chalk.blue;
	let text = '';
	for (let i = 0; i < args.length; i += 1) {
		text += `[${i}] ${args[i]} `;
	}
	console.log(color(`CONSOLE.${type}: ${message.text()}\n${text} `));
};

export default formatter;

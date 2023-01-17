const puppeteer = require('puppeteer');
const { setTimeout } = require('node:timers/promises');
const { readFile } = require('fs/promises');
const messageFormatter = require('./messageformatter');

(async () => {
	const browser = await puppeteer.launch({
		// headless: false,
		slowMo: 10,
		timeout: 10_000,
		dumpio: true,
	});

	// get the list of locations
	const LOCATIONS = JSON.parse(await readFile('./tests/locations.json'));

	// get the page
	const page = (await browser.pages())[0];
	await page.goto('http://localhost:8080');

	page.on('console', messageFormatter);

	// run all the locations
	for (let i = 0; i < LOCATIONS.length; i += 1) {
		const location = LOCATIONS[i];
		console.log(location);
		// eslint-disable-next-line no-await-in-loop
		await tester(location, page);
	}

	browser.close();
})();

const tester = async (location, page) => {
	// Set the address
	await page.type('#txtAddress', location);
	await setTimeout(500);
	// get the page
	await page.click('#btnGetLatLng');
	// wait for errors
	await setTimeout(5000);
};

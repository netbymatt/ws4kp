import puppeteer from 'puppeteer';
import { setTimeout } from 'node:timers/promises';
import { readFile } from 'fs/promises';
import messageFormatter from './messageformatter.mjs';

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

const tester = async (location, testPage) => {
	// Set the address
	await testPage.type('#txtAddress', location);
	await setTimeout(500);
	// get the page
	await testPage.click('#btnGetLatLng');
	// wait for errors
	await setTimeout(5000);
};

// run all the locations
for (let i = 0; i < LOCATIONS.length; i += 1) {
	const location = LOCATIONS[i];
	console.log(location);
	// eslint-disable-next-line no-await-in-loop
	await tester(location, page);
}

browser.close();

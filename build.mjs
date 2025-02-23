/* eslint-disable no-underscore-dangle */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Helpers
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distDir = path.join(__dirname, 'dist');

// Cleanup old dist folder
if (fs.existsSync(distDir)) fs.rmSync(distDir, { recursive: true, force: true });

// List of files and folders to include in the build
const includePaths = ['cors', 'datagenerators', 'server', 'views', 'public', 'index.js'];

// Function to copy files/folders
const copy = (src, dest) => {
	if (!fs.existsSync(src)) return;

	const stats = fs.lstatSync(src);
	if (stats.isDirectory()) {
		fs.mkdirSync(dest, { recursive: true });
		fs.readdirSync(src).forEach((file) => copy(path.join(src, file), path.join(dest, file)));
	} else {
		fs.copyFileSync(src, dest);
	}
};

// Copy each included file/folder
includePaths.forEach((item) => copy(path.join(__dirname, item), path.join(distDir, item)));

console.log('✅ Build completed: Files copied to dist/');

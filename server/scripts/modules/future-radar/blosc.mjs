/* eslint-disable no-bitwise */
/**
 * Minimal Blosc decoder for the hrrrzarr archive.
 *
 * Blosc is a container: a 16-byte header, a table of block offsets, then the
 * blocks, each cut into "splits" that are compressed on their own. The general
 * decoder ships every codec Blosc supports as a ~440 KB WebAssembly module,
 * but the archive only ever uses one combination — LZ4 blocks with a byte
 * shuffle — so that is all this implements: about a kilobyte instead. Anything
 * else throws rather than decoding wrongly.
 *
 * Header layout (little-endian):
 *   byte 0      format version
 *   byte 1      compressor format version
 *   byte 2      flags (see below)
 *   byte 3      type size, the width in bytes of one array element
 *   bytes 4-7   uncompressed size
 *   bytes 8-11  block size
 *   bytes 12-15 compressed size, header included
 */

const HEADER_SIZE = 16;

// flags, byte 2 of the header
const FLAG_BYTE_SHUFFLE = 0x01;
const FLAG_STORED = 0x02; // incompressible data, copied in as is
const FLAG_BIT_SHUFFLE = 0x04;
const FLAG_DELTA = 0x08;
const FLAG_DONT_SPLIT = 0x10;
const CODEC_MASK = 0xe0;
const CODEC_LZ4 = 1 << 5;

// A block is cut into one split per byte of the type size, unless the type
// is wider than this or the pieces would be smaller than this.
const MAX_SPLITS = 16;
const MIN_SPLIT_SIZE = 128;

/**
 * Decompress one raw LZ4 block (no frame header) from source[start, end) into
 * target, which must be exactly `size` bytes from `targetStart`.
 */
const lz4Block = (source, start, end, target, targetStart, size) => {
	let read = start;
	let write = targetStart;

	// a length of 15 or more in the token continues in following bytes, each
	// adding to it until one is below 255
	const readLength = (initial) => {
		let length = initial;
		if (initial === 15) {
			let more;
			do {
				more = source[read];
				read += 1;
				length += more;
			} while (more === 255);
		}
		return length;
	};

	while (read < end) {
		const token = source[read];
		read += 1;

		// literals, copied straight across
		const literals = readLength(token >> 4);
		for (let i = 0; i < literals; i += 1) {
			target[write] = source[read];
			write += 1;
			read += 1;
		}

		// the last sequence in a block carries literals only
		if (read >= end) break;

		// a match, copied byte by byte from earlier output because it may overlap itself
		const offset = source[read] | (source[read + 1] << 8);
		read += 2;
		const matchLength = readLength(token & 15) + 4;
		for (let i = 0; i < matchLength; i += 1) {
			target[write] = target[write - offset];
			write += 1;
		}
	}

	if (write - targetStart !== size) throw new Error('Corrupt LZ4 block in Blosc data');
};

/**
 * Undo the byte shuffle. Shuffling stores byte 0 of every element, then byte 1
 * of every element, and so on, which groups similar bytes together so they
 * compress better.
 */
const unshuffle = (source, target, targetStart, size, typeSize) => {
	const elements = Math.floor(size / typeSize);

	for (let byte = 0; byte < typeSize; byte += 1) {
		for (let element = 0; element < elements; element += 1) {
			target[targetStart + element * typeSize + byte] = source[byte * elements + element];
		}
	}

	// bytes that don't make up a whole element are left as they were
	for (let i = elements * typeSize; i < size; i += 1) target[targetStart + i] = source[i];
};

/**
 * Decode a Blosc buffer into its original bytes.
 * @param {Uint8Array} buffer
 * @returns {Uint8Array}
 */
const decodeBlosc = (buffer) => {
	const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
	const flags = buffer[2];
	const typeSize = buffer[3];
	const size = view.getUint32(4, true);
	const blockSize = view.getUint32(8, true);

	if (buffer.length < HEADER_SIZE || view.getUint32(12, true) !== buffer.length) {
		throw new Error('Truncated Blosc data');
	}

	const output = new Uint8Array(size);

	if (flags & FLAG_STORED) {
		output.set(buffer.subarray(HEADER_SIZE, HEADER_SIZE + size));
		return output;
	}

	if ((flags & CODEC_MASK) !== CODEC_LZ4 || flags & (FLAG_BIT_SHUFFLE | FLAG_DELTA)) {
		throw new Error(`Unsupported Blosc encoding (flags 0x${flags.toString(16)}), expected LZ4 with byte shuffle`);
	}

	const shuffled = (flags & FLAG_BYTE_SHUFFLE) !== 0;
	const blockCount = Math.ceil(size / blockSize);
	const scratch = shuffled ? new Uint8Array(blockSize) : null;

	for (let block = 0; block < blockCount; block += 1) {
		const blockStart = block * blockSize;
		// the last block is whatever is left over
		const length = Math.min(blockSize, size - blockStart);
		const isLeftover = length !== blockSize;

		const canSplit = !(flags & FLAG_DONT_SPLIT) && !isLeftover
			&& typeSize <= MAX_SPLITS && length / typeSize >= MIN_SPLIT_SIZE;
		const splits = canSplit ? typeSize : 1;
		const splitLength = Math.floor(length / splits);

		// decompress into scratch space when a shuffle is still to be undone, straight into the output otherwise
		const target = shuffled ? scratch : output;
		let write = shuffled ? 0 : blockStart;
		let read = view.getUint32(HEADER_SIZE + block * 4, true);

		for (let split = 0; split < splits; split += 1) {
			// each split is prefixed by its compressed length, and stored as is when that equals its size
			const compressed = view.getInt32(read, true);
			read += 4;
			if (compressed === splitLength) {
				target.set(buffer.subarray(read, read + compressed), write);
			} else {
				lz4Block(buffer, read, read + compressed, target, write, splitLength);
			}
			read += compressed;
			write += splitLength;
		}

		if (shuffled) unshuffle(scratch, output, blockStart, length, typeSize);
	}

	return output;
};

export default decodeBlosc;

import { createHash } from "node:crypto";

const tidAlphabet = "234567abcdefghijklmnopqrstuvwxyz";
const microsecondsPerDay = 86_400_000_000n;

/**
 * Encodes a non-negative 64-bit integer as a 13-character AT Protocol TID.
 *
 * @param {bigint} value
 * @returns {string}
 */
function encodeTid(value) {
	let remaining = value;
	let encoded = "";

	for (let index = 0; index < 13; index += 1) {
		encoded = tidAlphabet[Number(remaining & 31n)] + encoded;
		remaining >>= 5n;
	}

	if (remaining !== 0n || !/^[234567abcdefghij][234567abcdefghijklmnopqrstuvwxyz]{12}$/.test(encoded)) {
		throw new RangeError("The generated value is outside the AT Protocol TID range.");
	}

	return encoded;
}

/**
 * Generates a stable TID whose timestamp falls on the supplied UTC date.
 *
 * @param {string} seed
 * @param {number} timestamp
 * @returns {string}
 */
function stableTid(seed, timestamp) {
	const digest = createHash("sha256").update(seed).digest();
	let entropy = 0n;
	for (const byte of digest.subarray(0, 8)) entropy = (entropy << 8n) | BigInt(byte);

	const microseconds = BigInt(timestamp) * 1_000n + (entropy % microsecondsPerDay);
	const clockIdentifier = (entropy >> 54n) & 1_023n;
	return encodeTid((microseconds << 10n) | clockIdentifier);
}

const publicationRkey = stableTid("https://til.desertthunder.dev", Date.UTC(2026, 6, 18));

export const STANDARD_SITE = Object.freeze({
	did: "did:plc:xg2vq45muivyy3xwatcehspu",
	handle: "desertthunder.dev",
	siteUrl: "https://til.desertthunder.dev",
	publicationCollection: "site.standard.publication",
	documentCollection: "site.standard.document",
	publicationRkey,
});

export const STANDARD_SITE_PUBLICATION_URI = `at://${STANDARD_SITE.did}/${STANDARD_SITE.publicationCollection}/${STANDARD_SITE.publicationRkey}`;

/**
 * Returns a stable AT Protocol record key for a note ID.
 *
 * The Standard.site document Lexicon requires TID record keys. The note ID
 * selects a stable time within its publication date, keeping reruns idempotent
 * while satisfying the TID grammar.
 *
 * @param {string} noteId
 * @returns {string}
 */
export function standardSiteDocumentRkey(noteId) {
	const match = typeof noteId === "string" ? noteId.match(/^(\d{4})\/(\d{2})\/(\d{2})\/.+$/) : undefined;
	if (!match) {
		throw new TypeError("A dated note ID is required.");
	}

	const [, year, month, day] = match;
	const timestamp = Date.UTC(Number(year), Number(month) - 1, Number(day));
	const date = new Date(timestamp);
	if (
		date.getUTCFullYear() !== Number(year) ||
		date.getUTCMonth() !== Number(month) - 1 ||
		date.getUTCDate() !== Number(day)
	) {
		throw new TypeError("The note ID must start with a valid publication date.");
	}

	return stableTid(noteId, timestamp);
}

/**
 * Returns the AT-URI for a note's Standard.site document record.
 *
 * @param {string} noteId
 * @returns {string}
 */
export function standardSiteDocumentUri(noteId) {
	return `at://${STANDARD_SITE.did}/${STANDARD_SITE.documentCollection}/${standardSiteDocumentRkey(noteId)}`;
}

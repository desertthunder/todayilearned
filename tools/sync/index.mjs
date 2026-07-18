import { readFile, readdir } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";
import { dirname, relative, resolve, sep } from "node:path";
import { parseFrontmatter } from "astro/markdown";
import {
	STANDARD_SITE,
	STANDARD_SITE_PUBLICATION_URI,
	standardSiteDocumentRkey,
	standardSiteDocumentUri,
} from "../../src/lib/standard-site.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectDirectory = resolve(scriptDirectory, "../..");
const notesDirectory = resolve(projectDirectory, "til");
const notePathPattern = /^\d{4}\/\d{2}\/\d{2}\/.+\.md$/;

/**
 * Recursively lists the Markdown files under a directory.
 *
 * @param {string} directory
 * @returns {Promise<string[]>}
 */
async function listMarkdownFiles(directory) {
	const entries = await readdir(directory, { withFileTypes: true });
	const files = await Promise.all(
		entries.map(async (entry) => {
			const path = resolve(directory, entry.name);
			if (entry.isDirectory()) return listMarkdownFiles(path);
			return entry.isFile() && entry.name.endsWith(".md") ? [path] : [];
		}),
	);

	return files.flat().sort();
}

/**
 * Converts the Markdown body to a plain-text representation for the
 * Standard.site textContent field. The original Markdown is stored separately.
 *
 * @param {string} markdown
 * @returns {string}
 */
export function markdownToPlainText(markdown) {
	return markdown
		.replace(/^```[^\n]*\n?/gm, "")
		.replace(/^~~~[^\n]*\n?/gm, "")
		.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
		.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
		.replace(/^\[\^[^\]]+\]:\s*/gm, "")
		.replace(/\[\^[^\]]+\]/g, "")
		.replace(/^\s{0,3}(?:#{1,6}|>|[-+*]|\d+[.)])\s+/gm, "")
		.replace(/<[^>]+>/g, "")
		.replace(/[`*_~]/g, "")
		.replace(/\s+/g, " ")
		.trim();
}

/**
 * Creates the stable publication record shared by every note.
 *
 * @returns {Record<string, unknown>}
 */
export function buildPublicationRecord() {
	return {
		$type: STANDARD_SITE.publicationCollection,
		url: STANDARD_SITE.siteUrl,
		name: "Today I Learned",
		description: "A daily log and collection of things Owais has learned.",
		preferences: { showInDiscover: true },
	};
}

/**
 * Creates a Standard.site document record from a dated Markdown note.
 *
 * @param {object} note
 * @param {string} note.id
 * @param {string} note.rawMarkdown
 * @param {string} note.body
 * @param {Record<string, unknown>} note.frontmatter
 * @returns {Record<string, unknown>}
 */
export function buildDocumentRecord(note) {
	const title = note.frontmatter.title;
	const tags = note.frontmatter.tags ?? [];
	const description = note.frontmatter.description;

	if (typeof title !== "string" || title.length === 0) {
		throw new TypeError(`${note.id} must have a non-empty string title.`);
	}
	if (!Array.isArray(tags) || tags.some((tag) => typeof tag !== "string")) {
		throw new TypeError(`${note.id} tags must be an array of strings.`);
	}
	if (description !== undefined && typeof description !== "string") {
		throw new TypeError(`${note.id} description must be a string when present.`);
	}

	const [year, month, day] = note.id.split("/", 3);
	const publishedAt = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
	if (
		publishedAt.getUTCFullYear() !== Number(year) ||
		publishedAt.getUTCMonth() !== Number(month) - 1 ||
		publishedAt.getUTCDate() !== Number(day)
	) {
		throw new TypeError(`${note.id} does not start with a valid publication date.`);
	}

	const textContent = markdownToPlainText(note.body);
	const record = {
		$type: STANDARD_SITE.documentCollection,
		site: STANDARD_SITE_PUBLICATION_URI,
		path: `/notes/${note.id}/`,
		title,
		publishedAt: publishedAt.toISOString(),
		content: {
			$type: "at.markpub.markdown",
			flavor: "gfm",
			renderingRules: "satteri",
			extensions: ["YAML"],
			text: { $type: "at.markpub.text", markdown: note.rawMarkdown },
		},
		textContent,
	};

	if (description) record.description = description;
	if (tags.length > 0) record.tags = tags;

	return record;
}

/**
 * Loads dated TIL notes from the checked-out submodule.
 *
 * @returns {Promise<Array<{id: string, rawMarkdown: string, body: string, frontmatter: Record<string, unknown>}>>}
 */
export async function loadNotes() {
	const files = await listMarkdownFiles(notesDirectory);
	const notes = [];

	for (const file of files) {
		const relativePath = relative(notesDirectory, file).split(sep).join("/");
		if (!notePathPattern.test(relativePath)) continue;

		const rawMarkdown = await readFile(file, "utf8");
		const { content: body, frontmatter } = parseFrontmatter(rawMarkdown);
		notes.push({ id: relativePath.slice(0, -".md".length), rawMarkdown, body, frontmatter });
	}

	if (notes.length === 0) {
		throw new Error("No dated Markdown notes were found. Initialize the til submodule before syncing.");
	}

	return notes;
}

/**
 * Resolves the account's current PDS from its did:plc document.
 *
 * ATPROTO_SERVICE can override discovery for testing or during a PLC outage.
 *
 * @returns {Promise<string>}
 */
async function resolvePdsService() {
	if (process.env.ATPROTO_SERVICE) return process.env.ATPROTO_SERVICE;

	const response = await fetch(`https://plc.directory/${STANDARD_SITE.did}`);
	if (!response.ok) {
		throw new Error(`Could not resolve ${STANDARD_SITE.did} (${response.status} ${response.statusText}).`);
	}

	const didDocument = await response.json();
	const pds = didDocument.service?.find(
		(service) => service.id === "#atproto_pds" && service.type === "AtprotoPersonalDataServer",
	)?.serviceEndpoint;

	if (typeof pds !== "string" || !pds.startsWith("https://")) {
		throw new Error(`${STANDARD_SITE.did} does not advertise an HTTPS AT Protocol PDS.`);
	}

	return pds;
}

/**
 * Sends a JSON XRPC request and returns its response body.
 *
 * @param {string} service
 * @param {string} method
 * @param {object} options
 * @param {string} [options.accessJwt]
 * @param {Record<string, unknown>} [options.body]
 * @returns {Promise<Record<string, any>>}
 */
async function xrpc(service, method, { accessJwt, body } = {}) {
	const headers = { accept: "application/json" };
	if (accessJwt) headers.authorization = `Bearer ${accessJwt}`;
	if (body) headers["content-type"] = "application/json";

	const response = await fetch(new URL(`/xrpc/${method}`, service), {
		method: body ? "POST" : "GET",
		headers,
		body: body ? JSON.stringify(body) : undefined,
	});
	const payload = await response.json().catch(() => ({}));

	if (!response.ok) {
		const error = new Error(
			`${method} failed (${response.status}): ${payload.message ?? payload.error ?? response.statusText}`,
		);
		error.status = response.status;
		error.code = payload.error;
		throw error;
	}

	return payload;
}

/**
 * Reads an existing PDS record, returning undefined when it does not exist.
 *
 * @param {string} service
 * @param {string} accessJwt
 * @param {string} collection
 * @param {string} rkey
 * @returns {Promise<Record<string, unknown> | undefined>}
 */
async function getRecord(service, accessJwt, collection, rkey) {
	const url = new URL("/xrpc/com.atproto.repo.getRecord", service);
	url.searchParams.set("repo", STANDARD_SITE.did);
	url.searchParams.set("collection", collection);
	url.searchParams.set("rkey", rkey);

	const response = await fetch(url, { headers: { accept: "application/json", authorization: `Bearer ${accessJwt}` } });
	const payload = await response.json().catch(() => ({}));

	if (!response.ok) {
		if (payload.error === "RecordNotFound") return undefined;
		throw new Error(
			`com.atproto.repo.getRecord failed (${response.status}): ${payload.message ?? payload.error ?? response.statusText}`,
		);
	}

	return payload.value;
}

/**
 * Creates or updates a record only when its value has changed.
 *
 * @param {string} service
 * @param {string} accessJwt
 * @param {string} collection
 * @param {string} rkey
 * @param {Record<string, unknown>} record
 * @returns {Promise<"created" | "updated" | "unchanged">}
 */
async function putRecordIfChanged(service, accessJwt, collection, rkey, record) {
	const current = await getRecord(service, accessJwt, collection, rkey);
	if (current && isDeepStrictEqual(current, record)) return "unchanged";

	await xrpc(service, "com.atproto.repo.putRecord", {
		accessJwt,
		body: { repo: STANDARD_SITE.did, collection, rkey, record },
	});

	return current ? "updated" : "created";
}

/**
 * Syncs the publication and all local notes to the configured PDS.
 *
 * @returns {Promise<void>}
 */
export async function main() {
	const notes = await loadNotes();

	if (process.argv.includes("--dry-run")) {
		console.log(`Publication: ${STANDARD_SITE_PUBLICATION_URI}`);
		for (const note of notes) console.log(`Document:    ${standardSiteDocumentUri(note.id)}`);
		console.log(`Dry run complete: ${notes.length} notes validated; no PDS records were written.`);
		return;
	}

	const password = process.env.ATPROTO_APP_PASSWORD;
	if (!password) {
		throw new Error("ATPROTO_APP_PASSWORD is required. Use an app password, not the account password.");
	}

	const service = await resolvePdsService();
	const session = await xrpc(service, "com.atproto.server.createSession", {
		body: { identifier: process.env.ATPROTO_HANDLE ?? STANDARD_SITE.handle, password },
	});

	if (session.did !== STANDARD_SITE.did) {
		throw new Error(`Authenticated as ${session.did}, but this site is configured for ${STANDARD_SITE.did}.`);
	}

	const counts = { created: 0, updated: 0, unchanged: 0 };
	const publicationResult = await putRecordIfChanged(
		service,
		session.accessJwt,
		STANDARD_SITE.publicationCollection,
		STANDARD_SITE.publicationRkey,
		buildPublicationRecord(),
	);
	counts[publicationResult] += 1;

	for (const note of notes) {
		const result = await putRecordIfChanged(
			service,
			session.accessJwt,
			STANDARD_SITE.documentCollection,
			standardSiteDocumentRkey(note.id),
			buildDocumentRecord(note),
		);
		counts[result] += 1;
		console.log(`${result.padEnd(9)} ${standardSiteDocumentUri(note.id)}`);
	}

	console.log(`Sync complete: ${counts.created} created, ${counts.updated} updated, ${counts.unchanged} unchanged.`);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : undefined;
if (invokedPath === fileURLToPath(import.meta.url)) {
	main().catch((error) => {
		console.error(error instanceof Error ? error.message : error);
		process.exitCode = 1;
	});
}

import { posix } from "node:path";
import { defineMdastPlugin } from "satteri";

const wikilinkPattern = /\[\[([^\[\]\n]+)\]\]/g;

/**
 * Returns whether Markdown contains Obsidian-style wikilink syntax.
 *
 * @param {string} markdown
 */
export function hasWikilinks(markdown) {
	wikilinkPattern.lastIndex = 0;
	const found = wikilinkPattern.test(markdown);
	wikilinkPattern.lastIndex = 0;
	return found;
}

/**
 * Replaces wikilinks with their visible labels for plain-text representations.
 *
 * @param {string} markdown
 */
export function wikilinksToPlainText(markdown) {
	return markdown.replace(wikilinkPattern, (_match, value) => {
		const { label, target } = parseWikilink(value);
		return label ?? posix.basename(withoutMarkdownExtension(target));
	});
}

/**
 * Creates a Satteri plugin that resolves wikilinks against dated note IDs.
 *
 * @param {string[]} noteIds
 * @param {string} sourceId
 */
export function wikilinks(noteIds, sourceId) {
	const ids = new Set(noteIds);
	const idsByBasename = new Map();

	for (const id of noteIds) {
		const basename = posix.basename(id);
		const matches = idsByBasename.get(basename) ?? [];
		matches.push(id);
		idsByBasename.set(basename, matches);
	}

	return defineMdastPlugin({
		name: "wikilinks",
		text(node, context) {
			if (!hasWikilinks(node.value)) return;

			const parent = context.parent(node);
			if (parent?.type === "link" || parent?.type === "linkReference") return;

			const children = [];
			let offset = 0;

			for (const match of node.value.matchAll(wikilinkPattern)) {
				if (match.index > offset) children.push({ type: "text", value: node.value.slice(offset, match.index) });

				const { label, target } = parseWikilink(match[1]);
				const targetId = resolveTarget(target, ids, idsByBasename, sourceId);
				children.push({
					type: "link",
					url: `/notes/${targetId.split("/").map(encodeURIComponent).join("/")}/`,
					children: [{ type: "text", value: label ?? posix.basename(targetId) }],
				});
				offset = match.index + match[0].length;
			}

			if (offset < node.value.length) children.push({ type: "text", value: node.value.slice(offset) });
			context.insertBefore(node, children);
			context.removeNode(node);
		},
	});
}

function parseWikilink(value) {
	const separator = value.indexOf("|");
	const target = (separator === -1 ? value : value.slice(0, separator)).trim();
	const label = separator === -1 ? undefined : value.slice(separator + 1).trim();

	if (!target) throw new Error("A wikilink target cannot be empty.");
	if (label === "") throw new Error(`Wikilink [[${value}]] has an empty label.`);
	if (target.includes("#") || target.includes("^")) {
		throw new Error(`Wikilink [[${value}]] uses a heading or block reference, which is not supported.`);
	}

	return { label, target };
}

function withoutMarkdownExtension(target) {
	return target.endsWith(".md") ? target.slice(0, -3) : target;
}

function resolveTarget(target, ids, idsByBasename, sourceId) {
	const normalized = withoutMarkdownExtension(target);
	if (normalized.includes("/")) {
		if (ids.has(normalized)) return normalized;
		throw new Error(`Wikilink [[${target}]] in ${sourceId} does not match a note.`);
	}

	const matches = idsByBasename.get(normalized) ?? [];
	if (matches.length === 1) return matches[0];
	if (matches.length === 0) throw new Error(`Wikilink [[${target}]] in ${sourceId} does not match a note.`);

	throw new Error(`Wikilink [[${target}]] in ${sourceId} is ambiguous; use one of: ${matches.join(", ")}.`);
}

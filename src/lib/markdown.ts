import { existsSync } from "node:fs";
import { posix, resolve } from "node:path";
import katex from "katex";
import { defineHastPlugin, defineMdastPlugin, markdownToHtml } from "satteri";
import { wikilinks } from "./wikilinks.mjs";

const remoteTilUrl = "https://raw.githubusercontent.com/desertthunder/til/main/";

function rewriteMarkdownUrl(url: string): string {
	if (url.startsWith("/") || url.startsWith("#") || url.startsWith("?") || /^[a-z][a-z\d+.-]*:/i.test(url)) {
		return url;
	}
	const [pathAndSearch, hash = ""] = url.split("#", 2);
	const [path, search = ""] = pathAndSearch.split("?", 2);
	if (!path.endsWith(".md")) return url;
	return `${path.slice(0, -3)}/${search ? `?${search}` : ""}${hash ? `#${hash}` : ""}`;
}

/**
 * Satteri's equivalent of the remark transform.
 *
 * It converts only relative Markdown links, so references to another
 * TIL land on the generated route.
 */
const tilLinks = defineMdastPlugin({
	name: "til-links",
	link(node, context) {
		const rewrittenUrl = rewriteMarkdownUrl(node.url);
		if (rewrittenUrl !== node.url) context.setProperty(node, "url", rewrittenUrl);
	},
});

function rewriteImageUrl(url: string, noteId: string): string {
	if (url.startsWith("/") || url.startsWith("#") || url.startsWith("?") || /^[a-z][a-z\d+.-]*:/i.test(url)) {
		return url;
	}

	const noteDirectory = posix.dirname(noteId);
	if (!existsSync(resolve("til/.git"))) {
		return new URL(url, `${remoteTilUrl}${noteDirectory}/`).href;
	}

	const assetUrl = new URL(url, `https://til.invalid/assets/${noteDirectory}/`);
	if (!assetUrl.pathname.startsWith("/assets/")) return url;

	return `${assetUrl.pathname}${assetUrl.search}${assetUrl.hash}`;
}

function tilImages(noteId: string) {
	return defineMdastPlugin({
		name: "til-images",
		image(node, context) {
			const rewrittenUrl = rewriteImageUrl(node.url, noteId);
			if (rewrittenUrl !== node.url) context.setProperty(node, "url", rewrittenUrl);
		},
	});
}

function hasClass(node: { properties?: Record<string, unknown> }, name: string): boolean {
	const className = node.properties?.className;
	return Array.isArray(className) ? className.includes(name) : className === name;
}

const tilMath = defineHastPlugin({
	name: "til-math",
	element: [
		{
			filter: ["pre"],
			visit(node, context) {
				const code = node.children[0];
				if (code?.type !== "element" || !hasClass(code, "math-display")) return;

				context.replaceNode(node, {
					type: "raw",
					value: katex.renderToString(context.textContent(code), { displayMode: true }),
				});
			},
		},
		{
			filter: ["code"],
			visit(node, context) {
				if (!hasClass(node, "math-inline")) return;

				context.replaceNode(node, { type: "raw", value: katex.renderToString(context.textContent(node)) });
			},
		},
	],
});

export function renderTilMarkdown(markdown: string, noteId: string, noteIds: string[]): string {
	return markdownToHtml(markdown, {
		features: {
			gfm: { footnotes: { label: "References", backContent: "↩", backLabel: "Back to reference {reference}" } },
			math: true,
		},
		mdastPlugins: [wikilinks(noteIds, noteId), tilLinks, tilImages(noteId)],
		hastPlugins: [tilMath],
	}).html;
}

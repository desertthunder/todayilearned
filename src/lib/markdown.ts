import { existsSync } from "node:fs";
import { posix, resolve } from "node:path";
import { defineMdastPlugin, markdownToHtml } from "satteri";

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

export function renderTilMarkdown(markdown: string, noteId: string): string {
	return markdownToHtml(markdown, {
		features: {
			gfm: { footnotes: { label: "References", backContent: "↩", backLabel: "Back to reference {reference}" } },
		},
		mdastPlugins: [tilLinks, tilImages(noteId)],
	}).html;
}

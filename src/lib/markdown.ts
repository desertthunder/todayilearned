import { defineMdastPlugin, markdownToHtml } from 'satteri';

function rewriteMarkdownUrl(url: string): string {
	if (
		url.startsWith('/') ||
		url.startsWith('#') ||
		url.startsWith('?') ||
		/^[a-z][a-z\d+.-]*:/i.test(url)
	)
		return url;

	const [pathAndSearch, hash = ''] = url.split('#', 2);
	const [path, search = ''] = pathAndSearch.split('?', 2);
	if (!path.endsWith('.md')) return url;

	return `${path.slice(0, -3)}/${search ? `?${search}` : ''}${hash ? `#${hash}` : ''}`;
}

/**
 * Satteri's equivalent of the old remark transform. It converts only relative
 * Markdown links, so references to another TIL land on the generated route.
 */
const tilLinks = defineMdastPlugin({
	name: 'til-links',
	link(node, context) {
		const rewrittenUrl = rewriteMarkdownUrl(node.url);
		if (rewrittenUrl !== node.url) context.setProperty(node, 'url', rewrittenUrl);
	},
});

export function renderTilMarkdown(markdown: string): string {
	return markdownToHtml(markdown, {
		features: {
			gfm: {
				footnotes: {
					label: 'References',
					backContent: '↩',
					backLabel: 'Back to reference {reference}',
				},
			},
		},
		mdastPlugins: [tilLinks],
	}).html;
}

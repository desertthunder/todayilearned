import { Buffer } from 'node:buffer';
import { parseFrontmatter } from 'astro/markdown';
import type { Loader } from 'astro/loaders';

const repositoryApi = 'https://api.github.com/repos/desertthunder/til';
const branch = 'main';
const datedMarkdownPath = /^\d{4}\/\d{2}\/\d{2}\/.+\.md$/;

type GitHubTreeEntry = {
	path: string;
	sha: string;
	type: string;
}

type GitHubTree = {
	tree: GitHubTreeEntry[];
	truncated?: boolean;
}

type GitHubBlob = {
	content: string;
	encoding: string;
}

async function getGitHubJson<T>(path: string): Promise<T> {
	const response = await fetch(`${repositoryApi}${path}`, {
		headers: { accept: 'application/vnd.github+json' },
	});

	if (!response.ok) {
		throw new Error(
			`GitHub API request failed (${response.status} ${response.statusText}) for ${path}.`,
		);
	}

	return (await response.json()) as T;
}

function decodeBlob(blob: GitHubBlob): string {
	if (blob.encoding !== 'base64') {
		throw new Error(`Expected a base64 GitHub blob, received ${blob.encoding}.`);
	}

	return Buffer.from(blob.content.replace(/\s/g, ''), 'base64').toString('utf8');
}

/**
 * Uses the public GitHub API when the checked-out submodule is unavailable.
 *
 * The body is stored without frontmatter to match Astro's local glob loader.
 */
export function githubTilLoader(): Loader {
	return {
		name: 'github-til-loader',
		async load({ parseData, store }) {
			const tree = await getGitHubJson<GitHubTree>(
				`/git/trees/${branch}?recursive=1`,
			);

			if (tree.truncated) {
				throw new Error(
					'The GitHub TIL tree was truncated. Initialize the til submodule to build the full archive.',
				);
			}

			const notes = tree.tree
				.filter((entry) => entry.type === 'blob' && datedMarkdownPath.test(entry.path))
				.sort((left, right) => left.path.localeCompare(right.path));
			const staleIds = new Set(store.keys());

			for (const note of notes) {
				const id = note.path.slice(0, -'.md'.length);
				staleIds.delete(id);

				if (store.get(id)?.digest === note.sha) continue;

				const blob = await getGitHubJson<GitHubBlob>(`/git/blobs/${note.sha}`);
				const { content: body, frontmatter } = parseFrontmatter(decodeBlob(blob));
				const data = await parseData({ id, data: frontmatter });

				store.set({ id, data, body, digest: note.sha });
			}

			for (const id of staleIds) store.delete(id);
		},
	};
}

import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";
import type { APIRoute } from "astro";

const tilDirectory = resolve("til");
const imageTypes = new Map([
	[".avif", "image/avif"],
	[".gif", "image/gif"],
	[".jpeg", "image/jpeg"],
	[".jpg", "image/jpeg"],
	[".png", "image/png"],
	[".svg", "image/svg+xml"],
	[".webp", "image/webp"],
]);

async function findImages(directory: string): Promise<string[]> {
	const images: string[] = [];

	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const entryPath = join(directory, entry.name);
		if (entry.isDirectory()) {
			images.push(...(await findImages(entryPath)));
		} else if (imageTypes.has(extname(entry.name).toLowerCase())) {
			images.push(relative(tilDirectory, entryPath));
		}
	}

	return images;
}

export async function getStaticPaths() {
	return (await findImages(tilDirectory)).map((path) => ({ params: { path }, props: { path } }));
}

export const GET = (async ({ props }) => {
	const path = props.path as string;
	const contentType = imageTypes.get(extname(path).toLowerCase());
	if (!contentType) return new Response(null, { status: 404 });

	return new Response(await readFile(join(tilDirectory, path)), { headers: { "Content-Type": contentType } });
}) satisfies APIRoute;

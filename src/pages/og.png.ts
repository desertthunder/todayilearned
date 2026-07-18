import type { APIRoute } from "astro";
import { generateOGImage } from "../lib/og-image";

export const prerender = true;

export const GET: APIRoute = async () => {
	try {
		const image = await generateOGImage();
		await image.ready;

		return new Response(image.body, {
			headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=31536000, immutable" },
		});
	} catch (error) {
		console.error("Failed to generate the Open Graph image", error);
		return new Response("Failed to generate image", { status: 500 });
	}
};

import rss from "@astrojs/rss";
import type { APIRoute } from "astro";
import { META } from "../lib/meta";
import { dateFromId, excerptFor, getNotes, hrefFor } from "../lib/til";

export const GET: APIRoute = async (context) => {
	const entries = await getNotes();

	return rss({
		title: META.TITLE,
		description: META.DESCRIPTION,
		site: context.site ?? META.SITE_URL,
		customData: "<language>en-us</language>",
		items: entries.map((entry) => ({
			title: entry.data.title,
			description: excerptFor(entry),
			pubDate: dateFromId(entry.id),
			link: hrefFor(entry),
		})),
	});
};

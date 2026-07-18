import { getCollection, type CollectionEntry } from "astro:content";
import { META } from "./meta";

export type NoteEntry = CollectionEntry<"til">;

const datePath = /^(\d{4})\/(\d{2})\/(\d{2})\/.+$/;

export function dateFromId(id: string): Date | undefined {
	const match = id.match(datePath);
	if (!match) return undefined;

	const [, year, month, day] = match;
	const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));

	if (
		date.getUTCFullYear() !== Number(year) ||
		date.getUTCMonth() !== Number(month) - 1 ||
		date.getUTCDate() !== Number(day)
	) {
		return undefined;
	}

	return date;
}

export function isTilEntry(entry: NoteEntry): boolean {
	return dateFromId(entry.id) !== undefined;
}

export async function getNotes(): Promise<NoteEntry[]> {
	const entries = await getCollection("til");
	return entries
		.filter(isTilEntry)
		.sort((left, right) => dateFromId(right.id)!.getTime() - dateFromId(left.id)!.getTime());
}

export function hrefFor(entry: NoteEntry): string {
	return `/notes/${entry.id}/`;
}

export function sourceHrefFor(entry: NoteEntry): string {
	return `${META.REPO_URL}/blob/main/${entry.id}.md`;
}

export function formatDate(date: Date, options: Intl.DateTimeFormatOptions = {}): string {
	return new Intl.DateTimeFormat("en", {
		day: "numeric",
		month: "short",
		year: "numeric",
		timeZone: "UTC",
		...options,
	}).format(date);
}

export function excerptFor(entry: NoteEntry): string {
	if (entry.data.description) return entry.data.description;

	const paragraph = (entry.body ?? "")
		.split(/\n\s*\n/)
		.map((block) => block.replace(/\n/g, " ").trim())
		.find((block) => block.length > 0 && !block.startsWith("#") && !block.startsWith("```"));

	if (!paragraph) return "";

	const plainText = paragraph
		.replace(/!\[[^\]]*\]\([^)]*\)/g, "")
		.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
		.replace(/[`*_>#]/g, "")
		.replace(/\[\^\d+\]/g, "")
		.trim();

	return plainText.length > 170 ? `${plainText.slice(0, 167).trimEnd()}…` : plainText;
}

export function tagCounts(entries: NoteEntry[]): Array<{ tag: string; count: number }> {
	const counts = new Map<string, number>();

	for (const entry of entries) {
		for (const tag of entry.data.tags) {
			counts.set(tag, (counts.get(tag) ?? 0) + 1);
		}
	}

	return [...counts]
		.map(([tag, count]) => ({ tag, count }))
		.sort((left, right) => right.count - left.count || left.tag.localeCompare(right.tag));
}

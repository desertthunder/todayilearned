import { existsSync } from 'node:fs';
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { githubTilLoader } from './loaders/gh';

const tilDirectory = new URL('../til/', import.meta.url);
const hasTilSubmodule = existsSync(new URL('.git', tilDirectory));
const tilNotePattern = '[0-9][0-9][0-9][0-9]/[0-9][0-9]/[0-9][0-9]/**/*.md';

const til = defineCollection({
	loader: hasTilSubmodule
		? glob({ base: tilDirectory, pattern: tilNotePattern })
		: githubTilLoader(),
	schema: z.object({
		title: z.string(),
		tags: z.array(z.string()).default([]),
		description: z.string().optional(),
	}),
});

export const collections = { til };

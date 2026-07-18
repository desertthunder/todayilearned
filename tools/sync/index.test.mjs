import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { STANDARD_SITE, STANDARD_SITE_PUBLICATION_URI, standardSiteDocumentRkey } from "../../src/lib/standard-site.mjs";
import { buildDocumentRecord, buildPublicationRecord, markdownToPlainText } from "./index.mjs";

test("publication and document record keys are stable TIDs", () => {
	const tidPattern = /^[234567abcdefghij][234567abcdefghijklmnopqrstuvwxyz]{12}$/;

	assert.equal(STANDARD_SITE.publicationRkey, "3mqwjcq76dcfn");
	assert.match(STANDARD_SITE.publicationRkey, tidPattern);
	assert.equal(standardSiteDocumentRkey("2026/07/15/pagerank"), "3mqpoxmzgswpz");
	assert.match(standardSiteDocumentRkey("2026/07/15/a note 📝"), tidPattern);
});

test("the publication verification file matches the configured AT-URI", async () => {
	const verificationUri = await readFile(
		new URL("../../public/.well-known/site.standard.publication", import.meta.url),
		"utf8",
	);
	assert.equal(verificationUri.trim(), STANDARD_SITE_PUBLICATION_URI);
});

test("publication record points at the canonical site", () => {
	assert.deepEqual(buildPublicationRecord(), {
		$type: "site.standard.publication",
		url: "https://til.desertthunder.dev",
		name: "Today I Learned",
		description: "A daily log and collection of things Owais has learned.",
		preferences: { showInDiscover: true },
	});
});

test("document records retain raw Markdown and provide plain text separately", () => {
	const rawMarkdown = `---
title: PageRank
tags:
  - search
---

# PageRank

Read [the reference](https://example.com).[^1]

[^1]: Source.
`;
	const body = "# PageRank\n\nRead [the reference](https://example.com).[^1]\n\n[^1]: Source.\n";
	const record = buildDocumentRecord({
		id: "2026/07/15/pagerank",
		rawMarkdown,
		body,
		frontmatter: { title: "PageRank", tags: ["search"] },
	});

	assert.equal(record.site, STANDARD_SITE_PUBLICATION_URI);
	assert.equal(record.path, "/notes/2026/07/15/pagerank/");
	assert.equal(record.publishedAt, "2026-07-15T00:00:00.000Z");
	assert.equal(record.content.text.markdown, rawMarkdown);
	assert.equal(record.content.$type, "at.markpub.markdown");
	assert.equal(record.textContent, "PageRank Read the reference. Source.");
	assert.deepEqual(record.tags, ["search"]);
});

test("Markdown conversion removes formatting without removing its words", () => {
	assert.equal(
		markdownToPlainText("## Heading\n\n- **Bold** and `code`\n\n> [Link](https://example.com)"),
		"Heading Bold and code Link",
	);
});

test("document records reject malformed frontmatter", () => {
	assert.throws(
		() =>
			buildDocumentRecord({
				id: "2026/07/15/bad",
				rawMarkdown: "body",
				body: "body",
				frontmatter: { title: "Bad", tags: "not-an-array" },
			}),
		/tags must be an array of strings/,
	);
});

test("document records reject impossible publication dates", () => {
	assert.throws(
		() =>
			buildDocumentRecord({
				id: "2026/02/31/impossible",
				rawMarkdown: "body",
				body: "body",
				frontmatter: { title: "Impossible" },
			}),
		/does not start with a valid publication date/,
	);
});

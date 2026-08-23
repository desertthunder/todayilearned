import assert from "node:assert/strict";
import test from "node:test";
import { markdownToHtml } from "satteri";
import { hasWikilinks, wikilinks, wikilinksToPlainText } from "./wikilinks.mjs";

const noteIds = ["2026/08/06/vectors", "2026/08/21/prop-test"];

function render(markdown) {
	return markdownToHtml(markdown, { mdastPlugins: [wikilinks(noteIds, "2026/08/23/example")] }).html;
}

test("wikilinks resolve unique note filenames", () => {
	assert.equal(render("Read [[vectors]] next."), '<p>Read <a href="/notes/2026/08/06/vectors/">vectors</a> next.</p>\n');
});

test("wikilinks support labels, full paths, and optional Markdown extensions", () => {
	assert.equal(
		render("Read [[vectors|the vector note]] and [[2026/08/21/prop-test.md]]."),
		'<p>Read <a href="/notes/2026/08/06/vectors/">the vector note</a> and <a href="/notes/2026/08/21/prop-test/">prop-test</a>.</p>\n',
	);
});

test("wikilinks remain literal in code and existing Markdown links", () => {
	assert.equal(
		render("`[[vectors]]` and [[[vectors]]](https://example.com)"),
		'<p><code>[[vectors]]</code> and <a href="https://example.com">[[vectors]]</a></p>\n',
	);
});

test("missing and ambiguous wikilinks fail with their source note", () => {
	assert.throws(() => render("[[missing]]"), /\[\[missing\]\] in 2026\/08\/23\/example does not match a note/);
	assert.throws(
		() =>
			markdownToHtml("[[vectors]]", {
				mdastPlugins: [wikilinks([...noteIds, "2026/08/07/vectors"], "2026/08/23/example")],
			}),
		/\[\[vectors\]\] in 2026\/08\/23\/example is ambiguous/,
	);
});

test("heading and block references report that they are unsupported", () => {
	assert.throws(() => render("[[vectors#Meaning]]"), /heading or block reference/);
	assert.throws(() => render("[[vectors#\^example]]"), /heading or block reference/);
});

test("plain text uses the visible wikilink label", () => {
	assert.equal(
		wikilinksToPlainText("See [[vectors]] and [[prop-test|property-based testing]]."),
		"See vectors and property-based testing.",
	);
	assert.equal(hasWikilinks("See [[vectors]]."), true);
	assert.equal(hasWikilinks("See [vectors](/notes/vectors/)."), false);
});

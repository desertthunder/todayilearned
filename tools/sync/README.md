# Standard.site sync

This directory publishes the TIL site and its notes to my ATProtocol repo.

It creates one `site.standard.publication` record for the site and one
`site.standard.document` record for every dated Markdown file in `til/`.

The website remains the canonical copy. Each document points back to its public URL,
while the website points to the corresponding AT-URI through its HTML `<link>` elements
and `/.well-known/site.standard.publication` file.

## Record contents

The sync uses stable TID record keys, as required by the standard.site Lexicons.

Running it again updates a changed record in place and skips records whose values have
not changed.

Each document contains:

- its title, tags, publication date, and site path;
- the complete source file, including YAML frontmatter, as an `at.markpub.markdown`
  object in the Standard.site `content` union;
- a plain-text copy of the note body in `textContent`, as required by the Standard.site
  lexicon.

The script only creates or updates its known publication and document records. It does
not delete records when a local note disappears.

## Authentication

AT Protocol app passwords can create repository records without exposing the account's
primary password. Create one in the Bluesky account settings for `desertthunder.dev`,
then expose it to the command as `ATPROTO_APP_PASSWORD`.

For a local run, either export the value in the shell or copy the root example file and
fill in the password:

```sh
cp .env.example .env
```

The script resolves the PDS from the configured DID on each run. `ATPROTO_SERVICE` can
override the discovered PDS URL, and `ATPROTO_HANDLE` can override the login identifier.
Neither override is needed for the configured account.

Never commit the app password. Revoke it in Bluesky if it is exposed.

## Commands

The sync reads the local `til/` checkout. See the root README's content-source section
if that directory has not been populated.

Validate the notes and inspect their deterministic AT-URIs without authenticating or
writing records:

```sh
pnpm sync --dry-run
```

Sync records without deploying the website:

```sh
pnpm sync
```

Build the site, deploy `dist/` with Wrangler, and then sync the PDS records:

```sh
pnpm deploy
```

The PDS sync runs after Cloudflare accepts the Pages deployment. If the sync fails,
rerun `pnpm sync`; all record writes are idempotent.

## Verification

After the first successful deployment and sync, check these endpoints:

```text
https://til.desertthunder.dev/.well-known/site.standard.publication
https://til.desertthunder.dev/notes/2026/07/15/pagerank/
```

The first response should be the publication AT-URI. The note page source should contain
both `site.standard.publication` and `site.standard.document` link elements.

The script prints every document AT-URI after a sync so the records can also be
inspected with an AT Protocol record browser.

## References

- [Standard.site quick start](https://standard.site/docs/quick-start/)
- [Standard.site verification](https://standard.site/docs/verification/)
- [Standard.site document lexicon](https://standard.site/docs/lexicons/document/)
- [Markpub.at Markdown lexicon](https://markpub.at/)
- [AT Protocol password authentication](https://atproto.com/guides/sdk-auth)
- [AT Protocol TID specification](https://atproto.com/specs/tid)

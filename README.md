# Today I Learned

A small website for [TIL notes](https://github.com/desertthunder/til)

## Content source

The preferred content source is the `til` Git submodule. Initialize it after cloning:

```sh
git submodule update --init --recursive
```

If the submodule is unavailable, the build retrieves dated Markdown notes from the public GitHub API. That fallback requires internet access at build time.

## Credits

Inspired by [jake lazaroff](https://til.jakelazaroff.com/)

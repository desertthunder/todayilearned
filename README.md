# Today I Learned

A small website for [TIL notes](https://github.com/desertthunder/til)

## Submodule setup

The content repository is meant to be tracked as a Git submodule at `til`:

```sh
git submodule add https://github.com/desertthunder/til.git til
git submodule update --init --recursive
```

Until the submodule is initialized, the site builds as an empty archive.

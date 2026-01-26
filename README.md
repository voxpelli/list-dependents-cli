# list-dependents-cli

Lists all dependents of a project, using npm and [`ecosyste.ms`](https://ecosyste.ms/).

CLI-companion to [`list-dependents`](https://github.com/voxpelli/list-dependents), use it directly if you want to use it programmatically.

[![npm version](https://img.shields.io/npm/v/list-dependents-cli.svg?style=flat)](https://www.npmjs.com/package/list-dependents-cli)
[![npm downloads](https://img.shields.io/npm/dm/list-dependents-cli.svg?style=flat)](https://www.npmjs.com/package/list-dependents-cli)
[![neostandard javascript style](https://img.shields.io/badge/code_style-neostandard-7fffff?style=flat&labelColor=ff80ff)](https://github.com/neostandard/neostandard)
[![Module type: ESM](https://img.shields.io/badge/module%20type-esm-brightgreen)](https://github.com/voxpelli/badges-cjs-esm)
[![Types in JS](https://img.shields.io/badge/types_in_js-yes-brightgreen)](https://github.com/voxpelli/types-in-js)
[![Follow @voxpelli@mastodon.social](https://img.shields.io/mastodon/follow/109247025527949675?domain=https%3A%2F%2Fmastodon.social&style=social)](https://mastodon.social/@voxpelli)

## Install

### Globally

```sh
npm install -g list-dependents-cli
```

### Locally

```sh
npm install -D list-dependents-cli
```

## Usage

```sh
list-dependents --help
list-dependents list --help
list-dependents list installed-check > dependents.ndjson
```

## Commands

* `list-dependents filter` – narrows down an existing list of modules
* `list-dependents format` – pretty prints a list to the terminal or as markdown
* `list-dependents list` – creates or updates list of dependent modules
* `list-dependents refresh` – refreshes the data within a list of modules

### Error Recovery

When fetching large lists of dependents, errors (such as HTTP 500 errors from the API) can occur. The `list` command automatically saves progress to protect against data loss:

```sh
# If an error occurs during fetching:
$ list-dependents list -o mocha.ndjson mocha
# ... fetches data for several minutes
# HTTP 500 error occurs
# Partial data saved to: mocha.ndjson.partial
# To resume, run: list-dependents list -i mocha.ndjson.partial -o mocha.ndjson mocha

# Resume from where you left off:
$ list-dependents list -i mocha.ndjson.partial -o mocha.ndjson mocha
# Continues from partial data and completes the fetch
```

This feature works when outputting to a file (`-o` or `-n` flags) but not when outputting to stdout.

## Similar modules

* [`list-dependents`](https://github.com/voxpelli/list-dependents) – module providing the core functionality of this module

<!-- ## See also

* [Announcement blog post](#)
* [Announcement tweet](#) -->

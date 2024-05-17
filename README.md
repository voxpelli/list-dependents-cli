# list-dependents-cli

Lists all dependents of a project, using npm and [`ecosyste.ms`](https://ecosyste.ms/).

CLI-companion to [`list-dependents`](https://github.com/voxpelli/list-dependents), use it directly if you want to use it programmatically.

[![npm version](https://img.shields.io/npm/v/list-dependents-cli.svg?style=flat)](https://www.npmjs.com/package/list-dependents-cli)
[![npm downloads](https://img.shields.io/npm/dm/list-dependents-cli.svg?style=flat)](https://www.npmjs.com/package/list-dependents-cli)
[![js-semistandard-style](https://img.shields.io/badge/code%20style-semistandard-brightgreen.svg)](https://github.com/voxpelli/eslint-config)
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
* `list-dependents list` – creates or updates list of dependent modules
* `list-dependents refresh` – refreshes the data within a list of modules

## Similar modules

* [`list-dependents`](https://github.com/voxpelli/list-dependents) – module providing the core functionality of this module

<!-- ## See also

* [Announcement blog post](#)
* [Announcement tweet](#) -->

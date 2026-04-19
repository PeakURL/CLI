# PeakURL CLI

`peakurl` is the official command-line interface for PeakURL.

It gives you a fast way to create, inspect, list, and remove short links from the terminal while keeping default output readable for humans and optional `--json` output friendly for scripts.

## Install

Requirements: Node.js 20 or later.

```bash
npm install -g peakurl
```

## Quick Start

```bash
peakurl login --base-url https://peakurl.org --api-key 0123456789abcdef0123456789abcdef0123456789abcdef
peakurl create https://example.com/articles/launch --alias launch --title "Launch Post"
peakurl list
peakurl whoami
```

## Authentication

The CLI uses PeakURL bearer API keys and validates them with `GET /api/v1/users/me` before storing them.

- `--base-url` accepts either the site root such as `https://peakurl.org` or the API base URL such as `https://peakurl.org/api/v1`
- API keys are opaque 48-character hex tokens
- credentials are stored in the standard per-user config location for `peakurl`

For CI and automation, you can also use environment variables:

```bash
export PEAKURL_BASE_URL=https://peakurl.org
export PEAKURL_API_KEY=0123456789abcdef0123456789abcdef0123456789abcdef
```

## Commands

| Command                        | Description                                 |
| ------------------------------ | ------------------------------------------- |
| `peakurl login`                | Validate and save your PeakURL credentials. |
| `peakurl whoami`               | Show the current authenticated account.     |
| `peakurl create <url>`         | Create a new short link.                    |
| `peakurl list`                 | List links in your account.                 |
| `peakurl get <id-or-alias>`    | Fetch a single link by ID or alias.         |
| `peakurl delete <id-or-alias>` | Delete a link by ID or alias.               |

## Common Flags

- `--json` prints machine-readable JSON output
- `--quiet` minimizes output for scripts

## Examples

Create a short link:

```bash
peakurl create https://example.com --alias example --title "Example"
```

List links as JSON:

```bash
peakurl list --limit 10 --json
```

Inspect a link:

```bash
peakurl get example
```

Delete a link:

```bash
peakurl delete example
```

When `delete` receives an alias or short code, the CLI resolves it to the underlying PeakURL row ID before deleting it.

## Links

- Website: https://peakurl.org/
- API docs: https://peakurl.org/docs/api
- npm package: https://www.npmjs.com/package/peakurl
- Issues: https://github.com/PeakURL/PeakURL-CLI/issues

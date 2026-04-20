# PeakURL CLI

The official command-line interface for PeakURL.

Use `peakurl` to create short links, inspect existing links, and manage your PeakURL account from the terminal.

## Install

Node.js 20 or later is required.

```bash
npm install -g peakurl
```

## Quick Start

Sign in with your PeakURL API key:

```bash
peakurl login \
    --base-url https://peakurl.org \
    --api-key 0123456789abcdef0123456789abcdef0123456789abcdef
```

Create and review a short link:

```bash
peakurl create \
    https://example.com/articles/launch \
    --alias launch \
    --title "Launch Post"

peakurl list
peakurl whoami
```

## Authentication

The CLI uses PeakURL bearer API keys and validates them against `GET /api/v1/users/me` before saving credentials.

- `--base-url` accepts either the site root, such as `https://peakurl.org`, or the API base URL, such as `https://peakurl.org/api/v1`
- API keys are opaque 48-character hex tokens
- Credentials are stored in the standard per-user config location for `peakurl`

For CI or automation, you can also authenticate with environment variables:

```bash
export PEAKURL_BASE_URL=https://peakurl.org
export PEAKURL_API_KEY=0123456789abcdef0123456789abcdef0123456789abcdef
```

## Commands

| Command                        | Description                                                |
| ------------------------------ | ---------------------------------------------------------- |
| `peakurl login`                | Validate and save your PeakURL credentials.                |
| `peakurl whoami`               | Show the current authenticated account.                    |
| `peakurl create <url>`         | Create a new short link.                                   |
| `peakurl list`                 | List links in your account.                                |
| `peakurl get <id-or-alias>`    | Fetch a single link by ID or alias.                        |
| `peakurl delete <id-or-alias>` | Delete a link by ID or alias.                              |
| `peakurl update`               | Show the latest available CLI version and install command. |

## Examples

Create a short link:

```bash
peakurl create \
    https://example.com \
    --alias example \
    --title "Example"
```

List links as JSON:

```bash
peakurl list \
    --limit 10 \
    --json
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

Check the latest available CLI version:

```bash
peakurl update --check
```

Show the recommended install command:

```bash
peakurl update
```

Install the latest version manually:

```bash
npm install -g peakurl@latest
```

Disable update notices in the current shell:

```bash
export PEAKURL_DISABLE_UPDATE_CHECK=1
```

## Output

- Human-readable output is the default
- `--json` prints machine-readable JSON where supported
- `--quiet` minimizes output for scripts

## Links

- Website: <https://peakurl.org/>
- API docs: <https://peakurl.org/docs/api>
- npm package: <https://www.npmjs.com/package/peakurl>
- Issues: <https://github.com/PeakURL/PeakURL-CLI/issues>

# PeakURL - Command-Line Interface

![PeakURL CLI](https://github.com/PeakURL/PeakURL/blob/main/.github/images/peakurl-cli.jpg?raw=1)

The official command-line interface for PeakURL.

Use `peakurl` to create short links, inspect existing links, and manage your PeakURL account from the terminal.

Learn more in the full CLI docs: <https://peakurl.org/docs/cli>

## Install

Node.js 20 or later is required.

```bash
npm i -g peakurl
```

## Quick Start

Sign in with your PeakURL API key:

```bash
peakurl login \
    --base-url https://example.com/api/v1 \
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
peakurl status
peakurl logout
```

## Authentication

The CLI uses PeakURL bearer API keys and validates them against `GET /api/v1/users/me` before saving credentials.

- `--base-url` expects the explicit API base URL, such as `https://example.com/api/v1`
- API keys are opaque 48-character hex tokens
- Credentials are stored in the standard per-user config location for `peakurl`
- `peakurl logout` removes the saved config file, but shell environment variables still override auth if they are set

For CI or automation, you can also authenticate with environment variables:

```bash
export PEAKURL_BASE_URL=https://example.com/api/v1
export PEAKURL_API_KEY=0123456789abcdef0123456789abcdef0123456789abcdef
```

## Commands

| Command                        | Description                                                 |
| ------------------------------ | ----------------------------------------------------------- |
| `peakurl login`                | Validate and save your PeakURL credentials.                 |
| `peakurl whoami`               | Show the current authenticated account.                     |
| `peakurl logout`               | Remove saved local CLI credentials.                         |
| `peakurl status`               | Show the current system status snapshot for the site.       |
| `peakurl create <url>`         | Create a new short link.                                    |
| `peakurl import <file>`        | Import links from a local CSV, JSON, or XML file.           |
| `peakurl export`               | Export accessible links as CSV, JSON, or XML.               |
| `peakurl list`                 | List links in your account.                                 |
| `peakurl get <id-or-alias>`    | Fetch a single link by ID or alias.                         |
| `peakurl delete <id-or-alias>` | Delete a link by ID or alias.                               |
| `peakurl webhook <subcommand>` | List, create, delete, and inspect supported webhook events. |
| `peakurl update`               | Show the latest available CLI version and install command.  |

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

Log out from saved local credentials:

```bash
peakurl logout
```

Show the current system status:

```bash
peakurl status
```

The status command calls `GET /api/v1/system/status` and prints summary, checks, plus site, server, database, storage, mail, location, and data tables when that information is available.

This route typically requires admin access on the PeakURL install.

If you need the raw payload:

```bash
peakurl status --json
```

Delete a link:

```bash
peakurl delete example
```

When `delete` receives an alias or short code, the CLI resolves it to the underlying PeakURL row ID before deleting it.

Import links from a local file:

```bash
peakurl import ./links.csv
```

The import command accepts dashboard-style CSV, JSON, and XML files, normalizes them locally, and sends the API-native `urls` array to `POST /api/v1/urls/bulk`.

Export links as CSV:

```bash
peakurl export --format csv
```

Write the exported JSON snapshot to stdout:

```bash
peakurl export --format json --stdout
```

List configured webhooks:

```bash
peakurl webhook list
```

Create a webhook:

```bash
peakurl webhook create \
    https://example.com/api/webhooks/peakurl \
    --event link.clicked \
    --event link.created
```

The create command prints the signing secret once, so save it before closing the terminal output.

List supported webhook events:

```bash
peakurl webhook events
```

Delete a webhook:

```bash
peakurl webhook delete webhook_123
```

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
npm i -g peakurl@latest
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
- CLI docs: <https://peakurl.org/docs/cli>
- API docs: <https://peakurl.org/docs/api>
- npm package: <https://www.npmjs.com/package/peakurl>
- Issues: <https://github.com/PeakURL/CLI/issues>

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

The CLI authenticates with PeakURL bearer API keys and verifies credentials with your instance before saving them locally.

- `--base-url` expects the explicit API base URL, such as `https://example.com/api/v1`
- API keys are 48-character hexadecimal tokens generated from your PeakURL dashboard
- Credentials are stored in the standard per-user configuration directory for `peakurl`
- `peakurl logout` removes the saved configuration, while environment variables take precedence when set

For CI or automation, you can also authenticate with environment variables:

```bash
export PEAKURL_BASE_URL=https://example.com/api/v1
export PEAKURL_API_KEY=0123456789abcdef0123456789abcdef0123456789abcdef
```

## Commands

| Command                           | Description                                                 |
| --------------------------------- | ----------------------------------------------------------- |
| `peakurl login`                   | Validate and save your PeakURL credentials.                 |
| `peakurl whoami`                  | Show the current authenticated account.                     |
| `peakurl logout`                  | Remove saved local CLI credentials.                         |
| `peakurl status`                  | Show the current system status snapshot for the site.       |
| `peakurl core download`           | Download and extract the latest PeakURL core package.       |
| `peakurl create <url>`            | Create a new short link.                                    |
| `peakurl import <file>`           | Import links from a local CSV, JSON, or XML file.           |
| `peakurl export`                  | Export accessible links as CSV, JSON, or XML.               |
| `peakurl list`                    | List links in your account.                                 |
| `peakurl get <id-or-alias>`       | Fetch a single link by ID or alias.                         |
| `peakurl delete [id-or-alias...]` | Delete links by ID or alias, in bulk, or clear all links.   |
| `peakurl activity <subcommand>`   | View audit logs, delete activity records, or clear history. |
| `peakurl webhook <subcommand>`    | List, create, delete, and inspect supported webhook events. |
| `peakurl update`                  | Show the latest available CLI version and install command.  |

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

Displays comprehensive system diagnostics, including health checks, site configuration, server metrics, database information, storage usage, mail settings, location analytics, cache diagnostics, and data counts.

This command typically requires an administrator account on the PeakURL instance.

To output the complete diagnostics as JSON:

```bash
peakurl status --json
```

Download, verify, and extract the current PeakURL core package into the current directory:

```bash
peakurl core download
```

The command checks the published release checksum before extracting files. If the current directory already contains release-managed files, the command stops by default.

Use `--force` only when you intentionally want those files replaced:

```bash
peakurl core download --force
```

Delete one or more links, or clear all links:

```bash
# Delete a single link
peakurl delete example

# Bulk delete multiple links
peakurl delete docs pricing blog launch

# Bulk delete with comma-separated IDs
peakurl delete --ids url_1,url_2,url_3

# Empty all short links in trash
peakurl delete --empty-trash

# Delete all accessible short links
peakurl delete --all
```

When `delete` receives aliases or short codes, the CLI resolves them to the underlying PeakURL row IDs before deleting them.

List, inspect, and delete audit log activity:

```bash
# List recent activity records
peakurl activity list

# Filter and paginate activity logs
peakurl activity list --search delete --limit 25 --page 1

# Delete specific activity log entries
peakurl activity delete act_123 act_456

# Clear all activity log history
peakurl activity clear
```

Import links from a local file:

```bash
peakurl import ./links.csv
```

The import command accepts CSV, JSON, and XML files, validates and normalizes the link records locally, and imports them in bulk.

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

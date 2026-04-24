#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { Command, CommanderError, InvalidArgumentError } from "commander";
import {
    checkUpdate,
    downloadCore,
    createWebhook,
    createLink,
    deleteLink,
    deleteWebhook,
    exportLinks,
    getLink,
    importLinks,
    listLinks,
    listWebhookEvents,
    listWebhooks,
    login,
    logout,
    status,
    whoami,
} from "./commands/index.js";
import {
    authRows,
    checkUpdates,
    ensureCliError,
    errorLine,
    formatTable,
    parseWebhookEvents,
    writeStderr,
} from "./lib/index.js";

/**
 * Builds a Commander parser for positive integer flags such as `--page`.
 *
 * @param label Human-readable option name for validation messages.
 * @returns Parser function passed directly to Commander.
 */
function parseNumber(label: string) {
    return (value: string): number => {
        const parsed = Number.parseInt(value, 10);

        if (!Number.isInteger(parsed) || parsed <= 0) {
            throw new InvalidArgumentError(
                `${label} must be a positive integer.`,
            );
        }

        return parsed;
    };
}

/**
 * Appends a compact examples section to one command's help output.
 *
 * @param command Commander command to extend.
 * @param lines Example lines shown after the generated help text.
 * @returns The same command instance for chaining.
 */
function addExamples(command: Command, lines: string[]): Command {
    return command.addHelpText(
        "after",
        `\nExamples:\n${lines.map((line) => `  ${line}`).join("\n")}\n\nDocumentation:\n  https://peakurl.org/docs/cli`,
    );
}

/**
 * Returns the CLI version from `package.json` so help/version output stays aligned
 * with the package that will actually be published.
 *
 * @returns Version string exposed by the package manifest.
 */
async function getCliVersion(): Promise<string> {
    const packageJson = new URL("../package.json", import.meta.url);
    const content = await readFile(packageJson, "utf8");
    const parsed = JSON.parse(content) as { version?: string };
    return parsed.version || "0.0.0";
}

/**
 * Returns the command path currently being invoked for auth retry guidance.
 *
 * Nested commands such as `peakurl webhook list` should point back to the full
 * resource path, while top-level commands should not include their arguments.
 *
 * @returns Command path segment without flags or positional values.
 */
function getRetryCommandName(argv: string[]): string | undefined {
    const first = argv[2]?.trim();

    if (!first || first.startsWith("-")) {
        return undefined;
    }

    if (first === "webhook" || first === "webhooks") {
        const second = argv[3]?.trim();
        if (second && !second.startsWith("-")) {
            return `${first} ${second}`;
        }
    }

    return first;
}

/**
 * Registers the PeakURL command surface and executes the requested command.
 *
 * @returns Promise that resolves when the command finishes or exits the process
 * via Commander / CLI error handling.
 */
async function main(): Promise<void> {
    const program = new Command();
    const version = await getCliVersion();

    // Keep command registration centralized here so the shipped CLI surface is
    // easy to audit against the backend routes and release notes.
    program
        .name("peakurl")
        .description("Manage your PeakURL site from the terminal.")
        .helpOption("-h, --help", "Show help")
        .helpCommand("help [command]", "Show help for a command")
        .version(version, "-V, --version", "Show CLI version")
        .showHelpAfterError()
        .showSuggestionAfterError()
        .addHelpText(
            "after",
            `
Get Started:
  peakurl login --base-url https://example.com/api/v1 --api-key YOUR_API_KEY
  peakurl whoami
  peakurl create https://example.com/docs --alias docs

Common Commands:
  peakurl status
  peakurl core download
  peakurl list --limit 10
  peakurl import ./links.csv
  peakurl export --format csv
  peakurl webhook list
  peakurl update --check

Documentation:
  https://peakurl.org/docs/cli

Run 'peakurl <command> --help' for command-specific flags and examples.`,
        )
        .exitOverride();

    // Update checks run before command actions so users get one compact notice
    // without every command needing to repeat the same version-check logic.
    program.hook("preAction", async (_command, actionCommand) => {
        const options = actionCommand.optsWithGlobals() as
            | { json?: boolean; quiet?: boolean }
            | undefined;

        await checkUpdates({
            currentVersion: version,
            commandName: actionCommand.name(),
            options,
            env: process.env,
        });
    });

    addExamples(
        program
            .command("login")
            .summary("Save API credentials")
            .description(
                "Save PeakURL credentials after verifying them with GET /users/me.",
            )
            .helpOption("-h, --help", "Show help")
            .option(
                "--base-url <url>",
                "PeakURL API base URL, for example https://example.com/api/v1",
            )
            .option("--api-key <token>", "PeakURL API key to store")
            .option("--json", "Print machine-readable output")
            .option("--quiet", "Suppress success output")
            .action(login),
        [
            "peakurl login --base-url https://example.com/api/v1 --api-key YOUR_API_KEY",
            "peakurl login --json",
        ],
    );

    addExamples(
        program
            .command("whoami")
            .summary("Show the current account")
            .description("Show the current authenticated PeakURL user.")
            .helpOption("-h, --help", "Show help")
            .option("--json", "Print machine-readable output")
            .option("--quiet", "Print a minimal identity value")
            .action(whoami),
        ["peakurl whoami", "peakurl whoami --json"],
    );

    addExamples(
        program
            .command("logout")
            .summary("Remove saved credentials")
            .description("Remove saved PeakURL credentials from this device.")
            .helpOption("-h, --help", "Show help")
            .option("--json", "Print machine-readable output")
            .option("--quiet", "Suppress success output")
            .action(logout),
        ["peakurl logout", "peakurl logout --json"],
    );

    addExamples(
        program
            .command("status")
            .summary("Show site system status")
            .description("Show the current PeakURL system status snapshot.")
            .helpOption("-h, --help", "Show help")
            .option("--json", "Print machine-readable output")
            .option("--quiet", "Print only the overall health value")
            .action(status),
        ["peakurl status", "peakurl status --json", "peakurl status --quiet"],
    );

    const core = program
        .command("core")
        .summary("Manage PeakURL core files")
        .helpOption("-h, --help", "Show help")
        .description("Manage PeakURL core package downloads.");

    addExamples(core, [
        "peakurl core download",
        "peakurl core download --force",
    ]);

    addExamples(
        core
            .command("download")
            .summary("Download the core package")
            .description(
                "Download the latest PeakURL core package, verify its checksum, and extract it into the current directory.",
            )
            .helpOption("-h, --help", "Show help")
            .option("--force", "Overwrite existing files when needed")
            .option("--json", "Print machine-readable output")
            .option("--quiet", "Print only the extracted path")
            .action(downloadCore),
        ["peakurl core download", "peakurl core download --force --json"],
    );

    addExamples(
        program
            .command("create")
            .summary("Create a short link")
            .description("Create a PeakURL short link.")
            .helpOption("-h, --help", "Show help")
            .argument("<url>", "Destination URL to shorten")
            .option("--alias <alias>", "Custom alias for the short link")
            .option("--title <title>", "Title to store with the short link")
            .option("--password <password>", "Password-protect the short link")
            .option(
                "--status <status>",
                "Link status, for example active or paused",
            )
            .option(
                "--expires-at <iso>",
                "Expiration timestamp in ISO-8601 format",
            )
            .option("--utm-source <value>", "UTM source")
            .option("--utm-medium <value>", "UTM medium")
            .option("--utm-campaign <value>", "UTM campaign")
            .option("--utm-term <value>", "UTM term")
            .option("--utm-content <value>", "UTM content")
            .option("--json", "Print machine-readable output")
            .option("--quiet", "Print only the created short URL")
            .action(createLink),
        [
            "peakurl create https://example.com/docs --alias docs",
            'peakurl create https://example.com/launch --title "Launch Page"',
            "peakurl create https://example.com --json",
        ],
    );

    addExamples(
        program
            .command("import")
            .summary("Import links from a file")
            .description(
                "Import multiple short links from a local CSV, JSON, or XML file.",
            )
            .helpOption("-h, --help", "Show help")
            .argument("<file>", "Path to the import file")
            .option("--format <format>", "File format: csv, json, or xml")
            .option("--json", "Print machine-readable output")
            .option("--quiet", "Print only the created short URLs")
            .action(importLinks),
        ["peakurl import ./links.csv", "peakurl import ./links.xml --json"],
    );

    addExamples(
        program
            .command("export")
            .summary("Export links to a file")
            .description(
                "Export accessible links as a local CSV, JSON, or XML file.",
            )
            .helpOption("-h, --help", "Show help")
            .option("--format <format>", "File format: csv, json, or xml")
            .option("--output <path>", "Write the export to a specific file")
            .option("--stdout", "Write the raw export content to stdout")
            .option("--search <query>", "Search term")
            .option("--sort-by <field>", "Sort field")
            .option(
                "--sort-order <order>",
                "Sort order, for example asc or desc",
            )
            .option("--quiet", "Print only the saved export path")
            .action(exportLinks),
        [
            "peakurl export --format csv",
            "peakurl export --format json --stdout",
            "peakurl export --format xml --output ./backups/links.xml",
        ],
    );

    addExamples(
        program
            .command("list")
            .summary("List short links")
            .description("List PeakURL short links.")
            .helpOption("-h, --help", "Show help")
            .option("--page <number>", "Page number", parseNumber("page"))
            .option("--limit <number>", "Page size", parseNumber("limit"))
            .option("--search <query>", "Search term")
            .option("--sort-by <field>", "Sort field")
            .option(
                "--sort-order <order>",
                "Sort order, for example asc or desc",
            )
            .option("--json", "Print machine-readable output")
            .option("--quiet", "Print a minimal per-link value")
            .action(listLinks),
        [
            "peakurl list",
            "peakurl list --limit 25 --page 1",
            "peakurl list --search launch --json",
        ],
    );

    addExamples(
        program
            .command("get")
            .summary("Show one short link")
            .description("Fetch a single PeakURL short link by id or alias.")
            .helpOption("-h, --help", "Show help")
            .argument("<id-or-alias>", "Link identifier or alias")
            .option("--json", "Print machine-readable output")
            .option("--quiet", "Print only the short URL")
            .action(getLink),
        ["peakurl get docs", "peakurl get url_123 --json"],
    );

    addExamples(
        program
            .command("delete")
            .summary("Delete one short link")
            .description("Delete a PeakURL short link by id or alias.")
            .helpOption("-h, --help", "Show help")
            .argument("<id-or-alias>", "Link identifier or alias")
            .option("--json", "Print machine-readable output")
            .option("--quiet", "Suppress success output")
            .action(deleteLink),
        ["peakurl delete docs", "peakurl delete url_123 --quiet"],
    );

    addExamples(
        program
            .command("update")
            .summary("Check for CLI updates")
            .description(
                "Check for a newer CLI version and print the npm command to install it.",
            )
            .helpOption("-h, --help", "Show help")
            .option(
                "--check",
                "Alias for checking update status without changing anything",
            )
            .option("--json", "Print machine-readable output")
            .option("--quiet", "Print minimal output")
            .action((options) => checkUpdate(options, version)),
        ["peakurl update", "peakurl update --check", "peakurl update --json"],
    );

    const webhook = program
        .command("webhook")
        .alias("webhooks")
        .summary("Manage webhooks")
        .helpOption("-h, --help", "Show help")
        .description("Manage outbound webhook integrations.");

    addExamples(webhook, [
        "peakurl webhook list",
        "peakurl webhook create https://example.com/api/webhooks/peakurl --event link.clicked",
        "peakurl webhook events",
    ]);

    addExamples(
        webhook
            .command("list")
            .summary("List webhooks")
            .description("List outbound webhooks.")
            .helpOption("-h, --help", "Show help")
            .option("--json", "Print machine-readable output")
            .option("--quiet", "Print minimal webhook identifiers")
            .action(listWebhooks),
        ["peakurl webhook list", "peakurl webhook list --json"],
    );

    addExamples(
        webhook
            .command("create")
            .summary("Create a webhook")
            .description("Create an outbound webhook.")
            .helpOption("-h, --help", "Show help")
            .argument("<url>", "Webhook endpoint URL")
            .option(
                "--event <event>",
                "Webhook event id, for example link.clicked",
                parseWebhookEvents,
            )
            .option("--json", "Print machine-readable output")
            .option("--quiet", "Print only the created webhook ID")
            .action(createWebhook),
        [
            "peakurl webhook create https://example.com/api/webhooks/peakurl --event link.clicked",
            "peakurl webhook create https://example.com/api/webhooks/peakurl --event link.clicked --event link.created",
        ],
    );

    addExamples(
        webhook
            .command("delete")
            .summary("Delete a webhook")
            .description("Delete an outbound webhook by id.")
            .helpOption("-h, --help", "Show help")
            .argument("<id>", "Webhook identifier")
            .option("--json", "Print machine-readable output")
            .option("--quiet", "Suppress success output")
            .action(deleteWebhook),
        ["peakurl webhook delete webhook_123"],
    );

    addExamples(
        webhook
            .command("events")
            .summary("List supported events")
            .description("List the webhook events supported by the CLI.")
            .helpOption("-h, --help", "Show help")
            .option("--json", "Print machine-readable output")
            .option("--quiet", "Print only event ids")
            .action(listWebhookEvents),
        ["peakurl webhook events", "peakurl webhook events --json"],
    );

    try {
        await program.parseAsync(process.argv);
    } catch (error) {
        // Commander throws for expected control-flow exits such as validation
        // errors. Everything else is normalized into our own CLI error shape.
        if (error instanceof CommanderError) {
            process.exit(error.exitCode);
        }

        const cliError = ensureCliError(error);

        if (cliError.kind === "auth_required") {
            const commandName = getRetryCommandName(process.argv);
            writeStderr(errorLine("Authentication required."));
            writeStderr("PeakURL could not find credentials for this command.");
            writeStderr(
                "Use one of the first two steps below, then run the last command.",
            );
            writeStderr(
                formatTable(
                    ["Step", "Command", "Notes"],
                    authRows(commandName),
                    "stderr",
                ),
            );
        } else {
            writeStderr(errorLine(cliError.message));
        }

        process.exit(cliError.exitCode);
    }
}

void main();

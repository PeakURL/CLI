#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { Command, CommanderError, InvalidArgumentError } from "commander";
import {
    checkUpdate,
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
    formatTable,
    checkUpdates,
    ensureCliError,
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
        .description("PeakURL command-line interface")
        .version(version)
        .showHelpAfterError()
        .showSuggestionAfterError()
        .addHelpText(
            "after",
            `
Examples:
  peakurl login --base-url https://example.com/api/v1 --api-key 0123456789abcdef0123456789abcdef0123456789abcdef
  peakurl whoami --json
  peakurl logout
  peakurl status
  peakurl create https://example.com --alias example
  peakurl import ./links.csv
  peakurl export --format csv
  peakurl list --limit 10
  peakurl webhook list
  peakurl webhook create https://example.com/api/webhooks/peakurl --event link.clicked
  peakurl update --check
  peakurl get example
  peakurl delete example --quiet`,
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

    program
        .command("login")
        .description(
            "Save PeakURL credentials after verifying them with GET /users/me.",
        )
        .option(
            "--base-url <url>",
            "PeakURL API base URL, for example https://example.com/api/v1",
        )
        .option("--api-key <token>", "PeakURL API key to store")
        .option("--json", "Print machine-readable output")
        .option("--quiet", "Suppress success output")
        .action(login);

    program
        .command("whoami")
        .description("Show the current authenticated PeakURL user.")
        .option("--json", "Print machine-readable output")
        .option("--quiet", "Print a minimal identity value")
        .action(whoami);

    program
        .command("logout")
        .description("Remove saved PeakURL credentials from this device.")
        .option("--json", "Print machine-readable output")
        .option("--quiet", "Suppress success output")
        .action(logout);

    program
        .command("status")
        .description("Show the current PeakURL system status snapshot.")
        .option("--json", "Print machine-readable output")
        .option("--quiet", "Print only the overall health value")
        .action(status);

    program
        .command("create")
        .description("Create a PeakURL short link.")
        .argument("<url>", "Destination URL to shorten")
        .option("--alias <alias>", "Custom alias for the short link")
        .option("--title <title>", "Title to store with the short link")
        .option("--password <password>", "Password-protect the short link")
        .option(
            "--status <status>",
            "Link status, for example active or paused",
        )
        .option("--expires-at <iso>", "Expiration timestamp in ISO-8601 format")
        .option("--utm-source <value>", "UTM source")
        .option("--utm-medium <value>", "UTM medium")
        .option("--utm-campaign <value>", "UTM campaign")
        .option("--utm-term <value>", "UTM term")
        .option("--utm-content <value>", "UTM content")
        .option("--json", "Print machine-readable output")
        .option("--quiet", "Print only the created short URL")
        .action(createLink);

    program
        .command("import")
        .description(
            "Import multiple short links from a local CSV, JSON, or XML file.",
        )
        .argument("<file>", "Path to the import file")
        .option("--format <format>", "File format: csv, json, or xml")
        .option("--json", "Print machine-readable output")
        .option("--quiet", "Print only the created short URLs")
        .action(importLinks);

    program
        .command("export")
        .description(
            "Export accessible links as a local CSV, JSON, or XML file.",
        )
        .option("--format <format>", "File format: csv, json, or xml")
        .option("--output <path>", "Write the export to a specific file")
        .option("--stdout", "Write the raw export content to stdout")
        .option("--search <query>", "Search term")
        .option("--sort-by <field>", "Sort field")
        .option("--sort-order <order>", "Sort order, for example asc or desc")
        .option("--quiet", "Print only the saved export path")
        .action(exportLinks);

    program
        .command("list")
        .description("List PeakURL short links.")
        .option("--page <number>", "Page number", parseNumber("page"))
        .option("--limit <number>", "Page size", parseNumber("limit"))
        .option("--search <query>", "Search term")
        .option("--sort-by <field>", "Sort field")
        .option("--sort-order <order>", "Sort order, for example asc or desc")
        .option("--json", "Print machine-readable output")
        .option("--quiet", "Print a minimal per-link value")
        .action(listLinks);

    program
        .command("get")
        .description("Fetch a single PeakURL short link by id or alias.")
        .argument("<id-or-alias>", "Link identifier or alias")
        .option("--json", "Print machine-readable output")
        .option("--quiet", "Print only the short URL")
        .action(getLink);

    program
        .command("delete")
        .description("Delete a PeakURL short link by id or alias.")
        .argument("<id-or-alias>", "Link identifier or alias")
        .option("--json", "Print machine-readable output")
        .option("--quiet", "Suppress success output")
        .action(deleteLink);

    program
        .command("update")
        .description(
            "Check for a newer CLI version and print the npm command to install it.",
        )
        .option(
            "--check",
            "Alias for checking update status without changing anything",
        )
        .option("--json", "Print machine-readable output")
        .option("--quiet", "Print minimal output")
        .action((options) => checkUpdate(options, version));

    const webhook = program
        .command("webhook")
        .alias("webhooks")
        .description("Manage outbound webhook integrations.");

    webhook
        .command("list")
        .description("List outbound webhooks.")
        .option("--json", "Print machine-readable output")
        .option("--quiet", "Print minimal webhook identifiers")
        .action(listWebhooks);

    webhook
        .command("create")
        .description("Create an outbound webhook.")
        .argument("<url>", "Webhook endpoint URL")
        .option(
            "--event <event>",
            "Webhook event id, for example link.clicked",
            parseWebhookEvents,
        )
        .option("--json", "Print machine-readable output")
        .option("--quiet", "Print only the created webhook ID")
        .action(createWebhook);

    webhook
        .command("delete")
        .description("Delete an outbound webhook by id.")
        .argument("<id>", "Webhook identifier")
        .option("--json", "Print machine-readable output")
        .option("--quiet", "Suppress success output")
        .action(deleteWebhook);

    webhook
        .command("events")
        .description("List the webhook events supported by the CLI.")
        .option("--json", "Print machine-readable output")
        .option("--quiet", "Print only event ids")
        .action(listWebhookEvents);

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
            writeStderr("Authentication required.");
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
            writeStderr(cliError.message);
        }

        process.exit(cliError.exitCode);
    }
}

void main();

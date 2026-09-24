#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { Command, CommanderError, InvalidArgumentError } from "commander";
import {
    checkUpdate,
    clearActivity,
    downloadCore,
    createWebhook,
    createLink,
    deleteActivity,
    deleteLink,
    deleteWebhook,
    editLink,
    exportLinks,
    getLink,
    importLinks,
    listActivity,
    listLinks,
    listWebhookEvents,
    listWebhooks,
    login,
    logout,
    status,
    whoami,
    clearJobHistory,
    getJob,
    listJobHistory,
    listJobs,
    resetJobSchedule,
    runDueJobs,
    runJob,
    updateJobSchedule,
    updateJobSettings,
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
        `\nExamples:\n${lines.map((line) => `  ${line}`).join("\n")}\n\nDocumentation:\n  https://go.peakurl.org/2aae02`,
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

    if (first === "webhook" || first === "activity" || first === "job") {
        const second = argv[3]?.trim();
        if (second && !second.startsWith("-")) {
            return `${first} ${second}`;
        }
    }

    return first;
}

const COMMAND_SUGGESTIONS: Record<string, string> = {
    activities: "activity",
    webhooks: "webhook",
    jobs: "job",
    cron: "job",
    "scheduled-jobs": "job",
    links: "list",
    urls: "list",
};

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
        .version(version, "-v, --version", "Show CLI version")
        .configureOutput({
            outputError: (str, write) => {
                const match = /error: unknown command '([^']+)'/.exec(str);
                if (match && COMMAND_SUGGESTIONS[match[1]]) {
                    const suggestion = COMMAND_SUGGESTIONS[match[1]];
                    write(
                        `error: unknown command '${match[1]}'. Did you mean 'peakurl ${suggestion}'?\n\n`,
                    );
                    return;
                }
                write(str);
            },
        })
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
  peakurl edit docs --social-title "Docs" --social-image-url https://example.com/og.png
  peakurl import ./links.csv
  peakurl export --format csv
  peakurl activity list
  peakurl job list
  peakurl webhook list
  peakurl update --check

Documentation:
  https://go.peakurl.org/2aae02

Run 'peakurl <command> --help' for command-specific flags and examples.`,
        )
        .exitOverride();

    // Update checks run before command actions so users get one compact notice
    // without every command needing to repeat the same version-check logic.
    program.hook("preAction", async (_command, actionCommand) => {
        const options = actionCommand.optsWithGlobals() as
            { json?: boolean; quiet?: boolean } | undefined;

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
            .option("--social-title <title>", "Social preview title")
            .option("--social-description <text>", "Social preview description")
            .option(
                "--social-image-url <url>",
                "Remote image URL for social preview",
            )
            .option(
                "--social-image <path>",
                "Local image file path for social preview",
            )
            .option("--json", "Print machine-readable output")
            .option("--quiet", "Print only the created short URL")
            .action(createLink),
        [
            "peakurl create https://example.com/docs --alias docs",
            'peakurl create https://example.com/launch --title "Launch Page" --social-title "Launch Page" --social-image-url https://example.com/og.png',
            "peakurl create https://example.com --json",
        ],
    );

    addExamples(
        program
            .command("edit")
            .summary("Edit an existing short link")
            .description(
                "Update an existing short link's destination URL, settings, or social preview by ID or alias.",
            )
            .helpOption("-h, --help", "Show help")
            .argument("<id-or-alias>", "Link identifier or alias")
            .option("--url <url>", "Updated destination URL")
            .option("--title <title>", "Updated title")
            .option(
                "--password <password>",
                "Set or update password protection",
            )
            .option("--clear-password", "Remove password protection")
            .option(
                "--status <status>",
                "Updated link status, for example active, inactive, or expired",
            )
            .option(
                "--expires-at <iso>",
                "Updated expiration timestamp in ISO-8601 format",
            )
            .option("--clear-expires-at", "Remove expiration timestamp")
            .option("--social-title <title>", "Updated social preview title")
            .option(
                "--social-description <text>",
                "Updated social preview description",
            )
            .option(
                "--social-image-url <url>",
                "Updated remote image URL for social preview",
            )
            .option(
                "--social-image <path>",
                "Upload a local image file for social preview",
            )
            .option(
                "--remove-social-image",
                "Remove existing social preview image",
            )
            .option("--json", "Print machine-readable output")
            .option("--quiet", "Print only the short URL")
            .action(editLink),
        [
            'peakurl edit docs --social-title "PeakURL Docs" --social-description "Documentation and guides" --social-image-url https://peakurl.org/og.png',
            'peakurl edit docs --url https://peakurl.org/docs/v2 --title "Updated Docs"',
            "peakurl edit url_123 --remove-social-image --json",
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
            .summary("Delete short links")
            .description(
                "Delete PeakURL short links by ID or alias, in bulk, or clear all links.",
            )
            .helpOption("-h, --help", "Show help")
            .argument("[id-or-alias...]", "Link identifier(s) or alias(es)")
            .option("--all", "Delete all accessible short links")
            .option(
                "--trash, --empty-trash",
                "Empty all short links currently in trash",
            )
            .option(
                "--ids <ids>",
                "Comma-separated list of link IDs to bulk delete",
            )
            .option("--json", "Print machine-readable output")
            .option("--quiet", "Suppress success output")
            .action(deleteLink),
        [
            "peakurl delete docs",
            "peakurl delete docs pricing launch",
            "peakurl delete --ids url_1,url_2,url_3",
            "peakurl delete --empty-trash",
            "peakurl delete --all",
        ],
    );

    const activity = program
        .command("activity")
        .summary("View and manage activity logs")
        .helpOption("-h, --help", "Show help")
        .description(
            "View audit log activity entries, delete specific records, or clear all history.",
        );

    addExamples(activity, [
        "peakurl activity list",
        "peakurl activity delete act_123 act_456",
        "peakurl activity clear",
    ]);

    addExamples(
        activity
            .command("list", { isDefault: true })
            .summary("List activity logs")
            .description("List audit log activity records.")
            .helpOption("-h, --help", "Show help")
            .option("--page <number>", "Page number", parseNumber("page"))
            .option("--limit <number>", "Page size", parseNumber("limit"))
            .option("--search <query>", "Search term")
            .option("--json", "Print machine-readable output")
            .option("--quiet", "Print only activity record IDs")
            .action(listActivity),
        [
            "peakurl activity",
            "peakurl activity list",
            "peakurl activity list --limit 25 --page 1",
            "peakurl activity list --search delete --json",
        ],
    );

    addExamples(
        activity
            .command("delete")
            .summary("Delete activity logs")
            .description(
                "Delete one or more activity logs by ID, or clear all logs with --all.",
            )
            .helpOption("-h, --help", "Show help")
            .argument("[ids...]", "One or more activity log IDs to delete")
            .option("--all", "Delete all activity log history")
            .option(
                "--ids <ids>",
                "Comma-separated list of activity log IDs to delete",
            )
            .option("--json", "Print machine-readable output")
            .option("--quiet", "Suppress success output")
            .action(deleteActivity),
        [
            "peakurl activity delete act_123",
            "peakurl activity delete act_123 act_456",
            "peakurl activity delete --ids act_1,act_2",
            "peakurl activity delete --all",
        ],
    );

    addExamples(
        activity
            .command("clear")
            .summary("Clear all activity logs")
            .description("Delete all audit log activity records permanently.")
            .helpOption("-h, --help", "Show help")
            .option("--json", "Print machine-readable output")
            .option("--quiet", "Suppress success output")
            .action(clearActivity),
        ["peakurl activity clear", "peakurl activity clear --json"],
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
            .action(
                (options: {
                    check?: boolean;
                    json?: boolean;
                    quiet?: boolean;
                }) => checkUpdate(options, version),
            ),
        ["peakurl update", "peakurl update --check", "peakurl update --json"],
    );

    const jobCmd = program
        .command("job")
        .summary("Manage scheduled jobs")
        .description(
            "Manage server-side scheduled jobs, view their execution history, and run them manually.",
        )
        .helpOption("-h, --help", "Show help");

    addExamples(jobCmd, [
        "peakurl job",
        "peakurl job list",
        "peakurl job get peakurl_version_check",
        "peakurl job run peakurl_version_check",
        "peakurl job run-due",
    ]);

    addExamples(
        jobCmd
            .command("list", { isDefault: true })
            .summary("List scheduled jobs")
            .description("List all registered scheduled jobs.")
            .helpOption("-h, --help", "Show help")
            .option("--json", "Print machine-readable output")
            .option("--quiet", "Print only job IDs")
            .action(listJobs),
        [
            "peakurl job",
            "peakurl job list",
            "peakurl job list --json",
            "peakurl job list --quiet",
        ],
    );

    addExamples(
        jobCmd
            .command("get")
            .summary("Show job details")
            .description(
                "Show detailed configuration and status for one scheduled job.",
            )
            .helpOption("-h, --help", "Show help")
            .argument("<id>", "Job identifier")
            .option("--json", "Print machine-readable output")
            .option("--quiet", "Print only the job ID")
            .action(getJob),
        [
            "peakurl job get peakurl_version_check",
            "peakurl job get peakurl_version_check --json",
        ],
    );

    addExamples(
        jobCmd
            .command("run")
            .summary("Run a scheduled job")
            .description("Force a specific scheduled job to run immediately.")
            .helpOption("-h, --help", "Show help")
            .argument("<id>", "Job identifier")
            .option("--json", "Print machine-readable output")
            .option("--quiet", "Print only the execution status")
            .action(runJob),
        [
            "peakurl job run peakurl_version_check",
            "peakurl job run peakurl_version_check --json",
        ],
    );

    addExamples(
        jobCmd
            .command("run-due")
            .summary("Run due jobs")
            .description("Trigger all scheduled jobs that are currently due.")
            .helpOption("-h, --help", "Show help")
            .option("--json", "Print machine-readable output")
            .option("--quiet", "Print only the execution statuses")
            .action(runDueJobs),
        ["peakurl job run-due", "peakurl job run-due --json"],
    );

    addExamples(
        jobCmd
            .command("history")
            .summary("View job history")
            .description("View recent execution history for a scheduled job.")
            .helpOption("-h, --help", "Show help")
            .argument("<id>", "Job identifier")
            .option("--json", "Print machine-readable output")
            .option("--quiet", "Print only history record IDs")
            .action(listJobHistory),
        [
            "peakurl job history peakurl_version_check",
            "peakurl job history peakurl_version_check --json",
        ],
    );

    addExamples(
        jobCmd
            .command("clear-history")
            .summary("Clear job history")
            .description(
                "Clear execution history for all jobs or a specific job.",
            )
            .helpOption("-h, --help", "Show help")
            .option("--job <id>", "Specific job identifier to clear")
            .option("--json", "Print machine-readable output")
            .option("--quiet", "Suppress success output")
            .action(clearJobHistory),
        [
            "peakurl job clear-history",
            "peakurl job clear-history --job peakurl_version_check",
            "peakurl job clear-history --json",
        ],
    );

    addExamples(
        jobCmd
            .command("schedule")
            .summary("Update job schedule")
            .description("Update the schedule configuration for a job.")
            .helpOption("-h, --help", "Show help")
            .argument("<id>", "Job identifier")
            .option("--interval <seconds>", "Execution interval in seconds")
            .option(
                "--preferred-time <time>",
                "Preferred run time (HH:MM or 'none')",
            )
            .option("--enabled", "Enable the job")
            .option("--disabled", "Disable the job")
            .option("--json", "Print machine-readable output")
            .option("--quiet", "Suppress success output")
            .action(updateJobSchedule),
        [
            "peakurl job schedule peakurl_version_check --interval 43200",
            "peakurl job schedule peakurl_version_check --preferred-time 03:00",
            "peakurl job schedule peakurl_version_check --disabled",
        ],
    );

    addExamples(
        jobCmd
            .command("reset")
            .summary("Reset job schedule")
            .description("Reset a job's schedule to its default configuration.")
            .helpOption("-h, --help", "Show help")
            .argument("<id>", "Job identifier")
            .option("--json", "Print machine-readable output")
            .option("--quiet", "Suppress success output")
            .action(resetJobSchedule),
        [
            "peakurl job reset peakurl_version_check",
            "peakurl job reset peakurl_version_check --json",
        ],
    );

    addExamples(
        jobCmd
            .command("settings")
            .summary("Manage scheduler settings")
            .description("View or update global scheduler settings.")
            .helpOption("-h, --help", "Show help")
            .option(
                "--retention-days <days>",
                "Number of days to keep execution history",
            )
            .option("--json", "Print machine-readable output")
            .option("--quiet", "Print minimal output")
            .action(updateJobSettings),
        [
            "peakurl job settings",
            "peakurl job settings --retention-days 14",
            "peakurl job settings --json",
        ],
    );

    const webhook = program
        .command("webhook")
        .summary("Manage webhooks")
        .helpOption("-h, --help", "Show help")
        .description("Manage outbound webhook integrations.");

    addExamples(webhook, [
        "peakurl webhook",
        "peakurl webhook list",
        "peakurl webhook create https://example.com/api/webhooks/peakurl --event link.clicked",
        "peakurl webhook events",
    ]);

    addExamples(
        webhook
            .command("list", { isDefault: true })
            .summary("List webhooks")
            .description("List outbound webhooks.")
            .helpOption("-h, --help", "Show help")
            .option("--json", "Print machine-readable output")
            .option("--quiet", "Print minimal webhook identifiers")
            .action(listWebhooks),
        [
            "peakurl webhook",
            "peakurl webhook list",
            "peakurl webhook list --json",
        ],
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

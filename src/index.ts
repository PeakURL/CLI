#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { Command, CommanderError, InvalidArgumentError } from "commander";
import { createCommand } from "./commands/create.js";
import { deleteCommand } from "./commands/delete.js";
import { getCommand } from "./commands/get.js";
import { listCommand } from "./commands/list.js";
import { loginCommand } from "./commands/login.js";
import { updateCommand } from "./commands/update.js";
import { whoamiCommand } from "./commands/whoami.js";
import { toCliError } from "./lib/errors.js";
import { maybeShowUpdateNotice } from "./lib/update.js";
import { writeStderr } from "./lib/output.js";

/**
 * Builds a Commander parser for positive integer flags such as `--page`.
 *
 * @param label Human-readable option name for validation messages.
 * @returns Parser function passed directly to Commander.
 */
function parsePositiveInteger(label: string) {
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
 * Reads the CLI version from `package.json` so help/version output stays aligned
 * with the package that will actually be published.
 *
 * @returns Version string exposed by the package manifest.
 */
async function readVersion(): Promise<string> {
    const packageJson = new URL("../package.json", import.meta.url);
    const content = await readFile(packageJson, "utf8");
    const parsed = JSON.parse(content) as { version?: string };
    return parsed.version || "0.0.0";
}

/**
 * Registers the PeakURL command surface and executes the requested command.
 *
 * @returns Promise that resolves when the command finishes or exits the process
 * via Commander / CLI error handling.
 */
async function main(): Promise<void> {
    const program = new Command();
    const version = await readVersion();

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
  peakurl login --base-url https://peakurl.org --api-key 0123456789abcdef0123456789abcdef0123456789abcdef
  peakurl whoami --json
  peakurl create https://example.com --alias example
  peakurl list --limit 10
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

        await maybeShowUpdateNotice({
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
            "PeakURL base URL, for example https://peakurl.org",
        )
        .option("--api-key <token>", "PeakURL API key to store")
        .option("--json", "Print machine-readable output")
        .option("--quiet", "Suppress success output")
        .action(loginCommand);

    program
        .command("whoami")
        .description("Show the current authenticated PeakURL user.")
        .option("--json", "Print machine-readable output")
        .option("--quiet", "Print a minimal identity value")
        .action(whoamiCommand);

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
        .action(createCommand);

    program
        .command("list")
        .description("List PeakURL short links.")
        .option("--page <number>", "Page number", parsePositiveInteger("page"))
        .option("--limit <number>", "Page size", parsePositiveInteger("limit"))
        .option("--search <query>", "Search term")
        .option("--sort-by <field>", "Sort field")
        .option("--sort-order <order>", "Sort order, for example asc or desc")
        .option("--json", "Print machine-readable output")
        .option("--quiet", "Print a minimal per-link value")
        .action(listCommand);

    program
        .command("get")
        .description("Fetch a single PeakURL short link by id or alias.")
        .argument("<id-or-alias>", "Link identifier or alias")
        .option("--json", "Print machine-readable output")
        .option("--quiet", "Print only the short URL")
        .action(getCommand);

    program
        .command("delete")
        .description("Delete a PeakURL short link by id or alias.")
        .argument("<id-or-alias>", "Link identifier or alias")
        .option("--json", "Print machine-readable output")
        .option("--quiet", "Suppress success output")
        .action(deleteCommand);

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
        .action((options) => updateCommand(options, version));

    try {
        await program.parseAsync(process.argv);
    } catch (error) {
        // Commander throws for expected control-flow exits such as validation
        // errors. Everything else is normalized into our own CLI error shape.
        if (error instanceof CommanderError) {
            process.exit(error.exitCode);
        }

        const cliError = toCliError(error);
        writeStderr(cliError.message);
        process.exit(cliError.exitCode);
    }
}

void main();

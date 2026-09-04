import { ApiClient } from "../api/index.js";
import {
    CliError,
    extractActivity,
    formatActivitySummary,
    formatActivityTable,
    getAuthConfig,
    successLine,
    writeJson,
    writeStdout,
} from "../lib/index.js";
import type { OutputOptions } from "../types.js";

interface ListActivityOptions extends OutputOptions {
    page?: number;
    limit?: number;
    search?: string;
}

interface DeleteActivityOptions extends OutputOptions {
    all?: boolean;
    ids?: string;
    force?: boolean;
}

/**
 * Lists audit log activity entries.
 *
 * @param options Parsed list and output options.
 */
export async function listActivity(
    options: ListActivityOptions,
): Promise<void> {
    const config = await getAuthConfig(process.env);
    const response = await new ApiClient(config).listActivity({
        page: options.page,
        limit: options.limit,
        search: options.search,
    });

    const items = extractActivity(response.data);

    if (options.json) {
        writeJson(response);
        return;
    }

    if (options.quiet) {
        for (const item of items) {
            if (item.id) {
                writeStdout(String(item.id));
            }
        }
        return;
    }

    writeStdout(successLine(response.message || "Activity loaded."));
    writeStdout(formatActivityTable(items));
    writeStdout(formatActivitySummary(response.data, items.length));
}

/**
 * Deletes audit log activity entries by ID, in bulk, or clears all activity.
 *
 * @param identifiers One or more activity log IDs.
 * @param options Parsed deletion and output options.
 */
export async function deleteActivity(
    identifiers: string[] | string | undefined,
    options: DeleteActivityOptions,
): Promise<void> {
    const config = await getAuthConfig(process.env);
    const client = new ApiClient(config);

    if (options.all) {
        const response = await client.clearActivity();

        if (options.json) {
            writeJson(response);
            return;
        }

        if (options.quiet) {
            return;
        }

        writeStdout(
            successLine(response.message || "All activity logs deleted."),
        );
        return;
    }

    const rawTargets: string[] = [];

    if (typeof identifiers === "string" && identifiers.trim()) {
        rawTargets.push(identifiers.trim());
    } else if (Array.isArray(identifiers)) {
        for (const item of identifiers) {
            if (typeof item === "string" && item.trim()) {
                rawTargets.push(item.trim());
            }
        }
    }

    if (options.ids) {
        for (const id of options.ids.split(",")) {
            const trimmed = id.trim();
            if (trimmed) {
                rawTargets.push(trimmed);
            }
        }
    }

    const uniqueTargets = Array.from(new Set(rawTargets));

    if (uniqueTargets.length === 0) {
        throw new CliError(
            "Specify one or more activity IDs to delete, or use --all to delete all activity logs.",
        );
    }

    if (uniqueTargets.length === 1) {
        const response = await client.deleteActivity(uniqueTargets[0]);

        if (options.json) {
            writeJson(response);
            return;
        }

        if (options.quiet) {
            return;
        }

        writeStdout(successLine(response.message || "Activity log deleted."));
        return;
    }

    const response = await client.deleteActivityBulk(uniqueTargets);

    if (options.json) {
        writeJson(response);
        return;
    }

    if (options.quiet) {
        return;
    }

    writeStdout(
        successLine(
            response.message ||
                `Deleted ${uniqueTargets.length} activity record${uniqueTargets.length === 1 ? "" : "s"}.`,
        ),
    );
}

/**
 * Clears all audit log activity records.
 *
 * @param options Parsed output options.
 */
export async function clearActivity(options: OutputOptions): Promise<void> {
    const config = await getAuthConfig(process.env);
    const response = await new ApiClient(config).clearActivity();

    if (options.json) {
        writeJson(response);
        return;
    }

    if (options.quiet) {
        return;
    }

    writeStdout(successLine(response.message || "All activity logs deleted."));
}

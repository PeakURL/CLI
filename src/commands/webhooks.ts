import { ApiClient } from "../api/index.js";
import {
    CliError,
    formatWebhookDetails,
    formatWebhookEventsTable,
    formatWebhooksSummary,
    formatWebhooksTable,
    getAuthConfig,
    getQuietWebhookValue,
    normalizeWebhookUrl,
    WEBHOOK_EVENTS,
    writeJson,
    writeStdout,
} from "../lib/index.js";
import type { OutputOptions } from "../types.js";

/**
 * Output options accepted by webhook create.
 */
interface CreateWebhookOptions extends OutputOptions {
    event?: string[];
}

/**
 * Lists outbound webhooks for the authenticated user.
 *
 * @param options Shared output flags parsed by Commander.
 */
export async function listWebhooks(options: OutputOptions): Promise<void> {
    const config = await getAuthConfig(process.env);
    const response = await new ApiClient(config).listWebhooks();

    if (options.json) {
        writeJson(response);
        return;
    }

    if (options.quiet) {
        for (const webhook of response.data ?? []) {
            const value = getQuietWebhookValue(webhook);
            if (value) {
                writeStdout(value);
            }
        }
        return;
    }

    writeStdout(response.message);
    writeStdout(formatWebhooksTable(response.data ?? []));
    writeStdout(formatWebhooksSummary(response.data ?? []));
}

/**
 * Creates one outbound webhook registration.
 *
 * @param url Webhook endpoint URL passed on the command line.
 * @param options Shared output flags plus selected event names.
 */
export async function createWebhook(
    url: string,
    options: CreateWebhookOptions,
): Promise<void> {
    /*
     * Collapse repeated --event flags into one stable list before sending the
     * payload to the API.
     */
    const events = Array.from(new Set(options.event ?? []));

    if (events.length === 0) {
        throw new CliError(
            "At least one webhook event is required. Use `--event <event>` and run `peakurl webhook events` to see the supported values.",
        );
    }

    const config = await getAuthConfig(process.env);
    const response = await new ApiClient(config).createWebhook({
        url: normalizeWebhookUrl(url),
        events,
    });

    if (options.json) {
        writeJson(response);
        return;
    }

    if (options.quiet) {
        writeStdout(getQuietWebhookValue(response.data));
        return;
    }

    writeStdout(response.message);
    writeStdout(formatWebhookDetails(response.data));

    if (response.data.secret) {
        writeStdout("Save the signing secret now. PeakURL only shows it once.");
    }
}

/**
 * Deletes one outbound webhook by its stable ID.
 *
 * @param id Webhook identifier returned by the API.
 * @param options Shared output flags parsed by Commander.
 */
export async function deleteWebhook(
    id: string,
    options: OutputOptions,
): Promise<void> {
    const config = await getAuthConfig(process.env);
    const response = await new ApiClient(config).deleteWebhook(id.trim());

    if (options.json) {
        writeJson(response);
        return;
    }

    if (options.quiet) {
        return;
    }

    writeStdout(response.message);
}

/**
 * Lists the webhook events supported by the current CLI and API surface.
 *
 * @param options Shared output flags parsed by Commander.
 */
export async function listWebhookEvents(options: OutputOptions): Promise<void> {
    const response = {
        success: true,
        message: "Webhook events loaded.",
        data: WEBHOOK_EVENTS,
        timestamp: new Date().toISOString(),
    };

    if (options.json) {
        writeJson(response);
        return;
    }

    if (options.quiet) {
        for (const event of WEBHOOK_EVENTS) {
            writeStdout(event.id);
        }
        return;
    }

    writeStdout(response.message);
    writeStdout(formatWebhookEventsTable());
}

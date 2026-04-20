import type { Webhook } from "../types.js";
import { CliError } from "./errors.js";
import { formatTable } from "./output.js";

/**
 * One supported webhook event shown in CLI help and tables.
 */
interface WebhookEventInfo {
    id: string;
    label: string;
    description: string;
}

/**
 * Webhook events supported by the current PeakURL app and CLI.
 */
export const WEBHOOK_EVENTS: WebhookEventInfo[] = [
    {
        id: "link.created",
        label: "Link Created",
        description: "Send a delivery when a short link is created.",
    },
    {
        id: "link.clicked",
        label: "Link Clicked",
        description: "Send a delivery when a visitor clicks a short link.",
    },
    {
        id: "link.updated",
        label: "Link Updated",
        description: "Send a delivery when a short link is updated.",
    },
    {
        id: "link.deleted",
        label: "Link Deleted",
        description: "Send a delivery when a short link is deleted.",
    },
];

function text(value: unknown): string | undefined {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function textList(value: unknown): string[] {
    return Array.isArray(value)
        ? value
              .map((item) => text(item))
              .filter((item): item is string => Boolean(item))
        : [];
}

function truncate(value: string, maxLength: number): string {
    return value.length > maxLength
        ? `${value.slice(0, maxLength - 1)}…`
        : value;
}

/**
 * Parses one `--event` flag value, supporting repeated flags and comma lists.
 *
 * @param value Raw option value from Commander.
 * @param previous Parsed values collected so far.
 * @returns Accumulated validated event list.
 * @throws {CliError} When an unknown event is supplied.
 */
export function parseWebhookEvents(
    value: string,
    previous: string[] = [],
): string[] {
    const allowed = new Set(WEBHOOK_EVENTS.map((event) => event.id));
    const values = value
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);

    if (values.length === 0) {
        throw new CliError("A webhook event value is required.");
    }

    for (const event of values) {
        if (!allowed.has(event)) {
            throw new CliError(
                `Unknown webhook event: ${event}. Run \`peakurl webhook events\` to see the supported values.`,
            );
        }
    }

    // Keep repeated flags readable while still allowing `--event a,b`.
    return [...previous, ...values];
}

/**
 * Returns the stable webhook ID when available.
 */
export function getWebhookId(webhook: Webhook): string | undefined {
    return (
        text(webhook.id) ||
        (webhook.id !== undefined ? String(webhook.id) : undefined)
    );
}

/**
 * Returns the configured destination URL for a webhook.
 */
export function getWebhookUrl(webhook: Webhook): string | undefined {
    return text(webhook.url);
}

/**
 * Returns normalized event identifiers for a webhook.
 */
export function getWebhookEvents(webhook: Webhook): string[] {
    return textList(webhook.events);
}

/**
 * Returns the compact value used by webhook quiet output.
 */
export function getQuietWebhookValue(webhook: Webhook): string {
    return getWebhookId(webhook) || getWebhookUrl(webhook) || "";
}

/**
 * Formats the supported webhook events for human-readable CLI output.
 */
export function formatWebhookEventsTable(): string {
    return formatTable(
        ["Event", "Label", "Description"],
        WEBHOOK_EVENTS.map((event) => [
            event.id,
            event.label,
            event.description,
        ]),
    );
}

/**
 * Formats a webhook list as a fixed-width table.
 */
export function formatWebhooksTable(webhooks: Webhook[]): string {
    if (webhooks.length === 0) {
        return "No webhooks found.";
    }

    return formatTable(
        ["ID", "URL", "Events", "Status", "Secret"],
        webhooks.map((webhook) => [
            truncate(getWebhookId(webhook) || "-", 18),
            truncate(getWebhookUrl(webhook) || "-", 42),
            truncate(getWebhookEvents(webhook).join(", ") || "-", 30),
            webhook.isActive === false ? "inactive" : "active",
            truncate(text(webhook.secretHint) || "-", 18),
        ]),
    );
}

/**
 * Formats one webhook for the default human-readable detail view.
 */
export function formatWebhookDetails(webhook: Webhook): string {
    const rows = [
        ["ID", getWebhookId(webhook)],
        ["URL", getWebhookUrl(webhook)],
        [
            "Events",
            getWebhookEvents(webhook).length > 0
                ? getWebhookEvents(webhook).join(", ")
                : undefined,
        ],
        ["Status", webhook.isActive === false ? "inactive" : "active"],
        ["Secret", text(webhook.secret)],
        ["Secret Hint", text(webhook.secretHint)],
        ["Created", text(webhook.createdAt)],
    ].filter((entry): entry is [string, string] => Boolean(entry[1]));

    if (rows.length === 0) {
        return "No webhook fields returned.";
    }

    return formatTable(["Field", "Value"], rows);
}

/**
 * Formats a webhook list summary for default human-readable output.
 */
export function formatWebhooksSummary(webhooks: Webhook[]): string {
    return `${webhooks.length} webhook${webhooks.length === 1 ? "" : "s"} returned.`;
}

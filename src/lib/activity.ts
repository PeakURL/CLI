import type { ActivityItem } from "../types.js";
import type { ListData, ListMeta } from "../api/index.js";
import { formatDetailsTable, formatTable } from "./output.js";

const ACTIVITY_LIST_KEYS = [
    "items",
    "results",
    "activities",
    "history",
] as const;

function asObject(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
}

function asString(value: unknown): string | undefined {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asNumber(value: unknown): number | undefined {
    return typeof value === "number" && Number.isFinite(value)
        ? value
        : undefined;
}

function truncate(value: string, maxLength: number): string {
    return value.length > maxLength
        ? `${value.slice(0, maxLength - 1)}…`
        : value;
}

function getActivityMeta(
    data: ListData | ActivityItem[] | unknown,
): ListMeta | null {
    const record = asObject(data);

    if (!record) {
        return null;
    }

    const meta = asObject(record.meta);
    if (meta) {
        return {
            page: asNumber(meta.page),
            limit: asNumber(meta.limit),
            totalItems: asNumber(meta.totalItems),
            totalPages: asNumber(meta.totalPages),
        };
    }

    return {
        page: asNumber(record.page),
        limit: asNumber(record.limit),
        totalItems: asNumber(record.total),
        totalPages: asNumber(record.totalPages),
    };
}

/**
 * Extracts an activity array from the different response payload shapes.
 *
 * @param data Raw `data` value from the PeakURL envelope.
 * @returns Normalized array of activity entries.
 */
export function extractActivity(
    data: ListData | ActivityItem[] | unknown,
): ActivityItem[] {
    if (Array.isArray(data)) {
        return data as ActivityItem[];
    }

    const record = asObject(data);
    if (record) {
        for (const key of ACTIVITY_LIST_KEYS) {
            const value = record[key];
            if (Array.isArray(value)) {
                return value as ActivityItem[];
            }
        }
    }

    return [];
}

/**
 * Formats a list of activity entries as a fixed-width table.
 *
 * @param items Activity item array from the API.
 * @returns Plain-text table for terminal output.
 */
export function formatActivityTable(items: ActivityItem[]): string {
    if (items.length === 0) {
        return "No activity logs found.";
    }

    const headers = [
        "ID",
        "Action",
        "User",
        "IP Address",
        "Timestamp",
        "Message",
    ];
    const rows = items.map((item) => [
        truncate(asString(item.id) || "-", 18),
        truncate(asString(item.type) || "-", 18),
        truncate(
            asString(item.userName) || asString(item.userEmail) || "-",
            18,
        ),
        truncate(asString(item.ipAddress) || "-", 16),
        truncate(asString(item.createdAt) || "-", 22),
        truncate(asString(item.message) || "-", 40),
    ]);

    return formatTable(headers, rows);
}

/**
 * Formats one activity item as a two-column key/value details table.
 *
 * @param item Activity item payload from the API.
 * @returns Formatted details table ready for stdout.
 */
export function formatActivityDetails(item: ActivityItem): string {
    const fields: [string, string | undefined][] = [
        ["ID", asString(item.id)],
        ["Action Type", asString(item.type)],
        ["Message", asString(item.message)],
        ["User ID", asString(item.userId)],
        ["User Name", asString(item.userName)],
        ["User Email", asString(item.userEmail)],
        ["Link ID", asString(item.linkId)],
        ["IP Address", asString(item.ipAddress)],
        [
            "Location",
            [item.city, item.country].filter(Boolean).join(", ") || undefined,
        ],
        ["Created At", asString(item.createdAt)],
    ];

    const rows = fields.filter((entry): entry is [string, string] =>
        Boolean(entry[1]),
    );

    if (rows.length === 0) {
        return "No activity fields returned.";
    }

    return formatDetailsTable(rows);
}

/**
 * Formats pagination metadata for activity list output.
 *
 * @param data Raw list payload from the API envelope.
 * @param count Number of rendered rows.
 * @returns Human-readable list summary.
 */
export function formatActivitySummary(
    data: ListData | ActivityItem[] | unknown,
    count: number,
): string {
    const meta = getActivityMeta(data);

    if (!meta) {
        return `${count} activity record${count === 1 ? "" : "s"} returned.`;
    }

    const total = meta.totalItems;
    const page = meta.page;
    const totalPages = meta.totalPages;

    if (total !== undefined && page !== undefined && totalPages !== undefined) {
        return `Page ${page} of ${totalPages}. ${total} total activity record${total === 1 ? "" : "s"}.`;
    }

    return `${count} activity record${count === 1 ? "" : "s"} returned.`;
}

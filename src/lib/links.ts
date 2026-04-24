import type { Link } from "../types.js";
import type { ListData, ListMeta } from "../api/index.js";
import { formatDetailsTable, formatTable } from "./output.js";

const LIST_KEYS = ["urls", "items", "results"] as const;

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

function pickText(link: Link, keys: string[]): string | undefined {
    for (const key of keys) {
        const value = asString(link[key]);
        if (value) {
            return value;
        }
    }

    return undefined;
}

function truncate(value: string, maxLength: number): string {
    return value.length > maxLength
        ? `${value.slice(0, maxLength - 1)}…`
        : value;
}

function getListMeta(data: ListData | Link[] | unknown): ListMeta | null {
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

    // Keep a fallback for earlier mock/test payloads that exposed flat fields.
    return {
        page: asNumber(record.page),
        limit: asNumber(record.limit),
        totalItems: asNumber(record.total),
        totalPages: asNumber(record.totalPages),
    };
}

/**
 * Extracts a link array from the different list payload shapes the API may return.
 *
 * @param data Raw `data` value from the PeakURL envelope.
 * @returns Normalized array of links.
 */
export function extractLinks(data: ListData | Link[] | unknown): Link[] {
    if (Array.isArray(data)) {
        return data as Link[];
    }

    const record = asObject(data);
    if (record) {
        for (const key of LIST_KEYS) {
            const value = record[key];
            if (Array.isArray(value)) {
                return value as Link[];
            }
        }
    }

    return [];
}

/**
 * Returns the primary link identifier field when available.
 *
 * @param link Link payload from the API.
 * @returns Stable row identifier when present.
 */
export function getLinkId(link: Link): string | undefined {
    return (
        pickText(link, ["id", "_id", "urlId"]) ||
        (link.id !== undefined ? String(link.id) : undefined)
    );
}

/**
 * Returns the best alias-like value for a link.
 *
 * @param link Link payload from the API.
 * @returns Alias-like value when present.
 */
export function getLinkAlias(link: Link): string | undefined {
    return pickText(link, ["alias", "shortCode", "slug", "code"]);
}

/**
 * Returns the public short URL for a link when present.
 *
 * @param link Link payload from the API.
 * @returns Short URL when present.
 */
export function getLinkShortUrl(link: Link): string | undefined {
    return pickText(link, ["shortUrl", "shortLink", "shortURL", "url"]);
}

/**
 * Returns the destination URL for a link when present.
 *
 * @param link Link payload from the API.
 * @returns Destination URL when present.
 */
export function getLinkDestination(link: Link): string | undefined {
    return pickText(link, [
        "destinationUrl",
        "originalUrl",
        "targetUrl",
        "destination",
    ]);
}

/**
 * Returns the minimal value used by `--quiet` link output.
 *
 * @param link Link payload from the API.
 * @returns Preferred compact link representation.
 */
export function getQuietLinkValue(link: Link): string {
    return getLinkShortUrl(link) || getLinkAlias(link) || getLinkId(link) || "";
}

/**
 * Formats one link for the default human-readable detail view.
 *
 * @param link Link payload from the API.
 * @returns Multi-line label/value block.
 */
export function formatLinkDetails(link: Link): string {
    const rows = [
        ["ID", getLinkId(link)],
        ["Alias", getLinkAlias(link)],
        ["Short URL", getLinkShortUrl(link)],
        ["Destination", getLinkDestination(link)],
        ["Title", asString(link.title)],
        ["Status", asString(link.status)],
        [
            "Clicks",
            asNumber(link.clicks) === undefined
                ? undefined
                : String(link.clicks),
        ],
        ["Created", asString(link.createdAt)],
        ["Updated", asString(link.updatedAt)],
    ].filter((entry): entry is [string, string] => Boolean(entry[1]));

    if (rows.length === 0) {
        return "No link fields returned.";
    }

    return formatDetailsTable(rows);
}

/**
 * Formats a list of links as a fixed-width table.
 *
 * @param links Link payload array from the API.
 * @returns Plain-text table for terminal output.
 */
export function formatLinksTable(links: Link[]): string {
    if (links.length === 0) {
        return "No links found.";
    }

    const headers = ["ID", "Alias", "Short URL", "Destination", "Status"];
    const rows = links.map((link) => [
        truncate(getLinkId(link) || "-", 18),
        truncate(getLinkAlias(link) || "-", 12),
        truncate(getLinkShortUrl(link) || "-", 36),
        truncate(getLinkDestination(link) || "-", 52),
        truncate(asString(link.status) || "-", 12),
    ]);

    return formatTable(headers, rows);
}

/**
 * Formats pagination metadata for the default list output.
 *
 * @param data Raw list payload from the API envelope.
 * @param count Number of rendered rows.
 * @returns Human-readable list summary.
 */
export function formatListSummary(
    data: ListData | Link[] | unknown,
    count: number,
): string {
    const meta = getListMeta(data);

    if (!meta) {
        return `${count} link${count === 1 ? "" : "s"} returned.`;
    }

    const total = meta.totalItems;
    const page = meta.page;
    const totalPages = meta.totalPages;

    if (total !== undefined && page !== undefined && totalPages !== undefined) {
        return `Page ${page} of ${totalPages}. ${total} total link${total === 1 ? "" : "s"}.`;
    }

    return `${count} link${count === 1 ? "" : "s"} returned.`;
}

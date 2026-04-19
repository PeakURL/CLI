import type { PeakUrlLink } from "../types.js";
import type { ListLinksMeta, ListLinksResponse } from "../api/client.js";

const LIST_KEYS = ["urls", "items", "results"] as const;

function asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
}

function readString(value: unknown): string | undefined {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readNumber(value: unknown): number | undefined {
    return typeof value === "number" && Number.isFinite(value)
        ? value
        : undefined;
}

function firstString(link: PeakUrlLink, keys: string[]): string | undefined {
    for (const key of keys) {
        const value = readString(link[key]);
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

function extractListMeta(
    data: ListLinksResponse | PeakUrlLink[] | unknown,
): ListLinksMeta | null {
    const record = asRecord(data);

    if (!record) {
        return null;
    }

    const meta = asRecord(record.meta);
    if (meta) {
        return {
            page: readNumber(meta.page),
            limit: readNumber(meta.limit),
            totalItems: readNumber(meta.totalItems),
            totalPages: readNumber(meta.totalPages),
        };
    }

    // Keep a fallback for earlier mock/test payloads that exposed flat fields.
    return {
        page: readNumber(record.page),
        limit: readNumber(record.limit),
        totalItems: readNumber(record.total),
        totalPages: readNumber(record.totalPages),
    };
}

/**
 * Extracts a link array from the different list payload shapes the API may return.
 *
 * @param data Raw `data` value from the PeakURL envelope.
 * @returns Normalized array of links.
 */
export function extractLinks(
    data: ListLinksResponse | PeakUrlLink[] | unknown,
): PeakUrlLink[] {
    if (Array.isArray(data)) {
        return data as PeakUrlLink[];
    }

    const record = asRecord(data);
    if (record) {
        for (const key of LIST_KEYS) {
            const value = record[key];
            if (Array.isArray(value)) {
                return value as PeakUrlLink[];
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
export function getLinkId(link: PeakUrlLink): string | undefined {
    return (
        firstString(link, ["id", "_id", "urlId"]) ||
        (link.id !== undefined ? String(link.id) : undefined)
    );
}

/**
 * Returns the best alias-like value for a link.
 *
 * @param link Link payload from the API.
 * @returns Alias-like value when present.
 */
export function getLinkAlias(link: PeakUrlLink): string | undefined {
    return firstString(link, ["alias", "shortCode", "slug", "code"]);
}

/**
 * Returns the public short URL for a link when present.
 *
 * @param link Link payload from the API.
 * @returns Short URL when present.
 */
export function getLinkShortUrl(link: PeakUrlLink): string | undefined {
    return firstString(link, ["shortUrl", "shortLink", "shortURL", "url"]);
}

/**
 * Returns the destination URL for a link when present.
 *
 * @param link Link payload from the API.
 * @returns Destination URL when present.
 */
export function getLinkDestination(link: PeakUrlLink): string | undefined {
    return firstString(link, [
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
export function getQuietLinkValue(link: PeakUrlLink): string {
    return getLinkShortUrl(link) || getLinkAlias(link) || getLinkId(link) || "";
}

/**
 * Formats one link for the default human-readable detail view.
 *
 * @param link Link payload from the API.
 * @returns Multi-line label/value block.
 */
export function formatLinkDetails(link: PeakUrlLink): string {
    const lines = [
        ["ID", getLinkId(link)],
        ["Alias", getLinkAlias(link)],
        ["Short URL", getLinkShortUrl(link)],
        ["Destination", getLinkDestination(link)],
        ["Title", readString(link.title)],
        ["Status", readString(link.status)],
        [
            "Clicks",
            readNumber(link.clicks) === undefined
                ? undefined
                : String(link.clicks),
        ],
        ["Created", readString(link.createdAt)],
        ["Updated", readString(link.updatedAt)],
    ].filter((entry): entry is [string, string] => Boolean(entry[1]));

    return lines.map(([label, value]) => `${label}: ${value}`).join("\n");
}

/**
 * Formats a list of links as a fixed-width table.
 *
 * @param links Link payload array from the API.
 * @returns Plain-text table for terminal output.
 */
export function formatLinksTable(links: PeakUrlLink[]): string {
    if (links.length === 0) {
        return "No links found.";
    }

    const headers = ["ID", "ALIAS", "SHORT URL", "DESTINATION", "STATUS"];
    const rows = links.map((link) => [
        truncate(getLinkId(link) || "-", 18),
        truncate(getLinkAlias(link) || "-", 18),
        truncate(getLinkShortUrl(link) || "-", 36),
        truncate(getLinkDestination(link) || "-", 52),
        truncate(readString(link.status) || "-", 12),
    ]);

    const widths = headers.map((header, index) =>
        Math.max(header.length, ...rows.map((row) => row[index].length)),
    );

    const renderRow = (row: string[]): string =>
        row.map((cell, index) => cell.padEnd(widths[index])).join("  ");

    return [
        renderRow(headers),
        renderRow(widths.map((width) => "-".repeat(width))),
        ...rows.map(renderRow),
    ].join("\n");
}

/**
 * Formats pagination metadata for the default list output.
 *
 * @param data Raw list payload from the API envelope.
 * @param count Number of rendered rows.
 * @returns Human-readable list summary.
 */
export function formatListSummary(
    data: ListLinksResponse | PeakUrlLink[] | unknown,
    count: number,
): string {
    const meta = extractListMeta(data);

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

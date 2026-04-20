import type { Link, LinkFileFormat } from "../types.js";
import { CliError } from "./errors.js";

type ExportValue = number | string;

interface ExportRow {
    url: string;
    alias: string;
    title: string;
    password: string;
    expires: string;
    short_url: string;
    clicks: ExportValue;
    unique_clicks: ExportValue;
    created_at: string;
}

const EXPORT_HEADERS: Array<keyof ExportRow> = [
    "url",
    "alias",
    "title",
    "password",
    "expires",
    "short_url",
    "clicks",
    "unique_clicks",
    "created_at",
];

function text(value: unknown): string {
    return typeof value === "string" ? value : "";
}

function csvValue(value: unknown): string {
    const content = value == null ? "" : String(value);

    if (/[",\r\n]/.test(content)) {
        return `"${content.replace(/"/g, '""')}"`;
    }

    return content;
}

function xmlValue(value: unknown): string {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

function aliasValue(link: Link): string {
    return text(link.alias) || text(link.shortCode);
}

/**
 * Parses one export format option.
 *
 * @param value Raw user-provided format string.
 * @returns Normalized export format.
 * @throws {CliError} When the format is not supported.
 */
export function parseFileFormat(value: string): LinkFileFormat {
    const format = value.trim().toLowerCase();

    if (format === "csv" || format === "json" || format === "xml") {
        return format;
    }

    throw new CliError(
        `Unsupported file format: ${value}. Use csv, json, or xml.`,
    );
}

/**
 * Detects an import or export format from a file path.
 *
 * @param filePath Local path used for the import or export file.
 * @returns Detected format or `undefined` when the path has no known suffix.
 */
export function getFileFormatFromPath(
    filePath: string,
): LinkFileFormat | undefined {
    const value = filePath.trim().toLowerCase();

    if (value.endsWith(".csv")) {
        return "csv";
    }

    if (value.endsWith(".json")) {
        return "json";
    }

    if (value.endsWith(".xml")) {
        return "xml";
    }

    return undefined;
}

/**
 * Returns the default filename used when exporting links locally.
 *
 * @param format Selected export file format.
 * @returns Default filename for that format.
 */
export function getExportFileName(format: LinkFileFormat): string {
    return `peakurl-links.${format}`;
}

/**
 * Builds the normalized export rows used by CSV, JSON, and XML output.
 *
 * @param links Link payloads returned by the export API.
 * @returns Export rows ready for serialization.
 */
export function buildExportRows(links: Link[]): ExportRow[] {
    return links.map((link) => ({
        url: text(link.destinationUrl),
        alias: aliasValue(link),
        title: text(link.title),
        password: "",
        expires: text(link.expiresAt),
        short_url: text(link.shortUrl),
        clicks: typeof link.clicks === "number" ? link.clicks : "",
        unique_clicks:
            typeof link.uniqueClicks === "number" ? link.uniqueClicks : "",
        created_at: text(link.createdAt),
    }));
}

/**
 * Serializes exported links into the requested file format.
 *
 * @param links Link payloads returned by the export API.
 * @param format Selected export file format.
 * @returns Raw file content.
 */
export function serializeLinkExport(
    links: Link[],
    format: LinkFileFormat,
): string {
    const rows = buildExportRows(links);

    if (format === "json") {
        return JSON.stringify(rows, null, 2);
    }

    if (format === "xml") {
        const body = rows
            .map(
                (row) => `  <url>
    <destinationUrl>${xmlValue(row.url)}</destinationUrl>
    <alias>${xmlValue(row.alias)}</alias>
    <title>${xmlValue(row.title)}</title>
    <password>${xmlValue(row.password)}</password>
    <expiresAt>${xmlValue(row.expires)}</expiresAt>
    <shortUrl>${xmlValue(row.short_url)}</shortUrl>
    <clicks>${xmlValue(row.clicks)}</clicks>
    <uniqueClicks>${xmlValue(row.unique_clicks)}</uniqueClicks>
    <createdAt>${xmlValue(row.created_at)}</createdAt>
  </url>`,
            )
            .join("\n");

        return `<urls>\n${body}\n</urls>\n`;
    }

    const lines = [
        EXPORT_HEADERS.join(","),
        ...rows.map((row) =>
            EXPORT_HEADERS.map((key) => csvValue(row[key])).join(","),
        ),
    ];

    return `${lines.join("\n")}\n`;
}

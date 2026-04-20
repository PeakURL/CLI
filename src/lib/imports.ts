import { readFile } from "node:fs/promises";
import type {
    LinkFileFormat,
    LinkImportData,
    LinkImportError,
    LinkInput,
} from "../types.js";
import { CliError } from "./errors.js";
import { formatTable } from "./output.js";
import { getFileFormatFromPath, parseFileFormat } from "./exports.js";

function text(value: unknown): string | undefined {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeHeader(value: string): string {
    return value
        .replace(/^\uFEFF/, "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
}

function parseCsvRows(text: string): string[][] {
    const rows: string[][] = [];
    const source = text.replace(/^\uFEFF/, "");
    let row: string[] = [];
    let value = "";
    let inQuotes = false;

    const pushRow = () => {
        row.push(value);

        if (row.some((cell) => cell.trim() !== "")) {
            rows.push(row);
        }

        row = [];
        value = "";
    };

    for (let index = 0; index < source.length; index += 1) {
        const char = source[index];

        if (char === '"') {
            if (inQuotes && source[index + 1] === '"') {
                value += '"';
                index += 1;
            } else {
                inQuotes = !inQuotes;
            }

            continue;
        }

        if (char === "," && !inQuotes) {
            row.push(value);
            value = "";
            continue;
        }

        if ((char === "\n" || char === "\r") && !inQuotes) {
            if (char === "\r" && source[index + 1] === "\n") {
                index += 1;
            }

            pushRow();
            continue;
        }

        value += char;
    }

    if (value.length > 0 || row.length > 0) {
        pushRow();
    }

    return rows;
}

function extractAlias(value: string): string | undefined {
    const input = value.trim();

    if (!input) {
        return undefined;
    }

    try {
        const url = new URL(input);
        const pathname = url.pathname.replace(/^\/+|\/+$/g, "");
        return pathname
            ? decodeURIComponent(pathname.split("/").pop() || "")
            : undefined;
    } catch {
        const pathname = input.replace(/^\/+|\/+$/g, "");
        return pathname ? pathname.split("/").pop() || undefined : undefined;
    }
}

function decodeXml(value: string): string {
    return value
        .replace(/&apos;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&gt;/g, ">")
        .replace(/&lt;/g, "<")
        .replace(/&amp;/g, "&");
}

function normalizeImportRow(value: Record<string, unknown>): LinkInput | null {
    const destinationUrl =
        text(value.destinationUrl) ||
        text(value.url) ||
        text(value.destination);

    if (!destinationUrl) {
        return null;
    }

    const alias =
        text(value.alias) ||
        text(value.shortCode) ||
        text(value.shortcode) ||
        text(value.code) ||
        extractAlias(
            text(value.shortUrl) ||
                text(value.short_url) ||
                text(value.shortLink) ||
                text(value.shortlink) ||
                "",
        );

    return {
        destinationUrl,
        ...(alias ? { alias } : {}),
        ...(text(value.title) ? { title: text(value.title) } : {}),
        ...(text(value.password) ? { password: text(value.password) } : {}),
        ...(text(value.status) ? { status: text(value.status) } : {}),
        ...(text(value.expiresAt) || text(value.expires)
            ? { expiresAt: text(value.expiresAt) || text(value.expires) }
            : {}),
        ...(text(value.utmSource) ? { utmSource: text(value.utmSource) } : {}),
        ...(text(value.utmMedium) ? { utmMedium: text(value.utmMedium) } : {}),
        ...(text(value.utmCampaign)
            ? { utmCampaign: text(value.utmCampaign) }
            : {}),
        ...(text(value.utmTerm) ? { utmTerm: text(value.utmTerm) } : {}),
        ...(text(value.utmContent)
            ? { utmContent: text(value.utmContent) }
            : {}),
    };
}

function parseJson(text: string): LinkInput[] {
    const parsed = JSON.parse(text) as unknown;
    const items = Array.isArray(parsed)
        ? parsed
        : parsed &&
            typeof parsed === "object" &&
            Array.isArray((parsed as { urls?: unknown }).urls)
          ? ((parsed as { urls: unknown[] }).urls ?? [])
          : [];

    return items
        .map((item) =>
            item && typeof item === "object"
                ? normalizeImportRow(item as Record<string, unknown>)
                : null,
        )
        .filter((item): item is LinkInput => Boolean(item));
}

function parseCsv(text: string): LinkInput[] {
    const rows = parseCsvRows(text);

    if (rows.length < 2) {
        return [];
    }

    const headers = rows[0].map((header) => normalizeHeader(header));
    const links: LinkInput[] = [];

    for (let index = 1; index < rows.length; index += 1) {
        const row = rows[index];
        const entry: Record<string, unknown> = {};

        headers.forEach((header, column) => {
            const value = row[column]?.trim();

            if (!value) {
                return;
            }

            if (
                header === "url" ||
                header === "destinationurl" ||
                header === "destination"
            ) {
                entry.destinationUrl = value;
                return;
            }

            if (
                header === "alias" ||
                header === "shortcode" ||
                header === "code"
            ) {
                entry.alias = value;
                return;
            }

            if (header === "shorturl" || header === "shortlink") {
                entry.alias = entry.alias || extractAlias(value);
                return;
            }

            if (header === "password") {
                entry.password = value;
                return;
            }

            if (header === "expires" || header === "expiresat") {
                entry.expiresAt = value;
                return;
            }

            if (header === "title") {
                entry.title = value;
                return;
            }

            if (header === "status") {
                entry.status = value;
                return;
            }

            if (header === "utmsource") {
                entry.utmSource = value;
                return;
            }

            if (header === "utmmedium") {
                entry.utmMedium = value;
                return;
            }

            if (header === "utmcampaign") {
                entry.utmCampaign = value;
                return;
            }

            if (header === "utmterm") {
                entry.utmTerm = value;
                return;
            }

            if (header === "utmcontent") {
                entry.utmContent = value;
            }
        });

        const link = normalizeImportRow(entry);

        if (link) {
            links.push(link);
        }
    }

    return links;
}

function parseXml(text: string): LinkInput[] {
    const entries = Array.from(
        text.matchAll(/<(url|item)\b[^>]*>([\s\S]*?)<\/\1>/gi),
        (match) => match[2],
    );

    return entries
        .map((entry) => {
            const getValue = (tag: string): string | undefined => {
                const match = new RegExp(
                    `<${tag}>([\\s\\S]*?)</${tag}>`,
                    "i",
                ).exec(entry);

                return match ? decodeXml(match[1].trim()) : undefined;
            };

            return normalizeImportRow({
                destinationUrl: getValue("destinationUrl"),
                url: getValue("url"),
                alias: getValue("alias"),
                shortCode: getValue("shortCode"),
                shortUrl: getValue("shortUrl"),
                password: getValue("password"),
                expiresAt: getValue("expiresAt"),
                expires: getValue("expires"),
                title: getValue("title"),
                status: getValue("status"),
                utmSource: getValue("utmSource"),
                utmMedium: getValue("utmMedium"),
                utmCampaign: getValue("utmCampaign"),
                utmTerm: getValue("utmTerm"),
                utmContent: getValue("utmContent"),
            });
        })
        .filter((item): item is LinkInput => Boolean(item));
}

/**
 * Detects the file format used for one import file.
 *
 * @param filePath Local file path passed to the CLI.
 * @param value Optional explicit format override.
 * @returns Normalized file format.
 * @throws {CliError} When the CLI cannot determine a supported format.
 */
export function getImportFormat(
    filePath: string,
    value?: string,
): LinkFileFormat {
    if (value) {
        return parseFileFormat(value);
    }

    const format = getFileFormatFromPath(filePath);

    if (format) {
        return format;
    }

    throw new CliError(
        "Could not determine the import file format. Use a .csv, .json, or .xml file, or pass --format.",
    );
}

/**
 * Reads and parses one import file into the bulk-import payload shape.
 *
 * @param filePath Local file path to read.
 * @param format Parsed or detected file format.
 * @returns Normalized link rows ready for `POST /urls/bulk`.
 * @throws {CliError} When the file cannot be read or parsed.
 */
export async function readImportRows(
    filePath: string,
    format: LinkFileFormat,
): Promise<LinkInput[]> {
    let textContent = "";

    try {
        textContent = await readFile(filePath, "utf8");
    } catch (error) {
        throw new CliError(`Could not read import file ${filePath}.`, 1, {
            cause: error instanceof Error ? error : undefined,
        });
    }

    try {
        const rows =
            format === "json"
                ? parseJson(textContent)
                : format === "xml"
                  ? parseXml(textContent)
                  : parseCsv(textContent);

        if (rows.length === 0) {
            throw new CliError(`No import rows were found in ${filePath}.`);
        }

        return rows;
    } catch (error) {
        if (error instanceof CliError) {
            throw error;
        }

        throw new CliError(
            `Could not parse ${filePath} as ${format.toUpperCase()}.`,
            1,
            {
                cause: error instanceof Error ? error : undefined,
            },
        );
    }
}

/**
 * Formats bulk import row errors for terminal output.
 *
 * @param errors Row errors returned by the import API.
 * @returns Plain-text error table.
 */
export function formatImportErrors(errors: LinkImportError[]): string {
    return formatTable(
        ["Destination", "Alias", "Error"],
        errors.map((item) => [
            item.destinationUrl || "-",
            item.alias || "-",
            item.error || "Unknown error",
        ]),
    );
}

/**
 * Formats the created/error counts returned by bulk import.
 *
 * @param data Bulk import payload returned by the API.
 * @returns Human-readable import summary.
 */
export function formatImportSummary(data: LinkImportData): string {
    const created = data.results?.length ?? 0;
    const errors = data.errors?.length ?? 0;

    return `${created} link${created === 1 ? "" : "s"} created. ${errors} error${errors === 1 ? "" : "s"}.`;
}

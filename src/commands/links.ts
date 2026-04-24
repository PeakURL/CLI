import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { ApiClient } from "../api/index.js";
import {
    CliError,
    extractLinks,
    formatImportErrors,
    formatImportSummary,
    formatLinkDetails,
    formatLinksTable,
    formatListSummary,
    getAuthConfig,
    getExportFileName,
    getFileFormatFromPath,
    getImportFormat,
    getLinkId,
    getQuietLinkValue,
    normalizeDestinationUrl,
    parseFileFormat,
    readImportRows,
    serializeLinkExport,
    successLine,
    writeJson,
    writeStdout,
} from "../lib/index.js";
import type { OutputOptions } from "../types.js";

interface CreateOptions extends OutputOptions {
    alias?: string;
    title?: string;
    password?: string;
    status?: string;
    expiresAt?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmTerm?: string;
    utmContent?: string;
}

interface ListOptions extends OutputOptions {
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: string;
}

interface ImportOptions extends OutputOptions {
    format?: string;
}

interface ExportOptions {
    format?: string;
    output?: string;
    stdout?: boolean;
    quiet?: boolean;
    search?: string;
    sortBy?: string;
    sortOrder?: string;
}

function normalizeExpiresAt(value?: string): string | undefined {
    if (!value) {
        return undefined;
    }

    if (Number.isNaN(Date.parse(value))) {
        throw new CliError(`Invalid expiration timestamp: ${value}`);
    }

    return value;
}

/**
 * Creates a short link for the provided destination URL.
 *
 * @param destinationUrl Destination URL passed on the command line.
 * @param options Parsed output and link options.
 */
export async function createLink(
    destinationUrl: string,
    options: CreateOptions,
): Promise<void> {
    const config = await getAuthConfig(process.env);
    const response = await new ApiClient(config).createUrl({
        destinationUrl: normalizeDestinationUrl(destinationUrl),
        ...(options.alias ? { alias: options.alias } : {}),
        ...(options.title ? { title: options.title } : {}),
        ...(options.password ? { password: options.password } : {}),
        ...(options.status ? { status: options.status } : {}),
        ...(options.expiresAt
            ? { expiresAt: normalizeExpiresAt(options.expiresAt) }
            : {}),
        ...(options.utmSource ? { utmSource: options.utmSource } : {}),
        ...(options.utmMedium ? { utmMedium: options.utmMedium } : {}),
        ...(options.utmCampaign ? { utmCampaign: options.utmCampaign } : {}),
        ...(options.utmTerm ? { utmTerm: options.utmTerm } : {}),
        ...(options.utmContent ? { utmContent: options.utmContent } : {}),
    });

    if (options.json) {
        writeJson(response);
        return;
    }

    if (options.quiet) {
        writeStdout(getQuietLinkValue(response.data));
        return;
    }

    writeStdout(successLine(response.message));
    writeStdout(formatLinkDetails(response.data));
}

/**
 * Imports multiple links from a local CSV, JSON, or XML file.
 *
 * @param filePath Local file path to parse and submit to the API.
 * @param options Parsed import options.
 */
export async function importLinks(
    filePath: string,
    options: ImportOptions,
): Promise<void> {
    const format = getImportFormat(filePath, options.format);
    const urls = await readImportRows(filePath, format);
    const config = await getAuthConfig(process.env);
    const response = await new ApiClient(config).importUrls({ urls });
    const links = extractLinks(response.data?.results ?? []);
    const errors = response.data?.errors ?? [];

    if (options.json) {
        writeJson(response);
        return;
    }

    if (options.quiet) {
        for (const link of links) {
            const value = getQuietLinkValue(link);
            if (value) {
                writeStdout(value);
            }
        }
        return;
    }

    writeStdout(successLine(response.message));

    if (links.length > 0) {
        writeStdout(formatLinksTable(links));
    } else {
        writeStdout("No links were created.");
    }

    if (errors.length > 0) {
        writeStdout(formatImportErrors(errors));
    }

    writeStdout(formatImportSummary(response.data ?? {}));
}

/**
 * Exports accessible links through the API as CSV, JSON, or XML.
 *
 * @param options Parsed export options.
 */
export async function exportLinks(options: ExportOptions): Promise<void> {
    if (options.stdout && options.output) {
        throw new CliError("Use either --stdout or --output, not both.");
    }

    const format = options.format
        ? parseFileFormat(options.format)
        : options.output
          ? getFileFormatFromPath(options.output) || "csv"
          : "csv";
    const config = await getAuthConfig(process.env);
    const response = await new ApiClient(config).exportUrls({
        search: options.search,
        sortBy: options.sortBy,
        sortOrder: options.sortOrder,
    });
    const links = extractLinks(response.data);
    const content = serializeLinkExport(links, format);

    if (options.stdout) {
        process.stdout.write(content);
        return;
    }

    const filePath = resolve(options.output || getExportFileName(format));

    try {
        await mkdir(dirname(filePath), { recursive: true });
        await writeFile(filePath, content, "utf8");
    } catch (error) {
        throw new CliError(`Could not write export file ${filePath}.`, 1, {
            cause: error instanceof Error ? error : undefined,
        });
    }

    if (options.quiet) {
        writeStdout(filePath);
        return;
    }

    writeStdout(successLine(response.message));
    writeStdout(
        `Saved ${links.length} link${links.length === 1 ? "" : "s"} to ${filePath}.`,
    );
}

/**
 * Lists short links and renders them in human or machine-readable form.
 *
 * @param options Parsed list options.
 */
export async function listLinks(options: ListOptions): Promise<void> {
    const config = await getAuthConfig(process.env);
    const response = await new ApiClient(config).listUrls({
        page: options.page,
        limit: options.limit,
        search: options.search,
        sortBy: options.sortBy,
        sortOrder: options.sortOrder,
    });

    const links = extractLinks(response.data);

    if (options.json) {
        writeJson(response);
        return;
    }

    if (options.quiet) {
        for (const link of links) {
            const value = getQuietLinkValue(link);
            if (value) {
                writeStdout(value);
            }
        }
        return;
    }

    writeStdout(successLine(response.message));
    writeStdout(formatLinksTable(links));
    writeStdout(formatListSummary(response.data, links.length));
}

/**
 * Loads and prints a single short link by identifier or alias.
 *
 * @param idOrAlias Link identifier passed on the command line.
 * @param options Parsed output options.
 */
export async function getLink(
    idOrAlias: string,
    options: OutputOptions,
): Promise<void> {
    const config = await getAuthConfig(process.env);
    const response = await new ApiClient(config).getUrl(idOrAlias);

    if (options.json) {
        writeJson(response);
        return;
    }

    if (options.quiet) {
        writeStdout(getQuietLinkValue(response.data));
        return;
    }

    writeStdout(successLine(response.message));
    writeStdout(formatLinkDetails(response.data));
}

/**
 * Deletes a short link by identifier or alias.
 *
 * PeakURL's delete endpoint expects the stable row ID, so the CLI resolves the
 * user-provided identifier first and then performs the delete with that ID.
 *
 * @param idOrAlias Link ID, alias, or short code provided by the user.
 * @param options Parsed output options.
 */
export async function deleteLink(
    idOrAlias: string,
    options: OutputOptions,
): Promise<void> {
    const config = await getAuthConfig(process.env);
    const client = new ApiClient(config);

    // Resolve aliases and short codes up front so delete works with the current
    // PeakURL backend, which deletes by row ID rather than generic identifier.
    const lookupResponse = await client.getUrl(idOrAlias);
    const resolvedId = getLinkId(lookupResponse.data);

    if (!resolvedId) {
        throw new CliError(
            "PeakURL returned a link record without an ID, so the CLI cannot delete it safely.",
        );
    }

    const response = await client.deleteUrl(resolvedId);

    if (options.json) {
        writeJson(response);
        return;
    }

    if (options.quiet) {
        return;
    }

    writeStdout(successLine(response.message));
}

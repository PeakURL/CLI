import { CliError } from "./errors.js";

/**
 * Validates and normalizes a PeakURL installation base URL.
 *
 * The PeakURL dashboard exposes `baseApiUrl` values that already end in
 * `/api/v1`, while CLI docs and environment variables refer to the site root.
 * The CLI accepts either form and normalizes both back to the install root so
 * the HTTP client can build routes consistently.
 *
 * @param value Raw user-provided base URL.
 * @returns Normalized installation root URL without a trailing slash.
 * @throws {CliError} When the URL is missing or invalid.
 */
export function normalizeBaseUrl(value: string): string {
    const input = value.trim();

    if (!input) {
        throw new CliError("A PeakURL base URL is required.");
    }

    let parsed: URL;

    try {
        parsed = new URL(input);
    } catch {
        throw new CliError(`Invalid base URL: ${value}`);
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new CliError("PeakURL base URLs must use http or https.");
    }

    parsed.hash = "";
    parsed.search = "";

    // Accept both the install root and the dashboard-provided `/api/v1` URL.
    const pathname = parsed.pathname.replace(/\/+$/, "");
    const installPath = pathname.replace(/\/api\/v1$/i, "");
    return installPath ? `${parsed.origin}${installPath}` : parsed.origin;
}

/**
 * Builds a fully qualified `/api/v1` URL for a PeakURL request.
 *
 * @param baseUrl Installation root or `baseApiUrl`.
 * @param path Route path relative to `/api/v1`.
 * @param query Optional query-string parameters.
 * @returns Fully qualified request URL.
 */
export function buildApiUrl(
    baseUrl: string,
    path: string,
    query?: Record<string, string | number | undefined>,
): string {
    const cleanBaseUrl = normalizeBaseUrl(baseUrl);
    const cleanPath = path.replace(/^\/+/, "");
    const url = new URL(`api/v1/${cleanPath}`, `${cleanBaseUrl}/`);

    for (const [key, value] of Object.entries(query ?? {})) {
        if (value === undefined || value === "") {
            continue;
        }

        url.searchParams.set(key, String(value));
    }

    return url.toString();
}

/**
 * Validates and normalizes a destination URL before sending it to the API.
 *
 * @param value Raw destination URL.
 * @returns Canonicalized absolute URL.
 * @throws {CliError} When the URL is missing or invalid.
 */
export function normalizeDestinationUrl(value: string): string {
    const input = value.trim();

    if (!input) {
        throw new CliError("A destination URL is required.");
    }

    try {
        return new URL(input).toString();
    } catch {
        throw new CliError(`Invalid destination URL: ${value}`);
    }
}

import { CliError } from "./errors.js";

function validateHttpUrl(parsed: URL, label: string): void {
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new CliError(`${label} must use http or https.`);
    }

    if (parsed.username || parsed.password) {
        throw new CliError(`${label} must not include embedded credentials.`);
    }
}

/**
 * Validates the explicit PeakURL API base URL used by the CLI.
 *
 * The CLI now expects the exact API base URL, such as
 * `https://example.com/api/v1`. It does not try to infer that path from
 * the install root automatically.
 *
 * @param value Raw user-provided API base URL.
 * @returns Canonicalized API base URL without a trailing slash.
 * @throws {CliError} When the URL is missing, invalid, or does not end in `/api/v1`.
 */
export function getApiBaseUrl(value: string): string {
    const input = value.trim();

    if (!input) {
        throw new CliError("A PeakURL API base URL is required.");
    }

    let parsed: URL;

    try {
        parsed = new URL(input);
    } catch {
        throw new CliError(`Invalid API base URL: ${value}`);
    }

    validateHttpUrl(parsed, "PeakURL API base URL");

    parsed.hash = "";
    parsed.search = "";

    const pathname = parsed.pathname.replace(/\/+$/, "");

    if (!/\/api\/v1$/i.test(pathname)) {
        throw new CliError("PeakURL API base URL must end with /api/v1.");
    }

    return `${parsed.origin}${pathname}`;
}

/**
 * Builds a fully qualified API URL for a PeakURL request.
 *
 * @param apiBaseUrl Explicit API base URL, for example `https://example.com/api/v1`.
 * @param path Route path relative to that API base.
 * @param query Optional query-string parameters.
 * @returns Fully qualified request URL.
 */
export function buildApiUrl(
    apiBaseUrl: string,
    path: string,
    query?: Record<string, string | number | undefined>,
): string {
    const cleanBaseUrl = getApiBaseUrl(apiBaseUrl);
    const cleanPath = path.replace(/^\/+/, "");
    const url = new URL(cleanPath, `${cleanBaseUrl}/`);

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
        const parsed = new URL(input);
        validateHttpUrl(parsed, "Destination URL");
        return parsed.toString();
    } catch (error) {
        if (error instanceof CliError) {
            throw error;
        }

        throw new CliError(`Invalid destination URL: ${value}`);
    }
}

/**
 * Validates and normalizes a webhook endpoint URL before sending it to the API.
 *
 * @param value Raw webhook endpoint URL.
 * @returns Canonicalized absolute URL.
 * @throws {CliError} When the URL is missing or invalid.
 */
export function normalizeWebhookUrl(value: string): string {
    const input = value.trim();

    if (!input) {
        throw new CliError("A webhook URL is required.");
    }

    try {
        const parsed = new URL(input);
        validateHttpUrl(parsed, "Webhook URL");
        return parsed.toString();
    } catch (error) {
        if (error instanceof CliError) {
            throw error;
        }

        throw new CliError(`Invalid webhook URL: ${value}`);
    }
}

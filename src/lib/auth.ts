import type { AuthConfig } from "../types.js";
import { ConfigStore } from "../config/index.js";
import { CliError } from "./errors.js";
import { getApiBaseUrl } from "./url.js";

export const AUTH_REQUIRED_MESSAGE = "PeakURL credentials are not configured.";
const EXAMPLE_BASE_URL = "https://example.com/api/v1";
const EXAMPLE_API_KEY = "YOUR_API_KEY";

interface LoginInput {
    baseUrl?: string;
    apiKey?: string;
}

/**
 * Returns the human-readable auth setup rows shown when no credentials exist.
 */
export function authRows(commandName?: string): string[][] {
    const retryCommand = commandName
        ? `peakurl ${commandName}`
        : "peakurl whoami";
    const rows: string[][] = [
        [
            "Save credentials",
            `peakurl login --base-url ${EXAMPLE_BASE_URL}\n--api-key ${EXAMPLE_API_KEY}`,
            "Regular use on this machine",
        ],
        [
            "Set environment variables",
            `PEAKURL_BASE_URL=${EXAMPLE_BASE_URL}\nPEAKURL_API_KEY=${EXAMPLE_API_KEY}`,
            "CI, scripts, or one-off use",
        ],
        ["Then run", retryCommand, "After completing one of the steps above"],
    ];

    return rows;
}

/**
 * Resolves credentials for `peakurl login` from flags and environment variables.
 *
 * Flags win over environment variables so explicit one-off logins do not
 * accidentally reuse stale shell state from previous sessions.
 *
 * @param input Parsed CLI options from Commander.
 * @param env Process environment snapshot.
 * @returns Validated login credential set.
 * @throws {CliError} When either required credential is missing.
 */
export function getLoginConfig(
    input: LoginInput,
    env: NodeJS.ProcessEnv,
): AuthConfig {
    const apiBaseUrl = input.baseUrl?.trim() || env.PEAKURL_BASE_URL?.trim();
    const apiKey = input.apiKey?.trim() || env.PEAKURL_API_KEY?.trim();

    if (!apiBaseUrl || !apiKey) {
        throw new CliError(
            "Missing credentials. Provide --base-url and --api-key, or set PEAKURL_BASE_URL and PEAKURL_API_KEY.",
        );
    }

    return {
        apiBaseUrl: getApiBaseUrl(apiBaseUrl),
        apiKey,
    };
}

/**
 * Resolves stored or environment-based credentials for authenticated commands.
 *
 * Environment variables intentionally override the saved config so CI and other
 * scripted environments can inject credentials without mutating local state.
 *
 * @param env Process environment snapshot.
 * @param store Config store used to load persisted credentials.
 * @returns Resolved credential set for API requests.
 * @throws {CliError} When no usable credentials are available.
 */
export async function getAuthConfig(
    env: NodeJS.ProcessEnv,
    store = new ConfigStore(),
): Promise<AuthConfig> {
    const saved = await store.load();

    // CI and automation should be able to override the local config file
    // without changing what is stored on disk for the interactive user.
    const apiBaseUrl = env.PEAKURL_BASE_URL?.trim() || saved?.apiBaseUrl;
    const apiKey = env.PEAKURL_API_KEY?.trim() || saved?.apiKey;

    if (!apiBaseUrl || !apiKey) {
        throw new CliError(AUTH_REQUIRED_MESSAGE, 1, {
            kind: "auth_required",
        });
    }

    return {
        apiBaseUrl: getApiBaseUrl(apiBaseUrl),
        apiKey,
    };
}

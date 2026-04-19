import type { PeakUrlConfig } from "../types.js";
import { ConfigStore } from "../config/store.js";
import { CliError } from "./errors.js";
import { normalizeBaseUrl } from "./url.js";

interface LoginInput {
    baseUrl?: string;
    apiKey?: string;
}

/**
 * Resolves credentials for `peakurl login` from flags and environment variables.
 *
 * Flags win over environment variables so explicit one-off logins do not
 * accidentally reuse stale shell state from previous sessions.
 *
 * @param input Parsed CLI options from Commander.
 * @param env Process environment snapshot.
 * @returns Normalized login credential set.
 * @throws {CliError} When either required credential is missing.
 */
export function resolveLoginConfig(
    input: LoginInput,
    env: NodeJS.ProcessEnv,
): PeakUrlConfig {
    const baseUrl = input.baseUrl?.trim() || env.PEAKURL_BASE_URL?.trim();
    const apiKey = input.apiKey?.trim() || env.PEAKURL_API_KEY?.trim();

    if (!baseUrl || !apiKey) {
        throw new CliError(
            "Missing credentials. Provide --base-url and --api-key, or set PEAKURL_BASE_URL and PEAKURL_API_KEY.",
        );
    }

    return {
        baseUrl: normalizeBaseUrl(baseUrl),
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
export async function resolveStoredConfig(
    env: NodeJS.ProcessEnv,
    store = new ConfigStore(),
): Promise<PeakUrlConfig> {
    const saved = await store.load();

    // CI and automation should be able to override the local config file
    // without changing what is stored on disk for the interactive user.
    const baseUrl = env.PEAKURL_BASE_URL?.trim() || saved?.baseUrl;
    const apiKey = env.PEAKURL_API_KEY?.trim() || saved?.apiKey;

    if (!baseUrl || !apiKey) {
        throw new CliError(
            "PeakURL credentials are not configured. Run `peakurl login --base-url ... --api-key ...` or set PEAKURL_BASE_URL and PEAKURL_API_KEY.",
        );
    }

    return {
        baseUrl: normalizeBaseUrl(baseUrl),
        apiKey,
    };
}

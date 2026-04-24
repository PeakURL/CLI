import { ConfigStore } from "../config/index.js";
import { successLine, writeJson, writeStdout } from "../lib/index.js";
import type { OutputOptions } from "../types.js";

function hasEnvConfig(env: NodeJS.ProcessEnv): boolean {
    return Boolean(env.PEAKURL_BASE_URL?.trim() || env.PEAKURL_API_KEY?.trim());
}

/**
 * Removes saved CLI credentials from the local config store.
 */
export async function logout(options: OutputOptions): Promise<void> {
    const store = new ConfigStore();
    const saved = await store.load();
    const removed = await store.clear();
    const envConfig = hasEnvConfig(process.env);
    const message =
        removed && saved?.apiBaseUrl
            ? `Logged out. Removed saved credentials for ${saved.apiBaseUrl}.`
            : removed
              ? "Logged out. Removed saved PeakURL credentials."
              : "Already logged out. No saved PeakURL credentials were found.";

    const responseBody = {
        success: true,
        message,
        data: {
            removed,
            apiBaseUrl: saved?.apiBaseUrl,
            envCredentialsActive: envConfig,
        },
        timestamp: new Date().toISOString(),
    };

    if (options.json) {
        writeJson(responseBody);
        return;
    }

    if (options.quiet) {
        return;
    }

    writeStdout(successLine(message));

    if (envConfig) {
        writeStdout(
            "Environment credentials in PEAKURL_BASE_URL or PEAKURL_API_KEY still apply in this shell.",
        );
    }
}

import { PeakUrlApiClient } from "../api/client.js";
import { ConfigStore } from "../config/store.js";
import { resolveLoginConfig } from "../lib/auth.js";
import { writeJson, writeStdout } from "../lib/output.js";
import { formatUserDetails, getUserLabel } from "../lib/users.js";
import type { OutputOptions } from "../types.js";

interface LoginOptions extends OutputOptions {
    baseUrl?: string;
    apiKey?: string;
}

/**
 * Verifies credentials with PeakURL and stores them in the local config file.
 */
export async function loginCommand(options: LoginOptions): Promise<void> {
    const credentials = resolveLoginConfig(options, process.env);
    const client = new PeakUrlApiClient(credentials);
    const response = await client.whoami();

    await new ConfigStore().save(credentials);

    const payload = {
        success: true,
        message: `Saved credentials for ${credentials.baseUrl}.`,
        data: {
            baseUrl: credentials.baseUrl,
            user: response.data,
        },
        timestamp: response.timestamp,
    };

    if (options.json) {
        writeJson(payload);
        return;
    }

    if (options.quiet) {
        return;
    }

    writeStdout(`Saved credentials for ${credentials.baseUrl}`);
    writeStdout(`Authenticated as ${getUserLabel(response.data)}`);
    writeStdout(formatUserDetails(response.data));
}

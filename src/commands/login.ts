import { ApiClient } from "../api/index.js";
import { ConfigStore } from "../config/index.js";
import {
    getLoginConfig,
    userLabel,
    userTable,
    writeJson,
    writeStdout,
} from "../lib/index.js";
import type { OutputOptions } from "../types.js";

interface LoginOptions extends OutputOptions {
    baseUrl?: string;
    apiKey?: string;
}

/**
 * Verifies credentials with PeakURL and stores them in the local config file.
 */
export async function login(options: LoginOptions): Promise<void> {
    const credentials = getLoginConfig(options, process.env);
    const client = new ApiClient(credentials);
    const response = await client.whoami();

    await new ConfigStore().save(credentials);

    const responseBody = {
        success: true,
        message: `Saved credentials for ${credentials.apiBaseUrl}.`,
        data: {
            apiBaseUrl: credentials.apiBaseUrl,
            user: response.data,
        },
        timestamp: response.timestamp,
    };

    if (options.json) {
        writeJson(responseBody);
        return;
    }

    if (options.quiet) {
        return;
    }

    writeStdout(`Saved credentials for ${credentials.apiBaseUrl}`);
    writeStdout(`Authenticated as ${userLabel(response.data)}`);
    writeStdout(userTable(response.data));
}

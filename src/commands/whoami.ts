import { PeakUrlApiClient } from "../api/client.js";
import { resolveStoredConfig } from "../lib/auth.js";
import { writeJson, writeStdout } from "../lib/output.js";
import { formatUserDetails, getQuietUserValue } from "../lib/users.js";
import type { OutputOptions } from "../types.js";

/**
 * Prints the current authenticated user.
 */
export async function whoamiCommand(options: OutputOptions): Promise<void> {
    const config = await resolveStoredConfig(process.env);
    const response = await new PeakUrlApiClient(config).whoami();

    if (options.json) {
        writeJson(response);
        return;
    }

    if (options.quiet) {
        writeStdout(getQuietUserValue(response.data));
        return;
    }

    writeStdout(response.message);
    writeStdout(formatUserDetails(response.data));
}

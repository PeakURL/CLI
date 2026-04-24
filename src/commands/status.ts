import { ApiClient } from "../api/index.js";
import {
    formatStatusReport,
    getAuthConfig,
    getStatusValue,
    successLine,
    writeJson,
    writeStdout,
} from "../lib/index.js";
import type { OutputOptions } from "../types.js";

/**
 * Prints the current system status snapshot for the authenticated PeakURL site.
 *
 * @param options Shared output flags parsed by Commander.
 */
export async function status(options: OutputOptions): Promise<void> {
    const config = await getAuthConfig(process.env);
    const response = await new ApiClient(config).getStatus();

    if (options.json) {
        writeJson(response);
        return;
    }

    if (options.quiet) {
        writeStdout(getStatusValue(response.data));
        return;
    }

    writeStdout(successLine(response.message));
    writeStdout(formatStatusReport(response.data));
}

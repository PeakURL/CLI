import { PeakUrlApiClient } from "../api/client.js";
import { resolveStoredConfig } from "../lib/auth.js";
import { formatLinkDetails, getQuietLinkValue } from "../lib/links.js";
import { writeJson, writeStdout } from "../lib/output.js";
import type { OutputOptions } from "../types.js";

/**
 * Loads and prints a single short link by identifier or alias.
 */
export async function getCommand(
    idOrAlias: string,
    options: OutputOptions,
): Promise<void> {
    const config = await resolveStoredConfig(process.env);
    const response = await new PeakUrlApiClient(config).getUrl(idOrAlias);

    if (options.json) {
        writeJson(response);
        return;
    }

    if (options.quiet) {
        writeStdout(getQuietLinkValue(response.data));
        return;
    }

    writeStdout(response.message);
    writeStdout(formatLinkDetails(response.data));
}

import { PeakUrlApiClient } from "../api/client.js";
import { resolveStoredConfig } from "../lib/auth.js";
import { CliError } from "../lib/errors.js";
import { getLinkId } from "../lib/links.js";
import { writeJson, writeStdout } from "../lib/output.js";
import type { OutputOptions } from "../types.js";

/**
 * Deletes a short link by identifier or alias.
 *
 * PeakURL's delete endpoint expects the stable row ID, so the CLI resolves the
 * user-provided identifier first and then performs the delete with that ID.
 *
 * @param idOrAlias Link ID, alias, or short code provided by the user.
 * @param options Shared output options.
 */
export async function deleteCommand(
    idOrAlias: string,
    options: OutputOptions,
): Promise<void> {
    const config = await resolveStoredConfig(process.env);
    const client = new PeakUrlApiClient(config);

    // Resolve aliases and short codes up front so delete works with the current
    // PeakURL backend, which deletes by row ID rather than generic identifier.
    const lookupResponse = await client.getUrl(idOrAlias);
    const resolvedId = getLinkId(lookupResponse.data);

    if (!resolvedId) {
        throw new CliError(
            "PeakURL returned a link record without an ID, so the CLI cannot delete it safely.",
        );
    }

    const response = await client.deleteUrl(resolvedId);

    if (options.json) {
        writeJson(response);
        return;
    }

    if (options.quiet) {
        return;
    }

    writeStdout(response.message);
}

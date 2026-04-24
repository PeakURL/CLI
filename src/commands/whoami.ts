import { ApiClient } from "../api/index.js";
import {
    getAuthConfig,
    successLine,
    userTable,
    userValue,
    writeJson,
    writeStdout,
} from "../lib/index.js";
import type { OutputOptions } from "../types.js";

/**
 * Prints the current authenticated user.
 */
export async function whoami(options: OutputOptions): Promise<void> {
    const config = await getAuthConfig(process.env);
    const response = await new ApiClient(config).whoami();

    if (options.json) {
        writeJson(response);
        return;
    }

    if (options.quiet) {
        writeStdout(userValue(response.data));
        return;
    }

    writeStdout(successLine(response.message));
    writeStdout(userTable(response.data));
}

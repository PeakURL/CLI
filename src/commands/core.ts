import { cwd } from "node:process";
import {
    downloadCorePackage,
    formatCoreDownload,
    getCoreRelease,
    successLine,
    writeJson,
    writeStdout,
} from "../lib/index.js";
import type { ForceOptions } from "../types.js";

/**
 * Downloads the latest PeakURL core package, verifies its checksum, and
 * extracts the archive into the current working directory.
 *
 * @param options Shared output flags plus overwrite support.
 */
export async function downloadCore(options: ForceOptions): Promise<void> {
    const release = await getCoreRelease(process.env);
    const result = await downloadCorePackage(
        release,
        cwd(),
        Boolean(options.force),
    );
    const responseBody = {
        success: true,
        message: "PeakURL downloaded.",
        data: result,
        timestamp: new Date().toISOString(),
    };

    if (options.json) {
        writeJson(responseBody);
        return;
    }

    if (options.quiet) {
        writeStdout(result.path);
        return;
    }

    writeStdout(successLine(responseBody.message));
    writeStdout(formatCoreDownload(result));
}

import {
    getUpdateStatus,
    successLine,
    writeJson,
    writeNoticeBox,
    writeStdout,
} from "../lib/index.js";
import type { OutputOptions } from "../types.js";

interface UpdateOptions extends OutputOptions {
    check?: boolean;
}

/**
 * Checks for a newer CLI version and prints the recommended npm install command.
 *
 * @param options Parsed command flags.
 * @param currentVersion Current CLI version from package metadata.
 */
export async function checkUpdate(
    options: UpdateOptions,
    currentVersion: string,
): Promise<void> {
    const status = await getUpdateStatus(currentVersion, process.env, {
        forceRefresh: true,
    });

    const responseBody = {
        success: true,
        message: status.isOutdated
            ? `A newer PeakURL CLI version is available (${status.latestVersion}).`
            : `PeakURL CLI ${status.currentVersion} is up to date.`,
        data: {
            currentVersion: status.currentVersion,
            latestVersion: status.latestVersion,
            isOutdated: status.isOutdated,
            installCommand: status.installCommand,
            checkOnly: Boolean(options.check),
        },
        timestamp: new Date().toISOString(),
    };

    if (options.json) {
        writeJson(responseBody);
        return;
    }

    if (!status.isOutdated) {
        if (!options.quiet) {
            writeStdout(
                successLine(
                    `PeakURL CLI ${status.currentVersion} is up to date.`,
                ),
            );
        }
        return;
    }

    if (options.quiet) {
        writeStdout(status.installCommand);
        return;
    }

    writeNoticeBox(
        "Update Available",
        [
            `peakurl ${status.currentVersion} -> ${status.latestVersion}`,
            `Run: ${status.installCommand}`,
        ],
        "stdout",
    );
}

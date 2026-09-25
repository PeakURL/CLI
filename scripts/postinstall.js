import { existsSync, mkdirSync, symlinkSync, unlinkSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Links `man/peakurl.1` into `<prefix>/share/man/man1/peakurl.1` during global
 * npm installs on Unix systems (since npm v7+ stopped creating man page
 * symlinks automatically while still cleaning them up on uninstall).
 */
function linkGlobalManPage() {
    if (
        process.env.npm_config_global !== "true" ||
        process.platform === "win32"
    ) {
        return;
    }

    try {
        const currentDir = dirname(fileURLToPath(import.meta.url));
        const packageRoot = resolve(currentDir, "..");
        const sourceManPage = resolve(packageRoot, "man", "peakurl.1");

        if (!existsSync(sourceManPage)) {
            return;
        }

        const prefix =
            process.env.npm_config_prefix ??
            resolve(packageRoot, "..", "..", "..");
        const targetManDir = resolve(prefix, "share", "man", "man1");
        const targetManPage = resolve(targetManDir, "peakurl.1");

        mkdirSync(targetManDir, { recursive: true });

        try {
            unlinkSync(targetManPage);
        } catch {
            // Ignore when no previous man page symlink exists.
        }

        symlinkSync(relative(targetManDir, sourceManPage), targetManPage);
    } catch {
        // Never fail package installation if the system man directory is read-only.
    }
}

linkGlobalManPage();

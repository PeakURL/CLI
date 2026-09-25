import {
    existsSync,
    mkdirSync,
    readFileSync,
    realpathSync,
    symlinkSync,
    unlinkSync,
    writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MAN_DIR = "man";
const MAN_SECTION_DIR = "man1";
const MAN_FILENAME = "peakurl.1";
const MANPATH_FILENAME = ".manpath";

/**
 * Finds the root directory of the installed `peakurl` package.
 *
 * @returns Absolute package root path, or `null` when the manual page file is
 * not present alongside the executable.
 */
function getPackageRoot(): string | null {
    const currentDir = dirname(fileURLToPath(import.meta.url));
    const candidates = [
        resolve(currentDir, ".."),
        resolve(currentDir, "..", ".."),
    ];

    for (const candidate of candidates) {
        if (existsSync(resolve(candidate, MAN_DIR, MAN_FILENAME))) {
            return candidate;
        }
    }

    return null;
}

/**
 * Creates or updates the `peakurl.1` symlink inside a `man1` directory.
 *
 * @param manSectionDir Target `man1` directory path.
 * @param sourceFile Absolute path to the bundled `man/peakurl.1` file.
 * @returns `true` when the symlink points to `sourceFile`, or `false` when the
 * target directory is not writable by the current user.
 */
function linkManPage(manSectionDir: string, sourceFile: string): boolean {
    const targetFile = resolve(manSectionDir, MAN_FILENAME);

    try {
        if (
            existsSync(targetFile) &&
            realpathSync(targetFile) === realpathSync(sourceFile)
        ) {
            return true;
        }
    } catch {
        // Recreate the symlink below if the existing entry is broken.
    }

    try {
        mkdirSync(manSectionDir, { recursive: true });

        try {
            unlinkSync(targetFile);
        } catch {
            // Ignore when no previous symlink exists.
        }

        symlinkSync(relative(manSectionDir, sourceFile), targetFile);
        return true;
    } catch {
        return false;
    }
}

/**
 * Adds the user-level manual directory to `~/.manpath` on Linux so `man-db`
 * discovers `~/.local/share/man/man1/peakurl.1` without requiring root access.
 *
 * @param homeDir Current user's home directory.
 * @param userManBase Path to `~/.local/share/man`.
 */
function updateManpathConfig(homeDir: string, userManBase: string): void {
    const configPath = resolve(homeDir, MANPATH_FILENAME);
    const entry = `MANDATORY_MANPATH ${userManBase}`;
    const content = existsSync(configPath)
        ? readFileSync(configPath, "utf8")
        : "";

    if (content.split(/\r?\n/).some((line) => line.trim() === entry)) {
        return;
    }

    const prefix =
        content.length > 0 && !content.endsWith("\n")
            ? `${content}\n`
            : content;
    writeFileSync(configPath, `${prefix}${entry}\n`, "utf8");
}

/**
 * Registers the `peakurl(1)` manual page so `man peakurl` works out of the box
 * across macOS and Linux installations.
 */
export function registerManPage(): void {
    if (process.platform === "win32") {
        return;
    }

    try {
        const packageRoot = getPackageRoot();

        if (!packageRoot) {
            return;
        }

        if (
            !packageRoot.includes("/node_modules/") &&
            process.env.npm_config_global !== "true"
        ) {
            return;
        }

        const sourceFile = resolve(packageRoot, MAN_DIR, MAN_FILENAME);
        const prefix =
            process.env.npm_config_prefix ||
            resolve(packageRoot, "..", "..", "..");
        const systemManDir = resolve(prefix, "share", MAN_DIR, MAN_SECTION_DIR);

        if (linkManPage(systemManDir, sourceFile)) {
            return;
        }

        const homeDir = process.env.HOME || homedir();

        if (!homeDir) {
            return;
        }

        const userManBase = resolve(homeDir, ".local", "share", MAN_DIR);
        const userManDir = resolve(userManBase, MAN_SECTION_DIR);

        if (
            linkManPage(userManDir, sourceFile) &&
            process.platform === "linux"
        ) {
            updateManpathConfig(homeDir, userManBase);
        }
    } catch {
        // Keep CLI execution unaffected if manual page registration fails.
    }
}

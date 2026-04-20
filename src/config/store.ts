import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import envPaths from "env-paths";
import type { PeakUrlConfig } from "../types.js";
import { CliError } from "../lib/errors.js";

const CONFIG_FILENAME = "config.json";
const STATE_FILENAME = "state.json";

interface PeakUrlCliState {
    update?: {
        latestVersion?: string;
        lastCheckedAt?: string;
        lastNotifiedAt?: string;
        lastNotifiedVersion?: string;
    };
}

/**
 * Resolves the OS-appropriate config file path used by the CLI.
 *
 * `env-paths` keeps the CLI aligned with user expectations on macOS, Linux,
 * and Windows without hard-coding platform-specific directories ourselves.
 *
 * @returns Absolute config file path.
 */
function defaultConfigPath(): string {
    return join(envPaths("peakurl", { suffix: "" }).config, CONFIG_FILENAME);
}

/**
 * Resolves the state file path used for non-sensitive CLI metadata.
 *
 * This file is separate from credentials so update-check metadata can be
 * cached without changing the validation rules for the auth config file.
 *
 * @returns Absolute state file path.
 */
function defaultStatePath(): string {
    return join(envPaths("peakurl", { suffix: "" }).config, STATE_FILENAME);
}

/**
 * Ensures the parent directory exists before writing a config or state file.
 *
 * @param filePath Absolute file path whose parent directory should exist.
 */
async function ensureParentDirectory(filePath: string): Promise<string> {
    const directory = dirname(filePath);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    return directory;
}

/**
 * Reads and writes the per-user CLI config file.
 *
 * The config currently stores the normalized base URL plus the API key. The
 * file is kept in one place so auth resolution is predictable in both local
 * terminal use and automated scripts.
 */
export class ConfigStore {
    readonly filePath: string;

    /**
     * Creates a config store bound to one on-disk file.
     *
     * @param filePath Optional override used by tests or advanced callers.
     */
    constructor(filePath = defaultConfigPath()) {
        this.filePath = filePath;
    }

    /**
     * Loads the stored credential set from disk.
     *
     * Missing files are treated as "not configured yet" instead of as hard
     * errors so first-run CLI flows remain clean.
     *
     * @returns Stored config or `null` when the file does not exist.
     * @throws {CliError} When the file exists but is unreadable or invalid.
     */
    async load(): Promise<PeakUrlConfig | null> {
        try {
            const content = await readFile(this.filePath, "utf8");
            const parsed = JSON.parse(content) as Partial<PeakUrlConfig>;

            if (
                typeof parsed.baseUrl !== "string" ||
                typeof parsed.apiKey !== "string"
            ) {
                throw new CliError(`Invalid config file: ${this.filePath}`);
            }

            return {
                baseUrl: parsed.baseUrl,
                apiKey: parsed.apiKey,
            };
        } catch (error) {
            if (
                error instanceof Error &&
                "code" in error &&
                typeof error.code === "string" &&
                error.code === "ENOENT"
            ) {
                return null;
            }

            if (error instanceof CliError) {
                throw error;
            }

            throw new CliError(
                `Could not read PeakURL config at ${this.filePath}.`,
                1,
                {
                    cause: error instanceof Error ? error : undefined,
                },
            );
        }
    }

    /**
     * Persists one credential set to disk with restrictive file permissions.
     *
     * The chmod step is best-effort because Windows and some filesystems do not
     * expose POSIX permission bits in the same way as Unix-like systems.
     *
     * @param config Normalized credential set to write.
     */
    async save(config: PeakUrlConfig): Promise<void> {
        // Create the config directory first so both the JSON file and its
        // parent directory can be permission-hardened for local credentials.
        const directory = await ensureParentDirectory(this.filePath);
        await writeFile(this.filePath, `${JSON.stringify(config, null, 2)}\n`, {
            mode: 0o600,
        });

        try {
            await chmod(directory, 0o700);
            await chmod(this.filePath, 0o600);
        } catch {
            // Ignore chmod errors on platforms that do not support POSIX-style modes.
        }
    }
}

/**
 * Reads and writes low-risk CLI state such as cached update-check metadata.
 *
 * The state file is intentionally tolerant of corruption or missing keys
 * because it should never block normal CLI operation.
 */
export class StateStore {
    readonly filePath: string;

    /**
     * Creates a state store bound to one on-disk file.
     *
     * @param filePath Optional override used by tests or advanced callers.
     */
    constructor(filePath = defaultStatePath()) {
        this.filePath = filePath;
    }

    /**
     * Loads cached state from disk.
     *
     * Missing or invalid files are treated as empty state because the CLI can
     * always recompute update metadata on the next successful network check.
     *
     * @returns Parsed state object or an empty object.
     */
    async load(): Promise<PeakUrlCliState> {
        try {
            const content = await readFile(this.filePath, "utf8");
            const parsed = JSON.parse(content) as PeakUrlCliState | null;
            return parsed && typeof parsed === "object" ? parsed : {};
        } catch {
            return {};
        }
    }

    /**
     * Persists cached state to disk.
     *
     * @param state State payload to save.
     */
    async save(state: PeakUrlCliState): Promise<void> {
        await ensureParentDirectory(this.filePath);
        await writeFile(this.filePath, `${JSON.stringify(state, null, 2)}\n`, {
            mode: 0o600,
        });
    }
}

import { CliError } from "./errors.js";
import { writeNoticeBox } from "./output.js";
import { StateStore } from "../config/store.js";

const PACKAGE_NAME = "peakurl";
const DEFAULT_REGISTRY_URL = "https://registry.npmjs.org";
const CACHE_TTL_MS = 1000 * 60 * 60 * 12;
const NOTICE_TTL_MS = 1000 * 60 * 60 * 24;

interface LatestPackageMetadata {
    version?: string;
}

interface UpdateState {
    latestVersion?: string;
    lastCheckedAt?: string;
    lastNotifiedAt?: string;
    lastNotifiedVersion?: string;
}

/**
 * Structured version status used by the update command and notifier.
 */
export interface UpdateStatus {
    currentVersion: string;
    latestVersion: string;
    isOutdated: boolean;
    installCommand: string;
}

interface MaybeNotifyOptions {
    currentVersion: string;
    commandName: string;
    options?: { json?: boolean; quiet?: boolean };
    env: NodeJS.ProcessEnv;
}

function readTimestamp(value?: string): number | null {
    if (!value) {
        return null;
    }

    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
}

function getRegistryUrl(env: NodeJS.ProcessEnv): string {
    return env.PEAKURL_NPM_REGISTRY_URL?.trim() || DEFAULT_REGISTRY_URL;
}

function normalizeRegistryUrl(registryUrl: string): string {
    return registryUrl.replace(/\/+$/, "");
}

function parseSemver(version: string): {
    major: number;
    minor: number;
    patch: number;
    prerelease: string[];
} | null {
    const match =
        /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(
            version,
        );

    if (!match) {
        return null;
    }

    return {
        major: Number.parseInt(match[1], 10),
        minor: Number.parseInt(match[2], 10),
        patch: Number.parseInt(match[3], 10),
        prerelease: match[4] ? match[4].split(".") : [],
    };
}

function comparePrerelease(left: string[], right: string[]): number {
    if (left.length === 0 && right.length === 0) {
        return 0;
    }

    if (left.length === 0) {
        return 1;
    }

    if (right.length === 0) {
        return -1;
    }

    const length = Math.max(left.length, right.length);

    for (let index = 0; index < length; index += 1) {
        const leftPart = left[index];
        const rightPart = right[index];

        if (leftPart === undefined) {
            return -1;
        }

        if (rightPart === undefined) {
            return 1;
        }

        const leftNumber = /^\d+$/.test(leftPart)
            ? Number.parseInt(leftPart, 10)
            : null;
        const rightNumber = /^\d+$/.test(rightPart)
            ? Number.parseInt(rightPart, 10)
            : null;

        if (leftNumber !== null && rightNumber !== null) {
            if (leftNumber !== rightNumber) {
                return leftNumber > rightNumber ? 1 : -1;
            }

            continue;
        }

        if (leftNumber !== null) {
            return -1;
        }

        if (rightNumber !== null) {
            return 1;
        }

        if (leftPart !== rightPart) {
            return leftPart > rightPart ? 1 : -1;
        }
    }

    return 0;
}

/**
 * Compares two semver strings.
 *
 * @param left Installed or current version.
 * @param right Registry or candidate version.
 * @returns Positive when `left` is newer, negative when `right` is newer.
 */
export function compareSemver(left: string, right: string): number {
    const parsedLeft = parseSemver(left);
    const parsedRight = parseSemver(right);

    if (!parsedLeft || !parsedRight) {
        return left.localeCompare(right, undefined, { numeric: true });
    }

    if (parsedLeft.major !== parsedRight.major) {
        return parsedLeft.major > parsedRight.major ? 1 : -1;
    }

    if (parsedLeft.minor !== parsedRight.minor) {
        return parsedLeft.minor > parsedRight.minor ? 1 : -1;
    }

    if (parsedLeft.patch !== parsedRight.patch) {
        return parsedLeft.patch > parsedRight.patch ? 1 : -1;
    }

    return comparePrerelease(parsedLeft.prerelease, parsedRight.prerelease);
}

/**
 * Builds the exact npm command shown to users for global CLI updates.
 *
 * @returns One-line install command.
 */
export function getInstallCommand(): string {
    return `npm install -g ${PACKAGE_NAME}@latest`;
}

async function fetchLatestVersion(
    env: NodeJS.ProcessEnv,
): Promise<string | null> {
    const registryUrl = normalizeRegistryUrl(getRegistryUrl(env));
    const url = `${registryUrl}/${PACKAGE_NAME}/latest`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    try {
        const response = await fetch(url, {
            headers: {
                accept: "application/json",
            },
            signal: controller.signal,
        });

        if (!response.ok) {
            return null;
        }

        const payload = (await response.json()) as LatestPackageMetadata;
        return typeof payload.version === "string" ? payload.version : null;
    } catch {
        return null;
    } finally {
        clearTimeout(timeout);
    }
}

async function loadLatestVersionFromState(
    store: StateStore,
): Promise<UpdateState> {
    const state = await store.load();
    return state.update ?? {};
}

async function saveUpdateState(
    store: StateStore,
    update: UpdateState,
): Promise<void> {
    const state = await store.load();
    await store.save({
        ...state,
        update,
    });
}

async function resolveLatestVersion(
    env: NodeJS.ProcessEnv,
    options?: { forceRefresh?: boolean; store?: StateStore },
): Promise<string | null> {
    const store = options?.store ?? new StateStore();
    const updateState = await loadLatestVersionFromState(store);
    const lastCheckedAt = readTimestamp(updateState.lastCheckedAt);
    const now = Date.now();

    if (
        !options?.forceRefresh &&
        updateState.latestVersion &&
        lastCheckedAt !== null &&
        now - lastCheckedAt < CACHE_TTL_MS
    ) {
        return updateState.latestVersion;
    }

    const latestVersion = await fetchLatestVersion(env);

    if (!latestVersion) {
        return updateState.latestVersion ?? null;
    }

    await saveUpdateState(store, {
        ...updateState,
        latestVersion,
        lastCheckedAt: new Date(now).toISOString(),
    });

    return latestVersion;
}

/**
 * Resolves the current-versus-latest version state for the CLI package.
 *
 * @param currentVersion Installed CLI version.
 * @param env Process environment used for registry overrides.
 * @param options Additional refresh controls.
 * @returns Version status for display or install flows.
 */
export async function getUpdateStatus(
    currentVersion: string,
    env: NodeJS.ProcessEnv,
    options?: { forceRefresh?: boolean; store?: StateStore },
): Promise<UpdateStatus> {
    const resolvedLatestVersion = await resolveLatestVersion(env, {
        forceRefresh: options?.forceRefresh,
        store: options?.store,
    });

    if (!resolvedLatestVersion && options?.forceRefresh) {
        throw new CliError(
            `Could not reach the npm registry to check the latest ${PACKAGE_NAME} version.`,
        );
    }

    const latestVersion = resolvedLatestVersion ?? currentVersion;

    return {
        currentVersion,
        latestVersion,
        isOutdated: compareSemver(currentVersion, latestVersion) < 0,
        installCommand: getInstallCommand(),
    };
}

/**
 * Renders the interactive update notice shown when a newer CLI version exists.
 *
 * @param status Outdated version status resolved from the registry.
 */
export function writeUpdateNotice(status: UpdateStatus): void {
    writeNoticeBox("Update Available", [
        `${PACKAGE_NAME} ${status.currentVersion} -> ${status.latestVersion}`,
        `Run: ${status.installCommand}`,
    ]);
}

/**
 * Checks for a newer CLI version and prints a notice when appropriate.
 *
 * The notice is intentionally skipped for JSON/quiet flows and for the update
 * command itself so machine-readable output is never polluted.
 *
 * @param options Current command execution context.
 */
export async function maybeShowUpdateNotice(
    options: MaybeNotifyOptions,
): Promise<void> {
    if (
        options.env.PEAKURL_DISABLE_UPDATE_CHECK === "1" ||
        options.commandName === "update" ||
        options.options?.json ||
        options.options?.quiet
    ) {
        return;
    }

    if (
        options.env.PEAKURL_FORCE_UPDATE_NOTICE !== "1" &&
        !process.stderr.isTTY
    ) {
        return;
    }

    const store = new StateStore();
    const updateState = await loadLatestVersionFromState(store);
    const status = await getUpdateStatus(options.currentVersion, options.env, {
        store,
    });

    if (!status.isOutdated) {
        return;
    }

    const lastNotifiedAt = readTimestamp(updateState.lastNotifiedAt);
    const alreadyNotifiedForVersion =
        updateState.lastNotifiedVersion === status.latestVersion;

    if (
        alreadyNotifiedForVersion &&
        lastNotifiedAt !== null &&
        Date.now() - lastNotifiedAt < NOTICE_TTL_MS
    ) {
        return;
    }

    await saveUpdateState(store, {
        ...updateState,
        lastNotifiedAt: new Date().toISOString(),
        lastNotifiedVersion: status.latestVersion,
    });

    writeUpdateNotice(status);
}

import { createHash } from "node:crypto";
import {
    chmod,
    copyFile,
    lstat,
    mkdir,
    mkdtemp,
    rm,
    writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { posix as pathPosix } from "node:path";
import { inflateRawSync } from "node:zlib";
import { CliError } from "./errors.js";
import { formatDetailsTable } from "./output.js";
import type { CoreDownloadResult, CoreRelease } from "../types.js";

const DEFAULT_RELEASE_API_URL = "https://api.peakurl.org/v1/update";
const DEFAULT_CORE_PACKAGE_URL = "https://peakurl.org/latest.zip";
const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const LOCAL_FILE_SIGNATURE = 0x04034b50;
const ZIP_UTF8_FLAG = 0x0800;
const ZIP_ENCRYPTED_FLAG = 0x0001;

interface ReleasePayload {
    version?: unknown;
    checksumSha256?: unknown;
    releasedAt?: unknown;
    releaseNotesUrl?: unknown;
}

interface ZipEntry {
    path: string;
    mode: number;
    isDirectory: boolean;
    compressedSize: number;
    uncompressedSize: number;
    compressionMethod: number;
    flags: number;
    localHeaderOffset: number;
}

/**
 * Resolves the release metadata feed used by `peakurl core download`.
 *
 * @param env Process environment used for test-only overrides.
 * @returns Fully-qualified update-feed URL.
 */
export function getReleaseApiUrl(env: NodeJS.ProcessEnv): string {
    const candidate = env.PEAKURL_RELEASE_API_URL?.trim();
    return validateUrl(candidate || DEFAULT_RELEASE_API_URL, "release feed");
}

/**
 * Resolves the public ZIP URL used by `peakurl core download`.
 *
 * @param env Process environment used for test-only package overrides.
 * @returns Fully-qualified package URL.
 */
export function getCorePackageUrl(env: NodeJS.ProcessEnv): string {
    const candidate = env.PEAKURL_CORE_PACKAGE_URL?.trim();
    return validateUrl(
        candidate || DEFAULT_CORE_PACKAGE_URL,
        "package download",
    );
}

function asString(value: unknown): string | undefined {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function validateUrl(value: string, label: string): string {
    let parsed: URL;

    try {
        parsed = new URL(value);
    } catch {
        throw new CliError(`PeakURL ${label} URL is invalid.`);
    }

    if (parsed.protocol === "data:") {
        return parsed.toString();
    }

    if (
        (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
        parsed.username ||
        parsed.password
    ) {
        throw new CliError(`PeakURL ${label} URL is invalid.`);
    }

    return parsed.toString();
}

function normalizeSha256(value: unknown): string {
    const candidate = asString(value)?.toLowerCase();

    if (!candidate || !/^[a-f0-9]{64}$/.test(candidate)) {
        throw new CliError(
            "PeakURL release metadata is missing a valid SHA-256 checksum.",
        );
    }

    return candidate;
}

function assertBufferRange(
    buffer: Buffer,
    offset: number,
    length: number,
    label: string,
): void {
    if (offset < 0 || length < 0 || offset + length > buffer.length) {
        throw new CliError(`PeakURL core package has an invalid ${label}.`);
    }
}

function findEndOfCentralDirectory(buffer: Buffer): number {
    const start = Math.max(0, buffer.length - 0xffff - 22);

    for (let index = buffer.length - 22; index >= start; index -= 1) {
        if (buffer.readUInt32LE(index) === EOCD_SIGNATURE) {
            return index;
        }
    }

    throw new CliError("PeakURL core package is not a valid ZIP archive.");
}

function normalizeZipPath(name: string): string {
    if (!name || name.includes("\0") || name.includes("\\")) {
        throw new CliError(
            "PeakURL core package contains an invalid file path.",
        );
    }

    const normalized = pathPosix.normalize(name);

    if (
        normalized === "." ||
        normalized === ".." ||
        normalized.startsWith("../") ||
        normalized.startsWith("/") ||
        /^[A-Za-z]:/.test(normalized)
    ) {
        throw new CliError(
            "PeakURL core package contains an unsafe file path.",
        );
    }

    return normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
}

function getZipMode(externalAttributes: number): number {
    return (externalAttributes >>> 16) & 0xffff;
}

function isSymbolicLink(mode: number): boolean {
    return (mode & 0o170000) === 0o120000;
}

function parseZipEntries(buffer: Buffer): ZipEntry[] {
    const endOfCentralDirectoryOffset = findEndOfCentralDirectory(buffer);
    const entryCount = buffer.readUInt16LE(endOfCentralDirectoryOffset + 10);
    const directoryOffset = buffer.readUInt32LE(
        endOfCentralDirectoryOffset + 16,
    );

    if (entryCount === 0xffff || directoryOffset === 0xffffffff) {
        throw new CliError(
            "PeakURL core package uses an unsupported ZIP format.",
        );
    }

    let cursor = directoryOffset;
    const entries: ZipEntry[] = [];
    const seenPaths = new Set<string>();

    for (let index = 0; index < entryCount; index += 1) {
        assertBufferRange(buffer, cursor, 46, "central directory header");

        if (buffer.readUInt32LE(cursor) !== CENTRAL_DIRECTORY_SIGNATURE) {
            throw new CliError(
                "PeakURL core package has a broken ZIP directory.",
            );
        }

        const flags = buffer.readUInt16LE(cursor + 8);
        const compressionMethod = buffer.readUInt16LE(cursor + 10);
        const compressedSize = buffer.readUInt32LE(cursor + 20);
        const uncompressedSize = buffer.readUInt32LE(cursor + 24);
        const fileNameLength = buffer.readUInt16LE(cursor + 28);
        const extraFieldLength = buffer.readUInt16LE(cursor + 30);
        const fileCommentLength = buffer.readUInt16LE(cursor + 32);
        const externalAttributes = buffer.readUInt32LE(cursor + 38);
        const localHeaderOffset = buffer.readUInt32LE(cursor + 42);
        const nameOffset = cursor + 46;

        assertBufferRange(
            buffer,
            nameOffset,
            fileNameLength + extraFieldLength + fileCommentLength,
            "central directory entry",
        );

        if (flags & ZIP_ENCRYPTED_FLAG) {
            throw new CliError(
                "PeakURL core package uses unsupported encrypted ZIP entries.",
            );
        }

        if (compressionMethod !== 0 && compressionMethod !== 8) {
            throw new CliError(
                "PeakURL core package uses an unsupported ZIP compression method.",
            );
        }

        const encoding = flags & ZIP_UTF8_FLAG ? "utf8" : "utf8";
        const rawName = buffer
            .subarray(nameOffset, nameOffset + fileNameLength)
            .toString(encoding);
        const path = normalizeZipPath(rawName);
        const mode = getZipMode(externalAttributes);
        const directory = rawName.endsWith("/");

        if (isSymbolicLink(mode)) {
            throw new CliError(
                "PeakURL core package contains unsupported symbolic links.",
            );
        }

        if (seenPaths.has(path)) {
            throw new CliError(
                "PeakURL core package contains duplicate file paths.",
            );
        }

        seenPaths.add(path);
        entries.push({
            path,
            mode,
            isDirectory: directory,
            compressedSize,
            uncompressedSize,
            compressionMethod,
            flags,
            localHeaderOffset,
        });

        cursor =
            nameOffset + fileNameLength + extraFieldLength + fileCommentLength;
    }

    return entries;
}

function getLocalFileData(buffer: Buffer, entry: ZipEntry): Buffer {
    assertBufferRange(buffer, entry.localHeaderOffset, 30, "local file header");

    if (buffer.readUInt32LE(entry.localHeaderOffset) !== LOCAL_FILE_SIGNATURE) {
        throw new CliError("PeakURL core package has a broken file header.");
    }

    const fileNameLength = buffer.readUInt16LE(entry.localHeaderOffset + 26);
    const extraFieldLength = buffer.readUInt16LE(entry.localHeaderOffset + 28);
    const dataOffset =
        entry.localHeaderOffset + 30 + fileNameLength + extraFieldLength;

    assertBufferRange(buffer, dataOffset, entry.compressedSize, "file payload");

    return buffer.subarray(dataOffset, dataOffset + entry.compressedSize);
}

function extractZipEntry(buffer: Buffer, entry: ZipEntry): Buffer {
    const compressed = getLocalFileData(buffer, entry);

    if (entry.compressionMethod === 0) {
        return compressed;
    }

    return inflateRawSync(compressed);
}

async function writeZipEntry(
    buffer: Buffer,
    entry: ZipEntry,
    targetPath: string,
): Promise<void> {
    const destinationPath = join(targetPath, entry.path);

    if (entry.isDirectory) {
        await mkdir(destinationPath, { recursive: true });
        return;
    }

    const content = extractZipEntry(buffer, entry);

    if (content.length !== entry.uncompressedSize) {
        throw new CliError(
            "PeakURL core package failed ZIP size verification.",
        );
    }

    await mkdir(dirname(destinationPath), { recursive: true });
    await writeFile(destinationPath, content);

    const mode = entry.mode & 0o777;

    if (mode > 0) {
        await chmod(destinationPath, mode);
    }
}

async function ensureNoEntryConflicts(
    entries: ZipEntry[],
    targetPath: string,
    force: boolean,
): Promise<void> {
    for (const entry of entries) {
        const destinationPath = join(targetPath, entry.path);

        try {
            const destinationStats = await lstat(destinationPath);

            if (entry.isDirectory) {
                if (!destinationStats.isDirectory()) {
                    throw new CliError(
                        `Cannot extract PeakURL core files because '${entry.path}' already exists as a file.`,
                    );
                }

                continue;
            }

            if (destinationStats.isDirectory()) {
                throw new CliError(
                    `Cannot overwrite '${entry.path}' because it already exists as a directory.`,
                );
            }

            if (!force) {
                throw new CliError(
                    `Cannot extract PeakURL core files because '${entry.path}' already exists. Re-run with --force to overwrite existing files.`,
                );
            }
        } catch (error) {
            const code = (error as NodeJS.ErrnoException).code;

            if (code !== "ENOENT") {
                throw error;
            }
        }
    }
}

async function copyExtractedEntries(
    entries: ZipEntry[],
    extractedPath: string,
    targetPath: string,
): Promise<void> {
    for (const entry of entries) {
        const sourcePath = join(extractedPath, entry.path);
        const destinationPath = join(targetPath, entry.path);

        if (entry.isDirectory) {
            await mkdir(destinationPath, { recursive: true });
            continue;
        }

        await mkdir(dirname(destinationPath), { recursive: true });
        await copyFile(sourcePath, destinationPath);

        const mode = entry.mode & 0o777;

        if (mode > 0) {
            await chmod(destinationPath, mode);
        }
    }
}

function countExtractedFiles(entries: ZipEntry[]): number {
    return entries.filter((entry) => !entry.isDirectory).length;
}

/**
 * Loads the latest PeakURL release metadata from the official update feed.
 *
 * @param env Process environment used for feed overrides during tests.
 * @returns Verified release metadata with the public package URL and checksum.
 */
export async function getCoreRelease(
    env: NodeJS.ProcessEnv,
): Promise<CoreRelease> {
    const releaseApiUrl = getReleaseApiUrl(env);
    const response = await fetch(releaseApiUrl, {
        headers: {
            accept: "application/json",
        },
        redirect: "follow",
    });

    if (!response.ok) {
        throw new CliError("PeakURL release metadata could not be loaded.");
    }

    const payload = (await response.json()) as ReleasePayload;
    const version = asString(payload.version) || "latest";

    return {
        version,
        downloadUrl: getCorePackageUrl(env),
        checksumSha256: normalizeSha256(payload.checksumSha256),
        releasedAt: asString(payload.releasedAt),
        releaseNotesUrl: asString(payload.releaseNotesUrl),
    };
}

/**
 * Downloads the latest PeakURL package, verifies its SHA-256 checksum, and
 * extracts the archive into the chosen destination directory.
 *
 * @param release Verified release metadata from the update feed.
 * @param targetPath Destination directory for the extracted package files.
 * @param force Whether existing files should be overwritten.
 * @returns Extracted file summary for human or JSON output.
 */
export async function downloadCorePackage(
    release: CoreRelease,
    targetPath: string,
    force = false,
): Promise<CoreDownloadResult> {
    const response = await fetch(release.downloadUrl, {
        headers: {
            accept: "application/zip, application/octet-stream;q=0.9, */*;q=0.1",
        },
        redirect: "follow",
    });

    if (!response.ok) {
        throw new CliError("PeakURL core package could not be downloaded.");
    }

    const archive = Buffer.from(await response.arrayBuffer());
    const checksum = createHash("sha256").update(archive).digest("hex");

    if (checksum !== release.checksumSha256) {
        throw new CliError(
            `Checksum verification failed for PeakURL ${release.version}.`,
        );
    }

    const entries = parseZipEntries(archive);
    const tempRoot = await mkdtemp(join(tmpdir(), "peakurl-core-"));
    const extractedPath = join(tempRoot, "extract");
    const absoluteTargetPath = resolve(targetPath);

    try {
        await mkdir(extractedPath, { recursive: true });

        for (const entry of entries) {
            await writeZipEntry(archive, entry, extractedPath);
        }

        await ensureNoEntryConflicts(entries, absoluteTargetPath, force);
        await copyExtractedEntries(entries, extractedPath, absoluteTargetPath);

        return {
            version: release.version,
            path: absoluteTargetPath,
            downloadUrl: release.downloadUrl,
            checksumSha256: release.checksumSha256,
            checksumVerified: true,
            fileCount: countExtractedFiles(entries),
        };
    } finally {
        await rm(tempRoot, { recursive: true, force: true });
    }
}

/**
 * Formats the installed-core summary with the same boxed table style used by
 * other human-readable PeakURL CLI commands.
 *
 * @param result Download and extraction summary.
 * @returns Table string ready for stdout.
 */
export function formatCoreDownload(result: CoreDownloadResult): string {
    return formatDetailsTable(
        [
            ["Version", result.version],
            ["Path", result.path],
            ["Checksum", "Verified (SHA-256)"],
            ["Files", String(result.fileCount)],
            ["Source", result.downloadUrl],
        ],
        "stdout",
    );
}

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, realpath, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { getCoreRelease } from "../src/lib/index.js";

function buildZip(entries: Array<{ path: string; content: string }>): Buffer {
    const fileChunks: Buffer[] = [];
    const centralChunks: Buffer[] = [];
    let offset = 0;

    for (const entry of entries) {
        const pathBuffer = Buffer.from(entry.path, "utf8");
        const dataBuffer = Buffer.from(entry.content, "utf8");
        const localHeader = Buffer.alloc(30);

        localHeader.writeUInt32LE(0x04034b50, 0);
        localHeader.writeUInt16LE(20, 4);
        localHeader.writeUInt16LE(0x0800, 6);
        localHeader.writeUInt16LE(0, 8);
        localHeader.writeUInt16LE(0, 10);
        localHeader.writeUInt16LE(0, 12);
        localHeader.writeUInt32LE(0, 14);
        localHeader.writeUInt32LE(dataBuffer.length, 18);
        localHeader.writeUInt32LE(dataBuffer.length, 22);
        localHeader.writeUInt16LE(pathBuffer.length, 26);
        localHeader.writeUInt16LE(0, 28);

        fileChunks.push(localHeader, pathBuffer, dataBuffer);

        const centralHeader = Buffer.alloc(46);

        centralHeader.writeUInt32LE(0x02014b50, 0);
        centralHeader.writeUInt16LE(20, 4);
        centralHeader.writeUInt16LE(20, 6);
        centralHeader.writeUInt16LE(0x0800, 8);
        centralHeader.writeUInt16LE(0, 10);
        centralHeader.writeUInt16LE(0, 12);
        centralHeader.writeUInt16LE(0, 14);
        centralHeader.writeUInt32LE(0, 16);
        centralHeader.writeUInt32LE(dataBuffer.length, 20);
        centralHeader.writeUInt32LE(dataBuffer.length, 24);
        centralHeader.writeUInt16LE(pathBuffer.length, 28);
        centralHeader.writeUInt16LE(0, 30);
        centralHeader.writeUInt16LE(0, 32);
        centralHeader.writeUInt16LE(0, 34);
        centralHeader.writeUInt16LE(0, 36);
        centralHeader.writeUInt32LE(0o100644 * 0x10000, 38);
        centralHeader.writeUInt32LE(offset, 42);

        centralChunks.push(centralHeader, pathBuffer);
        offset += localHeader.length + pathBuffer.length + dataBuffer.length;
    }

    const centralDirectory = Buffer.concat(centralChunks);
    const endOfCentralDirectory = Buffer.alloc(22);

    endOfCentralDirectory.writeUInt32LE(0x06054b50, 0);
    endOfCentralDirectory.writeUInt16LE(0, 4);
    endOfCentralDirectory.writeUInt16LE(0, 6);
    endOfCentralDirectory.writeUInt16LE(entries.length, 8);
    endOfCentralDirectory.writeUInt16LE(entries.length, 10);
    endOfCentralDirectory.writeUInt32LE(centralDirectory.length, 12);
    endOfCentralDirectory.writeUInt32LE(offset, 16);
    endOfCentralDirectory.writeUInt16LE(0, 20);

    return Buffer.concat([
        ...fileChunks,
        centralDirectory,
        endOfCentralDirectory,
    ]);
}

function createPackageUrl(archive: Buffer): string {
    return `data:application/zip;base64,${archive.toString("base64")}`;
}

function createReleaseFeedUrl(checksumSha256: string): string {
    const payload = JSON.stringify({
        version: "1.0.12",
        downloadUrl: "https://releases.peakurl.org/latest.zip",
        checksumSha256,
        releaseNotesUrl: "https://peakurl.org/release-notes#v1.0.12",
        releasedAt: "2026-04-10T23:27:36Z",
    });

    return `data:application/json,${encodeURIComponent(payload)}`;
}

async function runCoreDownload(
    args: string[],
    releaseApiUrl: string,
    packageUrl: string,
    cwdOverride: string,
): Promise<{ code: number; stdout: string; stderr: string; homeDir: string }> {
    const homeDir = await mkdtemp(join(tmpdir(), "peakurl-core-home-"));
    const cliPath = fileURLToPath(
        new URL("../bin/peakurl.js", import.meta.url),
    );

    return await new Promise((resolve, reject) => {
        const child = spawn("node", [cliPath, ...args], {
            cwd: cwdOverride,
            env: {
                ...process.env,
                HOME: homeDir,
                XDG_CONFIG_HOME: join(homeDir, ".config"),
                PEAKURL_BASE_URL: "",
                PEAKURL_API_KEY: "",
                PEAKURL_DISABLE_UPDATE_CHECK: "1",
                PEAKURL_RELEASE_API_URL: releaseApiUrl,
                PEAKURL_CORE_PACKAGE_URL: packageUrl,
            },
            stdio: ["ignore", "pipe", "pipe"],
        });

        let stdout = "";
        let stderr = "";

        child.stdout.on("data", (chunk) => {
            stdout += chunk.toString();
        });

        child.stderr.on("data", (chunk) => {
            stderr += chunk.toString();
        });

        child.on("error", reject);
        child.on("close", (code) => {
            resolve({ code: code ?? 1, stdout, stderr, homeDir });
        });
    });
}

describe("PeakURL CLI Core Downloads", () => {
    const archive = buildZip([
        {
            path: "index.php",
            content: "<?php\n// PeakURL release\n",
        },
        {
            path: "app/bootstrap.php",
            content: "<?php\nreturn 'boot';\n",
        },
        {
            path: "content/index.html",
            content: "<!-- PeakURL content -->\n",
        },
    ]);
    const checksumSha256 = createHash("sha256").update(archive).digest("hex");
    const packageUrl = createPackageUrl(archive);
    const releaseApiUrl = createReleaseFeedUrl(checksumSha256);

    it("uses the public core package URL by default", async () => {
        const release = await getCoreRelease({
            PEAKURL_RELEASE_API_URL: releaseApiUrl,
        });

        assert.equal(release.downloadUrl, "https://peakurl.org/latest.zip");
    });

    it("downloads and extracts the latest core package", async () => {
        const workDir = await mkdtemp(join(tmpdir(), "peakurl-core-"));
        const result = await runCoreDownload(
            ["core", "download"],
            releaseApiUrl,
            packageUrl,
            workDir,
        );

        assert.equal(result.code, 0);
        assert.match(result.stdout, /Success: PeakURL downloaded\./);
        assert.match(result.stdout, /\| Detail\s+\| Information\s+\|/);
        assert.match(result.stdout, /\| Version\s+\| 1\.0\.12\s+\|/);
        assert.match(
            result.stdout,
            /\| Checksum\s+\| Verified \(SHA-256\)\s+\|/,
        );

        assert.equal(
            await readFile(join(workDir, "index.php"), "utf8"),
            "<?php\n// PeakURL release\n",
        );
        assert.equal(
            await readFile(join(workDir, "app", "bootstrap.php"), "utf8"),
            "<?php\nreturn 'boot';\n",
        );
    });

    it("refuses to overwrite existing files without --force", async () => {
        const workDir = await mkdtemp(join(tmpdir(), "peakurl-core-"));

        await writeFile(
            join(workDir, "index.php"),
            "<?php\n// Existing\n",
            "utf8",
        );

        const result = await runCoreDownload(
            ["core", "download"],
            releaseApiUrl,
            packageUrl,
            workDir,
        );

        assert.equal(result.code, 1);
        assert.match(
            result.stderr,
            /Cannot extract PeakURL core files because 'index\.php' already exists\./,
        );
        assert.equal(
            await readFile(join(workDir, "index.php"), "utf8"),
            "<?php\n// Existing\n",
        );
    });

    it("overwrites existing files with --force", async () => {
        const workDir = await mkdtemp(join(tmpdir(), "peakurl-core-"));

        await writeFile(
            join(workDir, "index.php"),
            "<?php\n// Existing\n",
            "utf8",
        );

        const result = await runCoreDownload(
            ["core", "download", "--force", "--quiet"],
            releaseApiUrl,
            packageUrl,
            workDir,
        );

        assert.equal(result.code, 0);
        assert.equal(result.stdout.trim(), await realpath(workDir));
        assert.equal(
            await readFile(join(workDir, "index.php"), "utf8"),
            "<?php\n// PeakURL release\n",
        );
    });

    it("fails when the release checksum does not match", async () => {
        const workDir = await mkdtemp(join(tmpdir(), "peakurl-core-"));
        const badReleaseApiUrl = createReleaseFeedUrl(
            "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        );
        const result = await runCoreDownload(
            ["core", "download"],
            badReleaseApiUrl,
            packageUrl,
            workDir,
        );

        assert.equal(result.code, 1);
        assert.match(
            result.stderr,
            /Checksum verification failed for PeakURL 1\.0\.12\./,
        );

        await assert.rejects(() =>
            readFile(join(workDir, "index.php"), "utf8"),
        );
    });
});

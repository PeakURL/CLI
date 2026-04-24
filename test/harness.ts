import { after, before } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import {
    createServer,
    type IncomingMessage,
    type ServerResponse,
} from "node:http";
import { fileURLToPath } from "node:url";

export const VALID_TOKEN = "0123456789abcdef0123456789abcdef0123456789abcdef";

const mockUser = {
    id: "user_123",
    username: "peak",
    email: "peak@example.com",
    firstName: "Peak",
    lastName: "URL",
    role: "admin",
};

const mockLink = {
    id: "url_123",
    alias: "launch",
    shortUrl: "https://peakurl.test/launch",
    destinationUrl: "https://example.com/launch",
    title: "Launch",
    status: "active",
    clicks: 3,
    uniqueClicks: 2,
    expiresAt: "2026-05-01T00:00:00.000Z",
    createdAt: "2026-04-19T20:00:00.000Z",
    updatedAt: "2026-04-19T20:00:00.000Z",
};

const mockWebhook = {
    id: "webhook_123",
    url: "https://example.com/api/webhooks/peakurl",
    events: ["link.clicked"],
    secretHint: "whsec_12345••••••••••••••••••",
    isActive: true,
    createdAt: "2026-04-19T20:00:00.000Z",
};

const mockSystemStatus = {
    generatedAt: "2026-04-20T12:00:00.000Z",
    summary: {
        overall: "warning",
        okCount: 6,
        warningCount: 2,
        errorCount: 0,
        totalChecks: 8,
    },
    checks: [
        {
            id: "database",
            label: "Database connection",
            status: "ok",
            description:
                "PeakURL can reach the configured MySQL or MariaDB database.",
        },
        {
            id: "mail",
            label: "Email transport",
            status: "warning",
            description:
                "PeakURL is missing part of the active mail transport configuration.",
        },
    ],
    site: {
        name: "PeakURL Test Site",
        url: "https://peakurl.test",
        version: "1.0.14",
        environment: "development",
        installType: "source",
        debugEnabled: true,
        locale: "en_GB",
        htmlLang: "en-GB",
        languageLabel: "English (United Kingdom)",
        languageNativeName: "English (United Kingdom)",
        installedLanguagesCount: 1,
        defaultLocale: "en_US",
    },
    server: {
        phpVersion: "8.3.7",
        phpSapi: "fpm-fcgi",
        serverSoftware: "nginx/1.27.0",
        operatingSystem: "Linux",
        timezone: "UTC",
        memoryLimit: "256M",
        maxExecutionTime: 30,
        uploadMaxFilesize: "64M",
        postMaxSize: "64M",
        extensions: {
            intl: true,
            curl: true,
            zip: true,
        },
    },
    database: {
        connected: true,
        serverType: "MariaDB",
        version: "11.4.2",
        host: "db",
        port: 3306,
        name: "peakurl",
        charset: "utf8mb4",
        prefix: "pk_",
        schemaVersion: 14,
        requiredSchemaVersion: 14,
        schemaCompatible: true,
        schemaUpgradeRequired: false,
        schemaIssuesCount: 0,
    },
    storage: {
        contentDirectory: "/var/www/html/content",
        contentExists: true,
        contentWritable: true,
        contentDirectorySizeBytes: 4096,
        languagesDirectory: "/var/www/html/content/languages",
        languagesDirectoryExists: true,
        languagesDirectoryReadable: true,
        languagesDirectorySizeBytes: 2048,
        configPath: "/var/www/html/config.php",
        configExists: true,
        configSizeBytes: 512,
        appDirectory: "/var/www/html/app",
        appWritable: false,
        appDirectorySizeBytes: 10240,
        releaseRoot: "/var/www/html",
        releaseRootSizeBytes: 65536,
    },
    mail: {
        driver: "smtp",
        transportReady: false,
        fromEmail: "hello@example.com",
        fromName: "PeakURL",
        smtpHost: "smtp.example.com",
        smtpPort: "587",
        smtpEncryption: "tls",
        smtpAuth: true,
        configurationLabel: "SMTP",
    },
    location: {
        locationAnalyticsReady: true,
        lastDownloadedAt: "2026-04-18T10:00:00.000Z",
        databaseUpdatedAt: "2026-04-18T10:00:00.000Z",
        databaseSizeBytes: 1048576,
        credentialsConfigured: true,
        accountId: "1001",
        databasePath: "/var/www/html/content/uploads/geoip/GeoLite2-City.mmdb",
        databaseReadable: true,
        downloadCommand: "php app/bin/update-geoip.php",
    },
    data: {
        users: 1,
        links: 1,
        clicks: 3,
        sessions: 2,
        apiKeys: 1,
        webhooks: 1,
        auditEvents: 4,
        managedTables: 9,
    },
};

let siteUrl = "";
let apiBaseUrl = "";
let cliVersion = "";
let server: ReturnType<typeof createServer>;
let mockReleaseArchive: ReturnType<typeof buildZip>;
let mockReleaseChecksum = "";

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

function getNextVersion(version: string): string {
    const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);

    if (!match) {
        return version;
    }

    const major = Number.parseInt(match[1], 10);
    const minor = Number.parseInt(match[2], 10);
    const patch = Number.parseInt(match[3], 10) + 1;

    return `${major}.${minor}.${patch}`;
}

function sendJsonResponse(
    response: ServerResponse,
    statusCode: number,
    payload: unknown,
): void {
    response.statusCode = statusCode;
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify(payload));
}

async function parseRequestJsonBody(
    request: IncomingMessage,
): Promise<unknown> {
    const chunks: Buffer[] = [];

    for await (const chunk of request) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    const text = Buffer.concat(chunks).toString("utf8");
    return text ? (JSON.parse(text) as unknown) : {};
}

function successEnvelope(message: string, data: unknown) {
    return {
        success: true,
        message,
        data,
        timestamp: "2026-04-19T20:00:00.000Z",
    };
}

export function configPathForHome(homeDir: string): string {
    switch (process.platform) {
        case "darwin":
            return join(
                homeDir,
                "Library",
                "Preferences",
                "peakurl",
                "config.json",
            );
        case "win32":
            return join(
                homeDir,
                "AppData",
                "Roaming",
                "peakurl",
                "Config",
                "config.json",
            );
        default:
            return join(homeDir, ".config", "peakurl", "config.json");
    }
}

export function escapeForRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function mockSiteUrl(): string {
    assert.ok(siteUrl, "Mock CLI site URL is not initialized yet.");
    return siteUrl;
}

export function mockApiBaseUrl(): string {
    assert.ok(apiBaseUrl, "Mock CLI API base URL is not initialized yet.");
    return apiBaseUrl;
}

export function getCliVersion(): string {
    assert.ok(cliVersion, "CLI version is not initialized yet.");
    return cliVersion;
}

export function getLatestCliVersion(): string {
    return getNextVersion(getCliVersion());
}

before(async () => {
    const packageJson = JSON.parse(
        await readFile(new URL("../package.json", import.meta.url), "utf8"),
    ) as { version: string };

    cliVersion = packageJson.version;
    mockReleaseArchive = buildZip([
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
    mockReleaseChecksum = createHash("sha256")
        .update(mockReleaseArchive)
        .digest("hex");

    server = createServer(async (request, response) => {
        const url = new URL(
            request.url || "/",
            `http://${request.headers.host}`,
        );

        if (request.method === "GET" && url.pathname === "/v1/update") {
            sendJsonResponse(response, 200, {
                version: "1.0.12",
                downloadUrl: `${mockSiteUrl()}/releases/latest.zip`,
                checksumSha256: mockReleaseChecksum,
                releaseNotesUrl: "https://peakurl.org/release-notes#v1.0.12",
                releasedAt: "2026-04-10T23:27:36Z",
            });
            return;
        }

        if (
            request.method === "GET" &&
            url.pathname === "/v1/update-bad-checksum"
        ) {
            sendJsonResponse(response, 200, {
                version: "1.0.12",
                downloadUrl: `${mockSiteUrl()}/releases/latest.zip`,
                checksumSha256:
                    "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                releaseNotesUrl: "https://peakurl.org/release-notes#v1.0.12",
                releasedAt: "2026-04-10T23:27:36Z",
            });
            return;
        }

        if (
            request.method === "GET" &&
            url.pathname === "/releases/latest.zip"
        ) {
            response.statusCode = 200;
            response.setHeader("content-type", "application/zip");
            response.end(mockReleaseArchive);
            return;
        }

        if (request.method === "GET" && url.pathname === "/api/v1/users/me") {
            sendJsonResponse(
                response,
                200,
                successEnvelope("Current user loaded.", mockUser),
            );
            return;
        }

        if (
            request.method === "GET" &&
            url.pathname === "/npm-registry/peakurl/latest"
        ) {
            sendJsonResponse(response, 200, {
                name: "peakurl",
                version: getLatestCliVersion(),
            });
            return;
        }

        const authHeader = request.headers.authorization;

        if (authHeader !== `Bearer ${VALID_TOKEN}`) {
            sendJsonResponse(response, 401, {
                success: false,
                message: "Unauthorized",
                data: null,
                timestamp: "2026-04-19T20:00:00.000Z",
            });
            return;
        }

        if (request.method === "POST" && url.pathname === "/api/v1/urls") {
            const body = (await parseRequestJsonBody(request)) as Record<
                string,
                unknown
            >;
            sendJsonResponse(
                response,
                201,
                successEnvelope("Short URL created.", {
                    ...mockLink,
                    ...body,
                }),
            );
            return;
        }

        if (request.method === "GET" && url.pathname === "/api/v1/urls") {
            sendJsonResponse(
                response,
                200,
                successEnvelope("URLs loaded.", {
                    items: [mockLink],
                    meta: {
                        page: 1,
                        limit: 25,
                        totalItems: 1,
                        totalPages: 1,
                    },
                }),
            );
            return;
        }

        if (
            request.method === "GET" &&
            url.pathname === "/api/v1/urls/export"
        ) {
            sendJsonResponse(
                response,
                200,
                successEnvelope("URLs export loaded.", {
                    items: [mockLink],
                    meta: {
                        totalItems: 1,
                    },
                }),
            );
            return;
        }

        if (
            request.method === "GET" &&
            url.pathname === "/api/v1/system/status"
        ) {
            sendJsonResponse(
                response,
                200,
                successEnvelope("System status loaded.", mockSystemStatus),
            );
            return;
        }

        if (request.method === "GET" && url.pathname === "/api/v1/webhooks") {
            sendJsonResponse(
                response,
                200,
                successEnvelope("Webhooks loaded.", [mockWebhook]),
            );
            return;
        }

        if (
            request.method === "GET" &&
            (url.pathname === `/api/v1/urls/${mockLink.alias}` ||
                url.pathname === `/api/v1/urls/${mockLink.id}`)
        ) {
            sendJsonResponse(
                response,
                200,
                successEnvelope("URL loaded.", mockLink),
            );
            return;
        }

        if (request.method === "POST" && url.pathname === "/api/v1/webhooks") {
            const body = (await parseRequestJsonBody(request)) as Record<
                string,
                unknown
            >;
            sendJsonResponse(
                response,
                201,
                successEnvelope("Webhook created.", {
                    id: "webhook_new",
                    url: String(body.url ?? mockWebhook.url),
                    events: Array.isArray(body.events)
                        ? body.events
                        : mockWebhook.events,
                    secret: "whsec_createdsecret1234567890",
                    secretHint: "whsec_crea••••••••••••••••••",
                    isActive: true,
                    createdAt: "2026-04-19T20:00:00.000Z",
                }),
            );
            return;
        }

        if (request.method === "POST" && url.pathname === "/api/v1/urls/bulk") {
            const body = (await parseRequestJsonBody(request)) as {
                urls?: Array<Record<string, unknown>>;
            };
            const urls = Array.isArray(body.urls) ? body.urls : [];
            const results = urls.map((item, index) => {
                const alias =
                    typeof item.alias === "string" && item.alias.trim()
                        ? item.alias.trim()
                        : `import-${index + 1}`;

                return {
                    ...mockLink,
                    id: `url_import_${index + 1}`,
                    alias,
                    shortCode: alias,
                    shortUrl: `https://peakurl.test/${alias}`,
                    destinationUrl: String(item.destinationUrl ?? ""),
                    title:
                        typeof item.title === "string"
                            ? item.title
                            : mockLink.title,
                    status:
                        typeof item.status === "string"
                            ? item.status
                            : mockLink.status,
                    expiresAt:
                        typeof item.expiresAt === "string"
                            ? item.expiresAt
                            : mockLink.expiresAt,
                };
            });

            sendJsonResponse(
                response,
                200,
                successEnvelope("Bulk import processed.", {
                    results,
                    errors: [],
                }),
            );
            return;
        }

        if (
            request.method === "DELETE" &&
            url.pathname === `/api/v1/urls/${mockLink.id}`
        ) {
            sendJsonResponse(
                response,
                200,
                successEnvelope("URL deleted.", null),
            );
            return;
        }

        if (
            request.method === "DELETE" &&
            (url.pathname === `/api/v1/webhooks/${mockWebhook.id}` ||
                url.pathname === "/api/v1/webhooks/webhook_new")
        ) {
            sendJsonResponse(
                response,
                200,
                successEnvelope("Webhook deleted.", { deleted: true }),
            );
            return;
        }

        sendJsonResponse(response, 404, {
            success: false,
            message: "Not found",
            data: null,
            timestamp: "2026-04-19T20:00:00.000Z",
        });
    });

    await new Promise<void>((resolve) => {
        server.listen(0, "127.0.0.1", () => resolve());
    });

    const address = server.address();

    if (!address || typeof address === "string") {
        throw new Error("Could not determine mock server address.");
    }

    siteUrl = `http://127.0.0.1:${address.port}`;
    apiBaseUrl = `${siteUrl}/api/v1`;
});

after(async () => {
    if (!server) {
        return;
    }

    await new Promise<void>((resolve, reject) => {
        server.close((error) => {
            if (error) {
                reject(error);
                return;
            }

            resolve();
        });
    });
});

export async function runCli(
    args: string[],
    extraEnv: Record<string, string> = {},
    homeDirOverride?: string,
    cwdOverride?: string,
): Promise<{ code: number; stdout: string; stderr: string; homeDir: string }> {
    const homeDir =
        homeDirOverride ||
        join(
            tmpdir(),
            `peakurl-cli-test-${Math.random().toString(36).slice(2)}`,
        );
    await mkdir(homeDir, { recursive: true });

    const cliPath = fileURLToPath(
        new URL("../bin/peakurl.js", import.meta.url),
    );

    return await new Promise((resolve, reject) => {
        const child = spawn("node", [cliPath, ...args], {
            cwd: cwdOverride || process.cwd(),
            env: {
                ...process.env,
                HOME: homeDir,
                XDG_CONFIG_HOME: join(homeDir, ".config"),
                PEAKURL_BASE_URL: mockApiBaseUrl(),
                PEAKURL_API_KEY: VALID_TOKEN,
                PEAKURL_DISABLE_UPDATE_CHECK: "1",
                ...extraEnv,
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

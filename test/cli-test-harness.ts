import { after, before } from "node:test";
import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import {
    createServer,
    type IncomingMessage,
    type ServerResponse,
} from "node:http";

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
    createdAt: "2026-04-19T20:00:00.000Z",
    updatedAt: "2026-04-19T20:00:00.000Z",
};

let baseUrl = "";
let cliVersion = "";
let server: ReturnType<typeof createServer>;

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
): Promise<Record<string, unknown>> {
    const chunks: Buffer[] = [];

    for await (const chunk of request) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    const text = Buffer.concat(chunks).toString("utf8");
    return text ? (JSON.parse(text) as Record<string, unknown>) : {};
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

export function mockBaseUrl(): string {
    assert.ok(baseUrl, "Mock CLI base URL is not initialized yet.");
    return baseUrl;
}

export function getCliVersion(): string {
    assert.ok(cliVersion, "CLI version is not initialized yet.");
    return cliVersion;
}

before(async () => {
    const packageJson = JSON.parse(
        await readFile(new URL("../package.json", import.meta.url), "utf8"),
    ) as { version: string };

    cliVersion = packageJson.version;

    server = createServer(async (request, response) => {
        const url = new URL(
            request.url || "/",
            `http://${request.headers.host}`,
        );

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
                version: "0.2.0",
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
            const body = await parseRequestJsonBody(request);
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

    baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
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
): Promise<{ code: number; stdout: string; stderr: string; homeDir: string }> {
    const homeDir =
        homeDirOverride ||
        join(
            tmpdir(),
            `peakurl-cli-test-${Math.random().toString(36).slice(2)}`,
        );
    await mkdir(homeDir, { recursive: true });

    return await new Promise((resolve, reject) => {
        const child = spawn("node", ["bin/peakurl.js", ...args], {
            cwd: process.cwd(),
            env: {
                ...process.env,
                HOME: homeDir,
                XDG_CONFIG_HOME: join(homeDir, ".config"),
                PEAKURL_BASE_URL: mockBaseUrl(),
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

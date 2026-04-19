import { after, before, describe, it } from "node:test";
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

const VALID_TOKEN = "0123456789abcdef0123456789abcdef0123456789abcdef";

const user = {
    id: "user_123",
    username: "peak",
    email: "peak@example.com",
    firstName: "Peak",
    lastName: "URL",
    role: "admin",
};

const link = {
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
let server: ReturnType<typeof createServer>;

function sendJson(
    response: ServerResponse,
    statusCode: number,
    payload: unknown,
): void {
    response.statusCode = statusCode;
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify(payload));
}

async function readJson(
    request: IncomingMessage,
): Promise<Record<string, unknown>> {
    const chunks: Buffer[] = [];

    for await (const chunk of request) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    const text = Buffer.concat(chunks).toString("utf8");
    return text ? (JSON.parse(text) as Record<string, unknown>) : {};
}

function createEnvelope(message: string, data: unknown) {
    return {
        success: true,
        message,
        data,
        timestamp: "2026-04-19T20:00:00.000Z",
    };
}

function resolveConfigPath(homeDir: string): string {
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

before(async () => {
    server = createServer(async (request, response) => {
        const url = new URL(
            request.url || "/",
            `http://${request.headers.host}`,
        );
        const authHeader = request.headers.authorization;

        if (authHeader !== `Bearer ${VALID_TOKEN}`) {
            sendJson(response, 401, {
                success: false,
                message: "Unauthorized",
                data: null,
                timestamp: "2026-04-19T20:00:00.000Z",
            });
            return;
        }

        if (request.method === "GET" && url.pathname === "/api/v1/users/me") {
            sendJson(
                response,
                200,
                createEnvelope("Current user loaded.", user),
            );
            return;
        }

        if (request.method === "POST" && url.pathname === "/api/v1/urls") {
            const body = await readJson(request);
            sendJson(
                response,
                201,
                createEnvelope("Short URL created.", {
                    ...link,
                    ...body,
                }),
            );
            return;
        }

        if (request.method === "GET" && url.pathname === "/api/v1/urls") {
            sendJson(
                response,
                200,
                createEnvelope("URLs loaded.", {
                    items: [link],
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
            (url.pathname === `/api/v1/urls/${link.alias}` ||
                url.pathname === `/api/v1/urls/${link.id}`)
        ) {
            sendJson(response, 200, createEnvelope("URL loaded.", link));
            return;
        }

        if (
            request.method === "DELETE" &&
            url.pathname === `/api/v1/urls/${link.id}`
        ) {
            sendJson(response, 200, createEnvelope("URL deleted.", null));
            return;
        }

        sendJson(response, 404, {
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

async function runCli(
    args: string[],
    extraEnv: Record<string, string> = {},
): Promise<{ code: number; stdout: string; stderr: string; homeDir: string }> {
    const homeDir = join(
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
                PEAKURL_BASE_URL: baseUrl,
                PEAKURL_API_KEY: VALID_TOKEN,
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

describe("peakurl CLI", () => {
    it("shows help output", async () => {
        const result = await runCli(["--help"]);

        assert.equal(result.code, 0);
        assert.match(result.stdout, /PeakURL command-line interface/);
        assert.match(result.stdout, /login/);
        assert.match(result.stdout, /create/);
    });

    it("logs in and saves config", async () => {
        const result = await runCli(["login"]);

        assert.equal(result.code, 0);
        assert.match(result.stdout, /Saved credentials/);
        assert.match(result.stdout, /Authenticated as Peak URL/);

        const configPath = resolveConfigPath(result.homeDir);
        const savedConfig = JSON.parse(await readFile(configPath, "utf8")) as {
            baseUrl: string;
            apiKey: string;
        };

        assert.equal(savedConfig.baseUrl, baseUrl);
        assert.equal(savedConfig.apiKey, VALID_TOKEN);
    });

    it("normalizes a dashboard baseApiUrl during login", async () => {
        const result = await runCli([
            "login",
            "--base-url",
            `${baseUrl}/api/v1`,
        ]);

        assert.equal(result.code, 0);

        const configPath = resolveConfigPath(result.homeDir);
        const savedConfig = JSON.parse(await readFile(configPath, "utf8")) as {
            baseUrl: string;
            apiKey: string;
        };

        assert.equal(savedConfig.baseUrl, baseUrl);
    });

    it("creates a link", async () => {
        const result = await runCli([
            "create",
            "https://example.com/launch",
            "--alias",
            "launch",
        ]);

        assert.equal(result.code, 0);
        assert.match(result.stdout, /Short URL created/);
        assert.match(result.stdout, /https:\/\/peakurl\.test\/launch/);
    });

    it("lists links", async () => {
        const result = await runCli(["list"]);

        assert.equal(result.code, 0);
        assert.match(result.stdout, /URLs loaded/);
        assert.match(result.stdout, /launch/);
        assert.match(result.stdout, /https:\/\/example\.com\/launch/);
        assert.match(result.stdout, /Page 1 of 1\. 1 total link\./);
    });

    it("deletes a link by alias by resolving the backing id first", async () => {
        const result = await runCli(["delete", "launch"]);

        assert.equal(result.code, 0);
        assert.match(result.stdout, /URL deleted/);
    });

    it("prints json output", async () => {
        const result = await runCli(["whoami", "--json"]);

        assert.equal(result.code, 0);

        const parsed = JSON.parse(result.stdout) as {
            success: boolean;
            data: { username: string };
        };

        assert.equal(parsed.success, true);
        assert.equal(parsed.data.username, "peak");
    });
});

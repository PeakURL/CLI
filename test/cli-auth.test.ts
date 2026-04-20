import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
    configPathForHome,
    mockBaseUrl,
    runCli,
    VALID_TOKEN,
} from "./cli-test-harness.js";

describe("PeakURL CLI Authentication", () => {
    it("prints the global help output", async () => {
        const result = await runCli(["--help"]);

        assert.equal(result.code, 0);
        assert.match(result.stdout, /PeakURL command-line interface/);
        assert.match(result.stdout, /login/);
        assert.match(result.stdout, /logout/);
        assert.match(result.stdout, /create/);
    });

    it("persists verified credentials to the config file", async () => {
        const result = await runCli(["login"]);

        assert.equal(result.code, 0);
        assert.match(result.stdout, /Saved credentials/);
        assert.match(result.stdout, /Authenticated as Peak URL/);

        const configPath = configPathForHome(result.homeDir);
        const savedConfig = JSON.parse(await readFile(configPath, "utf8")) as {
            baseUrl: string;
            apiKey: string;
        };

        assert.equal(savedConfig.baseUrl, mockBaseUrl());
        assert.equal(savedConfig.apiKey, VALID_TOKEN);
    });

    it("normalizes dashboard API URLs during login", async () => {
        const result = await runCli([
            "login",
            "--base-url",
            `${mockBaseUrl()}/api/v1`,
        ]);

        assert.equal(result.code, 0);

        const configPath = configPathForHome(result.homeDir);
        const savedConfig = JSON.parse(await readFile(configPath, "utf8")) as {
            baseUrl: string;
            apiKey: string;
        };

        assert.equal(savedConfig.baseUrl, mockBaseUrl());
    });

    it("returns the authenticated user as JSON", async () => {
        const result = await runCli(["whoami", "--json"]);

        assert.equal(result.code, 0);

        const parsed = JSON.parse(result.stdout) as {
            success: boolean;
            data: { username: string };
        };

        assert.equal(parsed.success, true);
        assert.equal(parsed.data.username, "peak");
    });

    it("renders the current user in a table by default", async () => {
        const result = await runCli(["whoami"]);

        assert.equal(result.code, 0);
        assert.match(result.stdout, /Current user loaded\./);
        assert.match(result.stdout, /\| Field\s+\| Value\s+\|/);
        assert.match(result.stdout, /\| Name\s+\| Peak URL\s+\|/);
        assert.match(result.stdout, /\| Username\s+\| peak\s+\|/);
    });

    it("logs out by removing the saved config file", async () => {
        const login = await runCli(["login"]);

        assert.equal(login.code, 0);

        const logout = await runCli(
            ["logout"],
            {
                PEAKURL_BASE_URL: "",
                PEAKURL_API_KEY: "",
            },
            login.homeDir,
        );

        assert.equal(logout.code, 0);
        assert.match(
            logout.stdout,
            /Logged out\. Removed saved credentials for /,
        );

        const configPath = configPathForHome(login.homeDir);

        await assert.rejects(() => readFile(configPath, "utf8"));
    });

    it("shows auth guidance in a table when no credentials are configured", async () => {
        const result = await runCli(["whoami"], {
            PEAKURL_BASE_URL: "",
            PEAKURL_API_KEY: "",
        });

        assert.equal(result.code, 1);
        assert.match(result.stderr, /Not logged in\./);
        assert.match(result.stderr, /\| Field\s+\| Value\s+\|/);
        assert.match(
            result.stderr,
            /\| Reason\s+\| PeakURL credentials are not configured\.\s+\|/,
        );
        assert.match(result.stderr, /PeakURL credentials are not configured\./);
        assert.match(result.stderr, /\| Command\s+\| peakurl login\s+\|/);
        assert.match(
            result.stderr,
            /\| Flags\s+\| --base-url <url> --api-key <key>\s+\|/,
        );
    });
});

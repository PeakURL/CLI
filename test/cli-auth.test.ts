import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
    configPathForHome,
    mockApiBaseUrl,
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
            apiBaseUrl: string;
            apiKey: string;
        };

        assert.equal(savedConfig.apiBaseUrl, mockApiBaseUrl());
        assert.equal(savedConfig.apiKey, VALID_TOKEN);
    });

    it("stores the API base URL exactly as provided", async () => {
        const result = await runCli(["login", "--base-url", mockApiBaseUrl()]);

        assert.equal(result.code, 0);

        const configPath = configPathForHome(result.homeDir);
        const savedConfig = JSON.parse(await readFile(configPath, "utf8")) as {
            apiBaseUrl: string;
            apiKey: string;
        };

        assert.equal(savedConfig.apiBaseUrl, mockApiBaseUrl());
    });

    it("requires the explicit API base URL during login", async () => {
        const result = await runCli(
            ["login", "--base-url", "http://127.0.0.1:65535"],
            {
                PEAKURL_BASE_URL: "",
                PEAKURL_API_KEY: VALID_TOKEN,
            },
        );

        assert.equal(result.code, 1);
        assert.match(
            result.stderr,
            /PeakURL API base URL must end with \/api\/v1\./,
        );
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

    it("shows explicit login guidance when no credentials are configured", async () => {
        const result = await runCli(["whoami"], {
            PEAKURL_BASE_URL: "",
            PEAKURL_API_KEY: "",
        });

        assert.equal(result.code, 1);
        assert.match(result.stderr, /Authentication required\./);
        assert.match(
            result.stderr,
            /PeakURL could not find credentials for this command\./,
        );
        assert.match(
            result.stderr,
            /Use one of the first two steps below, then run the last command\./,
        );
        assert.match(result.stderr, /\| Step\s+\| Command\s+\| Notes\s+\|/);
        assert.match(
            result.stderr,
            /\| Save credentials\s+\| peakurl login --base-url https:\/\/example\.com\/api\/v1\s+\| Regular use on this machine\s+\|/,
        );
        assert.match(result.stderr, /\| --api-key YOUR_API_KEY\s+\|/);
        assert.match(
            result.stderr,
            /\| Set environment variables\s+\| PEAKURL_BASE_URL=https:\/\/example\.com\/api\/v1\s+\| CI, scripts, or one-off use\s+\|/,
        );
        assert.match(result.stderr, /\| PEAKURL_API_KEY=YOUR_API_KEY\s+\|/);
        assert.match(
            result.stderr,
            /\| Then run\s+\| peakurl whoami\s+\| After completing one of the steps above\s+\|/,
        );
    });

    it("shows the command to retry after logging in", async () => {
        const result = await runCli(["list"], {
            PEAKURL_BASE_URL: "",
            PEAKURL_API_KEY: "",
        });

        assert.equal(result.code, 1);
        assert.match(
            result.stderr,
            /\| Then run\s+\| peakurl list\s+\| After completing one of the steps above\s+\|/,
        );
        assert.match(
            result.stderr,
            /PEAKURL_BASE_URL=https:\/\/example\.com\/api\/v1/,
        );
    });
});

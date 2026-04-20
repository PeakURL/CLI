import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    escapeForRegExp,
    getCliVersion,
    getLatestCliVersion,
    mockSiteUrl,
    runCli,
} from "./cli-test-harness.js";

describe("PeakURL CLI Update Checks", () => {
    it("shows an update notice when a newer release is available", async () => {
        const result = await runCli(["whoami"], {
            PEAKURL_DISABLE_UPDATE_CHECK: "0",
            PEAKURL_FORCE_UPDATE_NOTICE: "1",
            PEAKURL_NPM_REGISTRY_URL: `${mockSiteUrl()}/npm-registry`,
        });

        assert.equal(result.code, 0);
        assert.match(result.stderr, /Update Available/);
        assert.match(
            result.stderr,
            new RegExp(
                `peakurl ${escapeForRegExp(getCliVersion())} -> ${escapeForRegExp(getLatestCliVersion())}`,
            ),
        );
        assert.match(result.stderr, /Run: npm install -g peakurl@latest/);
    });

    it("returns update status as JSON without installing", async () => {
        const result = await runCli(["update", "--check", "--json"], {
            PEAKURL_NPM_REGISTRY_URL: `${mockSiteUrl()}/npm-registry`,
        });

        assert.equal(result.code, 0);

        const parsed = JSON.parse(result.stdout) as {
            success: boolean;
            data: {
                currentVersion: string;
                latestVersion: string;
                isOutdated: boolean;
                installCommand: string;
                checkOnly: boolean;
            };
        };

        assert.equal(parsed.success, true);
        assert.equal(parsed.data.currentVersion, getCliVersion());
        assert.equal(parsed.data.latestVersion, getLatestCliVersion());
        assert.equal(parsed.data.isOutdated, true);
        assert.equal(parsed.data.checkOnly, true);
        assert.match(parsed.data.installCommand, /peakurl@latest/);
    });

    it("prints the recommended update command without installing", async () => {
        const result = await runCli(["update"], {
            PEAKURL_NPM_REGISTRY_URL: `${mockSiteUrl()}/npm-registry`,
        });

        assert.equal(result.code, 0);
        assert.match(result.stdout, /Update Available/);
        assert.match(
            result.stdout,
            new RegExp(
                `peakurl ${escapeForRegExp(getCliVersion())} -> ${escapeForRegExp(getLatestCliVersion())}`,
            ),
        );
        assert.match(result.stdout, /Run: npm install -g peakurl@latest/);
    });
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { escapeForRegExp, runCli } from "./harness.js";

describe("PeakURL CLI Webhooks", () => {
    it("lists webhooks in human-readable output", async () => {
        const result = await runCli(["webhook", "list"]);

        assert.equal(result.code, 0);
        assert.match(result.stdout, /Webhooks loaded\./);
        assert.match(result.stdout, /\| ID\s+\| URL\s+\| Events\s+\| Status/);
        assert.match(
            result.stdout,
            new RegExp(
                escapeForRegExp("https://example.com/api/webhooks/peakurl"),
            ),
        );
        assert.match(result.stdout, /1 webhook returned\./);
    });

    it("creates a webhook and prints the one-time signing secret", async () => {
        const url = "https://hooks.example.com/peakurl";
        const result = await runCli([
            "webhook",
            "create",
            url,
            "--event",
            "link.clicked",
            "--event",
            "link.created",
        ]);

        assert.equal(result.code, 0);
        assert.match(result.stdout, /Webhook created\./);
        assert.match(result.stdout, new RegExp(escapeForRegExp(url)));
        assert.match(result.stdout, /whsec_createdsecret1234567890/);
        assert.match(
            result.stdout,
            /Save the signing secret now\. PeakURL only shows it once\./,
        );
    });

    it("deletes a webhook by id", async () => {
        const result = await runCli(["webhook", "delete", "webhook_123"]);

        assert.equal(result.code, 0);
        assert.match(result.stdout, /Webhook deleted\./);
    });

    it("lists supported webhook events", async () => {
        const result = await runCli(["webhook", "events"]);

        assert.equal(result.code, 0);
        assert.match(result.stdout, /Webhook events loaded\./);
        assert.match(result.stdout, /link\.clicked/);
        assert.match(result.stdout, /Link Clicked/);
    });

    it("shows the nested retry command when webhook auth is missing", async () => {
        const result = await runCli(["webhook", "list"], {
            PEAKURL_BASE_URL: "",
            PEAKURL_API_KEY: "",
        });

        assert.equal(result.code, 1);
        assert.match(result.stderr, /peakurl webhook list/);
    });
});

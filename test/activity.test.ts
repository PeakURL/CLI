import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runCli } from "./harness.js";

describe("PeakURL CLI Activity Management", () => {
    it("lists activity records in human-readable output", async () => {
        const result = await runCli(["activity", "list"]);

        assert.equal(result.code, 0);
        assert.match(result.stdout, /Activity history loaded\./);
        assert.match(result.stdout, /act_123/);
        assert.match(result.stdout, /link\.created/);
        assert.match(result.stdout, /Page 1 of 1\. 1 total activity record\./);
    });

    it("lists activity records as JSON", async () => {
        const result = await runCli(["activity", "list", "--json"]);

        assert.equal(result.code, 0);
        const parsed = JSON.parse(result.stdout) as {
            success: boolean;
            data: { items: { id: string }[] };
        };
        assert.equal(parsed.success, true);
        assert.equal(parsed.data.items[0].id, "act_123");
    });

    it("deletes a single activity record by ID", async () => {
        const result = await runCli(["activity", "delete", "act_123"]);

        assert.equal(result.code, 0);
        assert.match(result.stdout, /Activity log deleted\./);
    });

    it("deletes multiple activity records in bulk", async () => {
        const result = await runCli([
            "activity",
            "delete",
            "act_123",
            "act_456",
        ]);

        assert.equal(result.code, 0);
        assert.match(result.stdout, /Bulk activity delete complete\./);
    });

    it("clears all activity records with activity clear", async () => {
        const result = await runCli(["activity", "clear"]);

        assert.equal(result.code, 0);
        assert.match(result.stdout, /All activity logs deleted\./);
    });

    it("clears all activity records with activity delete --all", async () => {
        const result = await runCli(["activity", "delete", "--all"]);

        assert.equal(result.code, 0);
        assert.match(result.stdout, /All activity logs deleted\./);
    });
});

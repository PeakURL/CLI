import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runCli } from "./harness.js";

describe("PeakURL CLI System Status", () => {
    it("renders the current system status in section tables", async () => {
        const result = await runCli(["status"]);

        assert.equal(result.code, 0);
        assert.match(result.stdout, /System status loaded\./);
        assert.match(result.stdout, /Summary/);
        assert.match(result.stdout, /\| Overall\s+\| Warning\s+\|/);
        assert.match(result.stdout, /Checks/);
        assert.match(result.stdout, /Database connection/);
        assert.match(result.stdout, /Site/);
        assert.match(result.stdout, /PeakURL Test Site/);
        assert.match(result.stdout, /Database/);
        assert.match(result.stdout, /MariaDB/);
    });

    it("returns the raw status envelope as JSON", async () => {
        const result = await runCli(["status", "--json"]);

        assert.equal(result.code, 0);

        const parsed = JSON.parse(result.stdout) as {
            success: boolean;
            data: {
                summary?: { overall?: string };
                site?: { name?: string };
            };
        };

        assert.equal(parsed.success, true);
        assert.equal(parsed.data.summary?.overall, "warning");
        assert.equal(parsed.data.site?.name, "PeakURL Test Site");
    });

    it("prints the overall health value in quiet mode", async () => {
        const result = await runCli(["status", "--quiet"]);

        assert.equal(result.code, 0);
        assert.equal(result.stdout.trim(), "warning");
    });
});

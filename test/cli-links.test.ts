import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "./cli-test-harness.js";

describe("PeakURL CLI Link Management", () => {
    it("creates a short link", async () => {
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

    it("lists short links in human-readable output", async () => {
        const result = await runCli(["list"]);

        assert.equal(result.code, 0);
        assert.match(result.stdout, /URLs loaded/);
        assert.match(result.stdout, /launch/);
        assert.match(result.stdout, /https:\/\/example\.com\/launch/);
        assert.match(result.stdout, /Page 1 of 1\. 1 total link\./);
    });

    it("deletes a short link by alias after resolving its identifier", async () => {
        const result = await runCli(["delete", "launch"]);

        assert.equal(result.code, 0);
        assert.match(result.stdout, /URL deleted/);
    });

    it("exports links as CSV", async () => {
        const workDir = await mkdtemp(join(tmpdir(), "peakurl-export-"));
        const outputPath = join(workDir, "links.csv");
        const result = await runCli([
            "export",
            "--format",
            "csv",
            "--output",
            outputPath,
        ]);

        assert.equal(result.code, 0);
        assert.match(result.stdout, /URLs export loaded\./);
        assert.match(result.stdout, /Saved 1 link to /);

        const content = await readFile(outputPath, "utf8");

        assert.match(
            content,
            /^url,alias,title,password,expires,short_url,clicks,unique_clicks,created_at/m,
        );
        assert.match(content, /https:\/\/example\.com\/launch/);
        assert.match(content, /https:\/\/peakurl\.test\/launch/);
    });

    it("imports links from a CSV file", async () => {
        const workDir = await mkdtemp(join(tmpdir(), "peakurl-import-"));
        const importPath = join(workDir, "links.csv");

        await writeFile(
            importPath,
            [
                "url,alias,title,expires",
                "https://example.com/docs,docs,Documentation,2026-06-01T00:00:00Z",
                "https://example.com/pricing,pricing,Pricing,",
            ].join("\n"),
            "utf8",
        );

        const result = await runCli(["import", importPath]);

        assert.equal(result.code, 0);
        assert.match(result.stdout, /Bulk import processed\./);
        assert.match(result.stdout, /\| Alias\s+\|/);
        assert.match(result.stdout, /docs/);
        assert.match(result.stdout, /pricing/);
        assert.match(result.stdout, /2 links created\. 0 errors\./);
    });
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "./harness.js";

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

    it("deletes multiple short links in bulk", async () => {
        const result = await runCli(["delete", "launch", "url_123"]);

        assert.equal(result.code, 0);
        assert.match(result.stdout, /Bulk URL delete complete\./);
    });

    it("deletes all short links with --all", async () => {
        const result = await runCli(["delete", "--all"]);

        assert.equal(result.code, 0);
        assert.match(result.stdout, /All links deleted\./);
    });

    it("empties short links in trash with --empty-trash", async () => {
        const result = await runCli(["delete", "--empty-trash"]);

        assert.equal(result.code, 0);
        assert.match(result.stdout, /Trash emptied\./);
    });

    it("creates a short link with social preview metadata", async () => {
        const result = await runCli([
            "create",
            "https://example.com/launch",
            "--alias",
            "launch",
            "--social-title",
            "Launch Preview Title",
            "--social-description",
            "Launch Preview Description",
            "--social-image-url",
            "https://example.com/og.png",
        ]);

        assert.equal(result.code, 0);
        assert.match(result.stdout, /Short URL created/);
        assert.match(result.stdout, /Launch Preview Title/);
        assert.match(result.stdout, /Launch Preview Description/);
        assert.match(result.stdout, /https:\/\/example\.com\/og\.png/);
    });

    it("edits an existing short link by alias including social preview fields", async () => {
        const result = await runCli([
            "edit",
            "launch",
            "--title",
            "Updated Launch",
            "--social-title",
            "Updated Social Title",
            "--social-description",
            "Updated Social Description",
            "--social-image-url",
            "https://example.com/updated-og.png",
        ]);

        assert.equal(result.code, 0);
        assert.match(result.stdout, /Short URL updated/);
        assert.match(result.stdout, /Updated Launch/);
        assert.match(result.stdout, /Updated Social Title/);
        assert.match(result.stdout, /Updated Social Description/);
        assert.match(result.stdout, /https:\/\/example\.com\/updated-og\.png/);
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
            /^url,alias,title,password,expires,short_url,clicks,unique_clicks,created_at,social_title,social_description,social_image_url/m,
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
                "url,alias,title,expires,social_title,social_description,social_image_url",
                "https://example.com/docs,docs,Documentation,2026-06-01T00:00:00Z,Docs Preview,Docs Description,https://example.com/docs-og.png",
                "https://example.com/pricing,pricing,Pricing,,,,",
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

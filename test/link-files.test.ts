import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readImportRows, serializeLinkExport } from "../src/lib/index.js";
import type { Link } from "../src/types.js";

describe("Link File Helpers", () => {
    it("parses XML import files", async () => {
        const workDir = await mkdtemp(join(tmpdir(), "peakurl-link-files-"));
        const filePath = join(workDir, "links.xml");

        await writeFile(
            filePath,
            `<urls>
  <url>
    <destinationUrl>https://example.com/docs</destinationUrl>
    <alias>docs</alias>
    <title>Documentation</title>
    <expiresAt>2026-06-01T00:00:00Z</expiresAt>
  </url>
</urls>`,
            "utf8",
        );

        const rows = await readImportRows(filePath, "xml");

        assert.deepEqual(rows, [
            {
                destinationUrl: "https://example.com/docs",
                alias: "docs",
                title: "Documentation",
                expiresAt: "2026-06-01T00:00:00Z",
            },
        ]);
    });

    it("serializes XML exports with the dashboard field names", () => {
        const links: Link[] = [
            {
                alias: "docs",
                shortUrl: "https://peakurl.test/docs",
                destinationUrl: "https://example.com/docs",
                title: "Documentation",
                clicks: 5,
                uniqueClicks: 4,
                expiresAt: "2026-06-01T00:00:00Z",
                createdAt: "2026-04-20T20:00:00Z",
            },
        ];

        const xml = serializeLinkExport(links, "xml");

        assert.match(
            xml,
            /<destinationUrl>https:\/\/example\.com\/docs<\/destinationUrl>/,
        );
        assert.match(xml, /<expiresAt>2026-06-01T00:00:00Z<\/expiresAt>/);
        assert.match(xml, /<uniqueClicks>4<\/uniqueClicks>/);
    });
});

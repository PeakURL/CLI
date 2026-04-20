import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatLinksTable } from "../src/lib/index.js";

describe("Link Table Formatting", () => {
    it("formats boxed table output for human-readable link lists", () => {
        const output = formatLinksTable([
            {
                id: "url_123",
                alias: "launch",
                shortUrl: "https://peakurl.test/launch",
                destinationUrl: "https://example.com/launch",
                status: "active",
            },
        ]);

        assert.match(output, /^\+/);
        assert.match(output, /\| ID\s+\| Alias\s+\| Short URL/);
        assert.match(output, /\| url_123/);
        assert.match(output, /\| launch/);
        assert.match(output, /\| active/);
    });
});

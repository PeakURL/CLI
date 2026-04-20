import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    CliError,
    normalizeBaseUrl,
    normalizeDestinationUrl,
} from "../src/lib/index.js";

describe("URL Validation", () => {
    it("normalizes PeakURL API roots back to the install root", () => {
        assert.equal(
            normalizeBaseUrl("https://dev.peakurl.org/api/v1"),
            "https://dev.peakurl.org",
        );
    });

    it("rejects base URLs with embedded credentials", () => {
        assert.throws(
            () => normalizeBaseUrl("https://user:pass@peakurl.org"),
            (error: unknown) =>
                error instanceof CliError &&
                error.message ===
                    "PeakURL base URL must not include embedded credentials.",
        );
    });

    it("rejects destination URLs that do not use http or https", () => {
        assert.throws(
            () => normalizeDestinationUrl("javascript:alert(1)"),
            (error: unknown) =>
                error instanceof CliError &&
                error.message === "Destination URL must use http or https.",
        );
    });

    it("rejects destination URLs with embedded credentials", () => {
        assert.throws(
            () => normalizeDestinationUrl("https://user:pass@example.com/path"),
            (error: unknown) =>
                error instanceof CliError &&
                error.message ===
                    "Destination URL must not include embedded credentials.",
        );
    });
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    CliError,
    getApiBaseUrl,
    normalizeDestinationUrl,
    normalizeWebhookUrl,
} from "../src/lib/index.js";

describe("URL Validation", () => {
    it("accepts explicit PeakURL API base URLs", () => {
        assert.equal(
            getApiBaseUrl("https://dev.peakurl.org/api/v1"),
            "https://dev.peakurl.org/api/v1",
        );
    });

    it("rejects API base URLs that do not end with /api/v1", () => {
        assert.throws(
            () => getApiBaseUrl("https://dev.peakurl.org"),
            (error: unknown) =>
                error instanceof CliError &&
                error.message === "PeakURL API base URL must end with /api/v1.",
        );
    });

    it("rejects API base URLs with embedded credentials", () => {
        assert.throws(
            () => getApiBaseUrl("https://user:pass@peakurl.org/api/v1"),
            (error: unknown) =>
                error instanceof CliError &&
                error.message ===
                    "PeakURL API base URL must not include embedded credentials.",
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

    it("rejects webhook URLs with embedded credentials", () => {
        assert.throws(
            () => normalizeWebhookUrl("https://user:pass@example.com/webhook"),
            (error: unknown) =>
                error instanceof CliError &&
                error.message ===
                    "Webhook URL must not include embedded credentials.",
        );
    });
});

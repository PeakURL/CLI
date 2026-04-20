import type {
    ApiResponse,
    AuthConfig,
    CreateWebhookPayload,
    Link,
    LinkImportData,
    LinkInput,
    SystemStatus,
    User,
    Webhook,
} from "../types.js";
import { CliError } from "../lib/errors.js";
import { buildApiUrl } from "../lib/url.js";

type QueryParams = Record<string, string | number | undefined>;

interface ListMeta {
    page?: number;
    limit?: number;
    totalItems?: number;
    totalPages?: number;
}

interface ListData {
    items?: Link[];
    results?: Link[];
    meta?: ListMeta;
    [key: string]: unknown;
}

/**
 * Narrows unknown JSON values to the standard PeakURL response envelope.
 *
 * @param value Parsed JSON payload.
 * @returns `true` when the payload matches the envelope contract.
 */
function isApiResponse(value: unknown): value is ApiResponse {
    return Boolean(
        value &&
        typeof value === "object" &&
        "success" in value &&
        "message" in value &&
        "timestamp" in value,
    );
}

/**
 * Builds a user-facing network failure message without exposing credentials.
 *
 * @param apiBaseUrl Explicit PeakURL API base URL.
 * @param error Underlying fetch error.
 * @returns Human-readable network error message.
 */
function networkError(apiBaseUrl: string, error: unknown): string {
    if (error instanceof Error && error.message) {
        return `Could not reach PeakURL at ${apiBaseUrl}. ${error.message}`;
    }

    return `Could not reach PeakURL at ${apiBaseUrl}.`;
}

/**
 * Central HTTP client for the PeakURL API.
 *
 * All command handlers depend on this class so HTTP behavior, auth headers,
 * envelope parsing, and API error normalization stay in one place.
 */
export class ApiClient {
    /**
     * Creates a client bound to one resolved credential set.
     *
     * @param config Explicit API base URL plus bearer API key.
     */
    constructor(private readonly config: AuthConfig) {}

    /**
     * Loads the currently authenticated user.
     *
     * PeakURL accepts bearer API keys on `GET /users/me`, which is also the
     * CLI login verification flow.
     *
     * @returns API response envelope containing the authenticated user.
     */
    whoami(): Promise<ApiResponse<User>> {
        return this.request<User>("GET", "users/me");
    }

    /**
     * Loads the current system status snapshot for the authenticated site.
     *
     * @returns API response envelope containing system status sections.
     */
    getStatus(): Promise<ApiResponse<SystemStatus>> {
        return this.request<SystemStatus>("GET", "system/status");
    }

    /**
     * Creates a short URL.
     *
     * @param payload Request body accepted by `POST /api/v1/urls`.
     * @returns API response envelope containing the created link.
     */
    createUrl(payload: LinkInput): Promise<ApiResponse<Link>> {
        return this.request<Link>("POST", "urls", payload);
    }

    /**
     * Lists short URLs with optional pagination and filtering.
     *
     * The current PeakURL app returns `{ items, meta }` under `data`, but the
     * CLI keeps a slightly broader compatibility type for future-proofing.
     *
     * @param query Optional query-string values.
     * @returns API response envelope containing list data.
     */
    listUrls(query?: QueryParams): Promise<ApiResponse<ListData | Link[]>> {
        return this.request<ListData | Link[]>("GET", "urls", undefined, query);
    }

    /**
     * Exports the full accessible link dataset for the authenticated user.
     *
     * @param query Optional search and sort values.
     * @returns API response envelope containing the full export payload.
     */
    exportUrls(query?: QueryParams): Promise<ApiResponse<ListData | Link[]>> {
        return this.request<ListData | Link[]>(
            "GET",
            "urls/export",
            undefined,
            query,
        );
    }

    /**
     * Imports multiple short links in one bulk request.
     *
     * @param payload Request body accepted by `POST /api/v1/urls/bulk`.
     * @returns API response envelope containing created rows plus row errors.
     */
    importUrls(payload: {
        urls: LinkInput[];
    }): Promise<ApiResponse<LinkImportData>> {
        return this.request<LinkImportData>("POST", "urls/bulk", payload);
    }

    /**
     * Loads a single short URL by identifier or alias.
     *
     * PeakURL resolves IDs, short codes, and aliases through the same route.
     *
     * @param idOrAlias Link identifier, short code, or alias.
     * @returns API response envelope containing the resolved link.
     */
    getUrl(idOrAlias: string): Promise<ApiResponse<Link>> {
        return this.request<Link>(
            "GET",
            `urls/${encodeURIComponent(idOrAlias)}`,
        );
    }

    /**
     * Deletes a short URL by its stable row ID.
     *
     * The current PeakURL backend delete route expects the row ID. The CLI can
     * still accept an alias at the command layer by resolving it first.
     *
     * @param id Stable link row ID.
     * @returns API response envelope containing the deletion result.
     */
    deleteUrl(id: string): Promise<ApiResponse<unknown>> {
        return this.request<unknown>(
            "DELETE",
            `urls/${encodeURIComponent(id)}`,
        );
    }

    /**
     * Lists outbound webhooks for the authenticated user.
     *
     * @returns API response envelope containing webhook rows.
     */
    listWebhooks(): Promise<ApiResponse<Webhook[]>> {
        return this.request<Webhook[]>("GET", "webhooks");
    }

    /**
     * Creates one outbound webhook subscription.
     *
     * @param payload Request body accepted by `POST /api/v1/webhooks`.
     * @returns API response envelope containing the created webhook.
     */
    createWebhook(
        payload: CreateWebhookPayload,
    ): Promise<ApiResponse<Webhook>> {
        return this.request<Webhook>("POST", "webhooks", payload);
    }

    /**
     * Deletes one webhook by its stable row ID.
     *
     * @param id Webhook identifier returned by the list/create endpoints.
     * @returns API response envelope containing the deletion result.
     */
    deleteWebhook(id: string): Promise<ApiResponse<unknown>> {
        return this.request<unknown>(
            "DELETE",
            `webhooks/${encodeURIComponent(id)}`,
        );
    }

    /**
     * Performs one authenticated API request and normalizes the response.
     *
     * @param method HTTP method to send.
     * @param path Route path relative to `/api/v1`.
     * @param body Optional JSON body.
     * @param query Optional query-string values.
     * @returns Parsed PeakURL response envelope.
     * @throws {CliError} When the network request fails or the API returns an error.
     */
    private async request<T>(
        method: string,
        path: string,
        body?: unknown,
        query?: QueryParams,
    ): Promise<ApiResponse<T>> {
        const url = buildApiUrl(this.config.apiBaseUrl, path, query);

        let response: Response;

        try {
            response = await fetch(url, {
                method,
                headers: {
                    Accept: "application/json",
                    Authorization: `Bearer ${this.config.apiKey}`,
                    ...(body ? { "Content-Type": "application/json" } : {}),
                },
                body: body ? JSON.stringify(body) : undefined,
            });
        } catch (error) {
            throw new CliError(networkError(this.config.apiBaseUrl, error), 1, {
                cause: error instanceof Error ? error : undefined,
            });
        }

        const rawText = await response.text();

        if (!rawText) {
            // Some success responses may legitimately return no JSON body.
            if (!response.ok) {
                throw new CliError(
                    `PeakURL request failed with HTTP ${response.status}.`,
                );
            }

            return {
                success: true,
                message: "Request completed.",
                data: undefined as T,
                timestamp: new Date().toISOString(),
            };
        }

        let parsed: unknown;

        try {
            parsed = JSON.parse(rawText);
        } catch {
            // Successful PeakURL API responses should always be JSON envelopes.
            if (!response.ok) {
                throw new CliError(
                    `PeakURL request failed with HTTP ${response.status}.`,
                );
            }

            throw new CliError("PeakURL returned an invalid JSON response.");
        }

        if (!isApiResponse(parsed)) {
            throw new CliError(
                "PeakURL returned an unexpected response envelope.",
            );
        }

        if (!response.ok || !parsed.success) {
            const statusCode = response.status === 401 ? 2 : 1;
            throw new CliError(
                parsed.message ||
                    `PeakURL request failed with HTTP ${response.status}.`,
                statusCode,
            );
        }

        return parsed as ApiResponse<T>;
    }
}

export type { ListData, ListMeta };

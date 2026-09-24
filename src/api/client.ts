import { readFile, stat } from "node:fs/promises";
import { basename, extname } from "node:path";
import type {
    ActivityItem,
    ApiResponse,
    AuthConfig,
    BulkDeleteResult,
    ClearHistoryResult,
    CreateWebhookPayload,
    Job,
    JobStatus,
    Link,
    LinkImportData,
    LinkInput,
    RunJobResult,
    RunDueResult,
    SystemStatus,
    UpdateJobPayload,
    UpdateLinkPayload,
    User,
    Webhook,
} from "../types.js";
import { CliError } from "../lib/errors.js";
import { buildApiUrl } from "../lib/url.js";

const IMAGE_MIME_BY_EXTENSION: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
};

const MAX_SOCIAL_IMAGE_BYTES = 5 * 1024 * 1024;

async function toFormData(
    fields: Record<string, unknown>,
    socialImagePath: string,
): Promise<FormData> {
    const ext = extname(socialImagePath).toLowerCase();
    const mimeType = IMAGE_MIME_BY_EXTENSION[ext];

    if (!mimeType) {
        throw new CliError(
            "Invalid social image file type. Only JPG, PNG, WEBP, and GIF images are allowed.",
        );
    }

    let fileStats;
    try {
        fileStats = await stat(socialImagePath);
    } catch (error) {
        throw new CliError(
            `Could not read social image file ${socialImagePath}.`,
            1,
            {
                cause: error instanceof Error ? error : undefined,
            },
        );
    }

    if (fileStats.size > MAX_SOCIAL_IMAGE_BYTES) {
        throw new CliError(
            "Social image file is too large. Maximum size is 5MB.",
        );
    }

    const buffer = await readFile(socialImagePath);
    const formData = new FormData();

    for (const [key, value] of Object.entries(fields)) {
        if (
            key === "socialImagePath" ||
            (typeof value !== "string" &&
                typeof value !== "number" &&
                typeof value !== "boolean")
        ) {
            continue;
        }
        formData.append(key, String(value));
    }

    formData.append(
        "socialImage",
        new Blob([buffer], { type: mimeType }),
        basename(socialImagePath),
    );

    return formData;
}

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
    async createUrl(payload: LinkInput): Promise<ApiResponse<Link>> {
        if (payload.socialImagePath) {
            const formData = await toFormData(
                payload as unknown as Record<string, unknown>,
                payload.socialImagePath,
            );
            return this.request<Link>("POST", "urls", formData);
        }

        const { socialImagePath: _unused, ...jsonPayload } = payload;
        return this.request<Link>("POST", "urls", jsonPayload);
    }

    /**
     * Updates an existing short URL by its stable row ID.
     *
     * Sends `POST /api/v1/urls/{id}` with `multipart/form-data` when uploading a
     * local social preview image, or `PUT /api/v1/urls/{id}` with JSON otherwise.
     *
     * @param id Stable link row ID.
     * @param payload Fields to update on the short link.
     * @returns API response envelope containing the updated link.
     */
    async updateUrl(
        id: string,
        payload: UpdateLinkPayload,
    ): Promise<ApiResponse<Link>> {
        const path = `urls/${encodeURIComponent(id)}`;

        if (payload.socialImagePath) {
            const formData = await toFormData(
                payload as unknown as Record<string, unknown>,
                payload.socialImagePath,
            );
            return this.request<Link>("POST", path, formData);
        }

        const { socialImagePath: _unused, ...jsonPayload } = payload;
        return this.request<Link>("PUT", path, jsonPayload);
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
     * Deletes multiple short URLs in a single bulk operation.
     *
     * @param ids Array of short URL IDs to delete.
     * @returns API response envelope with deleted count.
     */
    deleteUrlsBulk(ids: string[]): Promise<ApiResponse<BulkDeleteResult>> {
        return this.request<BulkDeleteResult>("DELETE", "urls/bulk", { ids });
    }

    /**
     * Deletes all accessible short URLs for the authenticated user.
     *
     * @returns API response envelope with deleted count.
     */
    clearUrls(): Promise<ApiResponse<BulkDeleteResult>> {
        return this.request<BulkDeleteResult>("DELETE", "urls");
    }

    /**
     * Empties all short links currently in trash.
     *
     * @returns API response envelope with deleted count.
     */
    emptyTrash(): Promise<ApiResponse<BulkDeleteResult>> {
        return this.request<BulkDeleteResult>("DELETE", "urls/trash");
    }

    /**
     * Lists audit log activity entries.
     *
     * @param query Optional query-string parameters for pagination or filters.
     * @returns API response envelope containing activity items and meta.
     */
    listActivity(
        query?: QueryParams,
    ): Promise<ApiResponse<ListData | ActivityItem[]>> {
        return this.request<ListData | ActivityItem[]>(
            "GET",
            "analytics/activity",
            undefined,
            query,
        );
    }

    /**
     * Deletes a single audit log activity entry by its row ID.
     *
     * @param id Audit log row ID.
     * @returns API response envelope confirming deletion.
     */
    deleteActivity(id: string): Promise<ApiResponse<unknown>> {
        return this.request<unknown>(
            "DELETE",
            `analytics/activity/${encodeURIComponent(id)}`,
        );
    }

    /**
     * Deletes multiple audit log activity entries in bulk.
     *
     * @param ids Array of audit log row IDs.
     * @returns API response envelope with deleted count.
     */
    deleteActivityBulk(ids: string[]): Promise<ApiResponse<BulkDeleteResult>> {
        return this.request<BulkDeleteResult>(
            "DELETE",
            "analytics/activity/bulk",
            { ids },
        );
    }

    /**
     * Clears all audit log activity records.
     *
     * @returns API response envelope confirming all logs were deleted.
     */
    clearActivity(): Promise<ApiResponse<BulkDeleteResult>> {
        return this.request<BulkDeleteResult>("DELETE", "analytics/activity");
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
     * Loads the current status of the cron scheduler.
     *
     * @returns API response envelope containing the scheduler status.
     */
    getJobStatus(): Promise<ApiResponse<JobStatus>> {
        return this.request<JobStatus>("GET", "system/cron");
    }

    /**
     * Triggers all due cron jobs to run.
     *
     * @returns API response envelope containing the execution results.
     */
    runDueJobs(): Promise<ApiResponse<RunDueResult>> {
        return this.request<RunDueResult>("POST", "system/cron/run");
    }

    /**
     * Forces a specific cron job to run immediately.
     *
     * @param id Job identifier.
     * @returns API response envelope containing the execution result.
     */
    runJob(id: string): Promise<ApiResponse<RunJobResult>> {
        return this.request<RunJobResult>(
            "POST",
            `system/cron/run/${encodeURIComponent(id)}`,
        );
    }

    /**
     * Clears cron execution history.
     *
     * @param jobId Optional job identifier to clear history only for one job.
     * @returns API response envelope containing the deleted count.
     */
    clearJobHistory(jobId?: string): Promise<ApiResponse<ClearHistoryResult>> {
        return this.request<ClearHistoryResult>(
            "POST",
            "system/cron/history/clear",
            jobId ? { job_id: jobId } : undefined,
        );
    }

    /**
     * Updates the schedule configuration for a cron job.
     *
     * @param id Job identifier.
     * @param payload New configuration options.
     * @returns API response envelope containing the updated job.
     */
    updateJobSchedule(
        id: string,
        payload: UpdateJobPayload,
    ): Promise<ApiResponse<Job>> {
        return this.request<Job>(
            "PATCH",
            `system/cron/jobs/${encodeURIComponent(id)}`,
            payload,
        );
    }

    /**
     * Resets a cron job schedule to its default configuration.
     *
     * @param id Job identifier.
     * @returns API response envelope containing the restored job.
     */
    resetJobSchedule(id: string): Promise<ApiResponse<Job>> {
        return this.request<Job>(
            "POST",
            `system/cron/jobs/${encodeURIComponent(id)}/reset`,
        );
    }

    /**
     * Updates the global cron settings, such as history retention.
     *
     * @param payload New global settings.
     * @returns API response envelope containing the updated retention settings.
     */
    updateJobSettings(payload: {
        retention_days: number;
    }): Promise<ApiResponse<{ retention_days: number }>> {
        return this.request<{ retention_days: number }>(
            "POST",
            "system/cron/settings",
            payload,
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

        const isFormData = body instanceof FormData;

        try {
            response = await fetch(url, {
                method,
                headers: {
                    Accept: "application/json",
                    Authorization: `Bearer ${this.config.apiKey}`,
                    ...(body && !isFormData
                        ? { "Content-Type": "application/json" }
                        : {}),
                },
                body: isFormData
                    ? body
                    : body
                      ? JSON.stringify(body)
                      : undefined,
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

/**
 * Standard PeakURL API response envelope.
 */
export interface ApiResponse<T = unknown> {
    success: boolean;
    message: string;
    data: T;
    timestamp: string;
}

/**
 * Persisted or environment-provided CLI credentials.
 */
export interface AuthConfig {
    /** Explicit PeakURL API base URL, for example `https://example.com/api/v1`. */
    apiBaseUrl: string;
    apiKey: string;
}

/**
 * Shared output controls supported by CLI commands.
 */
export interface OutputOptions {
    json?: boolean;
    quiet?: boolean;
}

/**
 * Shared output controls plus overwrite support for installer-style commands.
 */
export interface ForceOptions extends OutputOptions {
    force?: boolean;
}

/**
 * Release metadata returned by the PeakURL update feed.
 */
export interface CoreRelease {
    version: string;
    downloadUrl: string;
    checksumSha256: string;
    releasedAt?: string;
    releaseNotesUrl?: string;
}

/**
 * Summary returned after downloading and extracting the PeakURL core package.
 */
export interface CoreDownloadResult {
    version: string;
    path: string;
    downloadUrl: string;
    checksumSha256: string;
    checksumVerified: boolean;
    fileCount: number;
}

/**
 * File formats supported by link import and export commands.
 */
export type LinkFileFormat = "csv" | "json" | "xml";

/**
 * Link fields accepted by the PeakURL create and bulk-import routes.
 */
export interface LinkInput {
    destinationUrl: string;
    alias?: string;
    title?: string;
    password?: string;
    status?: string;
    expiresAt?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmTerm?: string;
    utmContent?: string;
    socialTitle?: string;
    socialDescription?: string;
    socialImageUrl?: string;
    socialImagePath?: string;
}

/**
 * Link fields accepted by `PUT /api/v1/urls/{id}` and `POST /api/v1/urls/{id}`.
 */
export interface UpdateLinkPayload {
    destinationUrl?: string;
    title?: string;
    password?: string;
    clearPassword?: boolean;
    status?: string;
    expiresAt?: string | null;
    socialTitle?: string;
    socialDescription?: string;
    socialImageUrl?: string;
    socialImagePath?: string;
    removeSocialImage?: boolean;
}

/**
 * User fields commonly returned by `GET /users/me`.
 */
export interface User {
    id?: string | number;
    username?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    role?: string;
    [key: string]: unknown;
}

/**
 * Nested social preview metadata returned on link records by the PeakURL API.
 */
export interface SocialPreview {
    title?: string | null;
    description?: string | null;
    imageUrl?: string | null;
    externalImageUrl?: string | null;
}

/**
 * URL fields commonly returned by PeakURL URL endpoints.
 */
export interface Link {
    id?: string | number;
    alias?: string;
    shortCode?: string;
    shortUrl?: string;
    destinationUrl?: string;
    title?: string;
    status?: string;
    clicks?: number;
    uniqueClicks?: number;
    hasPassword?: boolean;
    expiresAt?: string | null;
    socialTitle?: string | null;
    socialDescription?: string | null;
    socialImageUrl?: string | null;
    socialPreview?: SocialPreview | null;
    createdAt?: string;
    updatedAt?: string;
    [key: string]: unknown;
}

/**
 * One row-level error returned by bulk import.
 */
export interface LinkImportError {
    destinationUrl?: string;
    alias?: string | null;
    error: string;
}

/**
 * Result payload returned by the bulk import route.
 */
export interface LinkImportData {
    results?: Link[];
    errors?: LinkImportError[];
}

/**
 * Health keys returned by the system status endpoint.
 */
export type SystemState = "ok" | "warning" | "error";

/**
 * One dashboard health check returned by `GET /system/status`.
 */
export interface SystemCheck {
    id?: string | null;
    label?: string | null;
    description?: string | null;
    status?: SystemState | string | null;
}

/**
 * Top-level status summary returned by `GET /system/status`.
 */
export interface SystemSummary {
    overall?: SystemState | string | null;
    okCount?: number | string | null;
    warningCount?: number | string | null;
    errorCount?: number | string | null;
    totalChecks?: number | string | null;
}

/**
 * Site-level system status details.
 */
export interface SiteInfo {
    name?: string | null;
    url?: string | null;
    version?: string | null;
    environment?: string | null;
    installType?: string | null;
    debugEnabled?: boolean;
    locale?: string | null;
    htmlLang?: string | null;
    languageLabel?: string | null;
    languageNativeName?: string | null;
    installedLanguagesCount?: number | string | null;
    defaultLocale?: string | null;
}

/**
 * Server runtime details returned by the status endpoint.
 */
export interface ServerInfo {
    phpVersion?: string | null;
    phpSapi?: string | null;
    serverSoftware?: string | null;
    operatingSystem?: string | null;
    timezone?: string | null;
    memoryLimit?: string | null;
    maxExecutionTime?: number | string | null;
    uploadMaxFilesize?: string | null;
    postMaxSize?: string | null;
    extensions?: {
        intl?: boolean;
        curl?: boolean;
        zip?: boolean;
    } | null;
}

/**
 * Database status details returned by the status endpoint.
 */
export interface DatabaseInfo {
    connected?: boolean;
    serverType?: string | null;
    version?: string | null;
    host?: string | null;
    port?: number | string | null;
    name?: string | null;
    charset?: string | null;
    prefix?: string | null;
    schemaVersion?: number | string | null;
    requiredSchemaVersion?: number | string | null;
    schemaCompatible?: boolean;
    schemaUpgradeRequired?: boolean;
    schemaIssuesCount?: number | string | null;
    schemaLastUpgradedAt?: string | null;
    schemaLastError?: string | null;
}

/**
 * File-system status details returned by the status endpoint.
 */
export interface StorageInfo {
    contentDirectory?: string | null;
    contentExists?: boolean;
    contentWritable?: boolean;
    contentDirectorySizeBytes?: number | string | null;
    languagesDirectory?: string | null;
    languagesDirectoryExists?: boolean;
    languagesDirectoryReadable?: boolean;
    languagesDirectorySizeBytes?: number | string | null;
    configPath?: string | null;
    configExists?: boolean;
    configSizeBytes?: number | string | null;
    debugLogPath?: string | null;
    debugLogExists?: boolean;
    debugLogReadable?: boolean;
    debugLogSizeBytes?: number | string | null;
    appDirectory?: string | null;
    appWritable?: boolean;
    appDirectorySizeBytes?: number | string | null;
    releaseRoot?: string | null;
    releaseRootSizeBytes?: number | string | null;
}

/**
 * Mail transport status returned by the status endpoint.
 */
export interface MailInfo {
    driver?: string | null;
    transportReady?: boolean;
    fromEmail?: string | null;
    fromName?: string | null;
    smtpHost?: string | null;
    smtpPort?: string | null;
    smtpEncryption?: string | null;
    smtpAuth?: boolean;
    configurationLabel?: string | null;
    configurationPath?: string | null;
}

/**
 * Location-data status returned by the status endpoint.
 */
export interface LocationInfo {
    locationAnalyticsReady?: boolean;
    lastDownloadedAt?: string | null;
    databaseUpdatedAt?: string | null;
    databaseSizeBytes?: number | string | null;
    credentialsConfigured?: boolean;
    accountId?: string | null;
    databasePath?: string | null;
    databaseReadable?: boolean;
    downloadCommand?: string | null;
}

/**
 * High-level site counts returned by the status endpoint.
 */
export interface SiteCounts {
    users?: number | string | null;
    links?: number | string | null;
    clicks?: number | string | null;
    sessions?: number | string | null;
    apiKeys?: number | string | null;
    webhooks?: number | string | null;
    auditEvents?: number | string | null;
    managedTables?: number | string | null;
}

/**
 * Redis cache driver status returned by the status endpoint.
 */
export interface CacheRedisInfo {
    configured?: boolean | null;
    host?: string | null;
    port?: number | string | null;
    available?: boolean | null;
    serverVersion?: string | null;
}

/**
 * APCu cache driver status returned by the status endpoint.
 */
export interface CacheApcuInfo {
    extensionLoaded?: boolean | null;
    enabled?: boolean | null;
    available?: boolean | null;
}

/**
 * Filesystem cache driver status returned by the status endpoint.
 */
export interface CacheFileInfo {
    path?: string | null;
    exists?: boolean | null;
    writable?: boolean | null;
    available?: boolean | null;
    sizeBytes?: number | string | null;
    fileCount?: number | string | null;
}

/**
 * Cache diagnostics and driver status returned by the status endpoint.
 */
export interface CacheInfo {
    enabled?: boolean | null;
    status?: string | null;
    activeDriver?: string | null;
    configuredDriver?: string | null;
    path?: string | null;
    writable?: boolean | null;
    directoryExists?: boolean | null;
    defaultTtl?: number | string | null;
    negativeTtl?: number | string | null;
    sizeBytes?: number | string | null;
    fileCount?: number | string | null;
    redis?: CacheRedisInfo | null;
    apcu?: CacheApcuInfo | null;
    file?: CacheFileInfo | null;
}

/**
 * Full payload returned by `GET /system/status`.
 */
export interface SystemStatus {
    generatedAt?: string | null;
    summary?: SystemSummary | null;
    checks?: SystemCheck[] | null;
    site?: SiteInfo | null;
    server?: ServerInfo | null;
    database?: DatabaseInfo | null;
    storage?: StorageInfo | null;
    mail?: MailInfo | null;
    location?: LocationInfo | null;
    cache?: CacheInfo | null;
    data?: SiteCounts | null;
}

/**
 * Webhook fields commonly returned by PeakURL webhook endpoints.
 */
export interface Webhook {
    id?: string | number;
    url?: string;
    events?: string[] | null;
    secret?: string | null;
    secretHint?: string | null;
    isActive?: boolean;
    createdAt?: string | null;
    [key: string]: unknown;
}

/**
 * Request payload accepted by `POST /api/v1/webhooks`.
 */
export interface CreateWebhookPayload {
    /** Destination endpoint URL. */
    url: string;
    /** Event identifiers subscribed by the webhook. */
    events: string[];
}

/**
 * Audit log activity entry returned by `/api/v1/analytics/activity`.
 */
export interface ActivityItem {
    id?: string;
    type?: string;
    message?: string;
    userId?: string | null;
    linkId?: string | null;
    metadata?: Record<string, unknown> | null;
    createdAt?: string | null;
    userName?: string | null;
    userEmail?: string | null;
    ipAddress?: string | null;
    countryCode?: string | null;
    country?: string | null;
    city?: string | null;
    [key: string]: unknown;
}

/**
 * Result payload returned by bulk delete endpoints.
 */
export interface BulkDeleteResult {
    deletedCount?: number;
    [key: string]: unknown;
}

/**
 * One scheduled cron job.
 */
export interface Job {
    id: string;
    title: string;
    interval_seconds: number;
    recommended_interval_seconds: number;
    preferred_run_time: string | null;
    is_customized: boolean;
    status: string;
    is_enabled: boolean;
    next_run_at: string | null;
    last_run_at: string | null;
    last_finished_at: string | null;
    attempts: number;
    max_attempts: number;
    last_error: string | null;
    recent_runs?: JobRun[];
}

/**
 * Execution history record for a cron job.
 */
export interface JobRun {
    id: string;
    status: string;
    attempt: number;
    started_at: string;
    finished_at: string | null;
    duration_ms: number | null;
    output_summary: string | null;
    error_message: string | null;
}

/**
 * Status of the cron scheduler.
 */
export interface JobStatus {
    jobs: Job[];
    jobs_count: number;
    retention_days: number;
    timezone: string;
}

/**
 * Result of running a single cron job.
 */
export interface RunJobResult {
    job_id: string;
    status: string;
    summary: string | null;
    error: string | null;
    success: boolean;
}

/**
 * Result of running all due cron jobs.
 */
export interface RunDueResult {
    run_all: boolean;
    results: RunJobResult[];
    success: boolean;
}

/**
 * Result of clearing cron history.
 */
export interface ClearHistoryResult {
    deleted_count: number;
    job_id?: string | null;
    job_key?: string | null;
    success: boolean;
}

/**
 * Payload to update a cron job schedule.
 */
export interface UpdateJobPayload {
    interval_seconds?: number;
    preferred_run_time?: string | null;
    is_enabled?: boolean;
}

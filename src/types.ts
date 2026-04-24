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

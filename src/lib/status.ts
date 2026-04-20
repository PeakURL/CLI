import type {
    DatabaseInfo,
    LocationInfo,
    MailInfo,
    ServerInfo,
    SiteCounts,
    SiteInfo,
    StorageInfo,
    SystemCheck,
    SystemStatus,
    SystemSummary,
} from "../types.js";
import { formatTable } from "./output.js";

type Row = [string, string];

function text(value: unknown): string | undefined {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function integer(value: unknown): number | undefined {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === "string" && value.trim()) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : undefined;
    }

    return undefined;
}

function flag(value: unknown): boolean | undefined {
    if (typeof value === "boolean") {
        return value;
    }

    if (value === 1 || value === "1") {
        return true;
    }

    if (value === 0 || value === "0") {
        return false;
    }

    return undefined;
}

function yesNo(
    value: unknown,
    yes: string = "Yes",
    no: string = "No",
): string | undefined {
    const normalized = flag(value);
    if (normalized === undefined) {
        return undefined;
    }

    return normalized ? yes : no;
}

function formatState(value: unknown): string | undefined {
    const normalized = text(value)?.toLowerCase();

    if (!normalized) {
        return undefined;
    }

    switch (normalized) {
        case "ok":
            return "Good";
        case "warning":
            return "Warning";
        case "error":
            return "Error";
        default:
            return normalized;
    }
}

function formatCount(value: unknown): string | undefined {
    const normalized = integer(value);
    return normalized === undefined ? text(value) : String(normalized);
}

function formatSize(value: unknown): string | undefined {
    const bytes = integer(value);

    if (bytes === undefined) {
        return text(value);
    }

    const units = ["B", "KB", "MB", "GB", "TB"];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex += 1;
    }

    const amount =
        size >= 10 || unitIndex === 0 ? size.toFixed(0) : size.toFixed(1);

    return `${amount} ${units[unitIndex]}`;
}

function formatSeconds(value: unknown): string | undefined {
    const normalized = integer(value);
    return normalized === undefined ? text(value) : `${normalized} seconds`;
}

function wrapText(value: string, width = 68): string {
    const lines: string[] = [];

    for (const line of value.split("\n")) {
        if (line.length <= width) {
            lines.push(line);
            continue;
        }

        for (let index = 0; index < line.length; index += width) {
            lines.push(line.slice(index, index + width));
        }
    }

    return lines.join("\n");
}

function row(label: string, value: unknown, width?: number): Row | null {
    const normalized =
        typeof value === "string"
            ? value
            : typeof value === "number"
              ? String(value)
              : undefined;

    if (!normalized) {
        return null;
    }

    return [label, wrapText(normalized, width)];
}

function rows(values: Array<Row | null>): Row[] {
    return values.filter((value): value is Row => Boolean(value));
}

function getSummary(status: SystemStatus): SystemSummary {
    const summary = status.summary ?? {};
    const checks = status.checks ?? [];

    if (
        summary.okCount !== undefined &&
        summary.warningCount !== undefined &&
        summary.errorCount !== undefined &&
        summary.totalChecks !== undefined
    ) {
        return summary;
    }

    let okCount = 0;
    let warningCount = 0;
    let errorCount = 0;

    for (const check of checks) {
        switch (text(check.status)?.toLowerCase()) {
            case "error":
                errorCount += 1;
                break;
            case "warning":
                warningCount += 1;
                break;
            case "ok":
                okCount += 1;
                break;
        }
    }

    return {
        overall:
            summary.overall ??
            (errorCount > 0 ? "error" : warningCount > 0 ? "warning" : "ok"),
        okCount: summary.okCount ?? okCount,
        warningCount: summary.warningCount ?? warningCount,
        errorCount: summary.errorCount ?? errorCount,
        totalChecks: summary.totalChecks ?? checks.length,
    };
}

function summaryRows(status: SystemStatus): Row[] {
    const summary = getSummary(status);

    return rows([
        row("Overall", formatState(summary.overall)),
        row("Generated at", text(status.generatedAt)),
        row("Total checks", formatCount(summary.totalChecks)),
        row("Good checks", formatCount(summary.okCount)),
        row("Warnings", formatCount(summary.warningCount)),
        row("Errors", formatCount(summary.errorCount)),
    ]);
}

function siteRows(site: SiteInfo | null | undefined): Row[] {
    if (!site) {
        return [];
    }

    return rows([
        row("Name", text(site.name)),
        row("URL", text(site.url)),
        row("Version", text(site.version)),
        row("Environment", text(site.environment)),
        row("Install type", text(site.installType)),
        row("Locale", text(site.locale)),
        row("HTML lang", text(site.htmlLang)),
        row(
            "Language",
            text(site.languageNativeName) || text(site.languageLabel),
        ),
        row("Installed languages", formatCount(site.installedLanguagesCount)),
        row("Default locale", text(site.defaultLocale)),
        row("Debug", yesNo(site.debugEnabled, "Enabled", "Disabled")),
    ]);
}

function serverRows(server: ServerInfo | null | undefined): Row[] {
    if (!server) {
        return [];
    }

    return rows([
        row("PHP version", text(server.phpVersion)),
        row("PHP SAPI", text(server.phpSapi)),
        row("Server software", text(server.serverSoftware), 56),
        row("Operating system", text(server.operatingSystem)),
        row("Timezone", text(server.timezone)),
        row("Memory limit", text(server.memoryLimit)),
        row("Max execution time", formatSeconds(server.maxExecutionTime)),
        row("Upload max filesize", text(server.uploadMaxFilesize)),
        row("Post max size", text(server.postMaxSize)),
        row("Intl extension", yesNo(server.extensions?.intl)),
        row("cURL extension", yesNo(server.extensions?.curl)),
        row("ZipArchive", yesNo(server.extensions?.zip)),
    ]);
}

function databaseRows(database: DatabaseInfo | null | undefined): Row[] {
    if (!database) {
        return [];
    }

    return rows([
        row("Connected", yesNo(database.connected)),
        row("Server type", text(database.serverType)),
        row("Version", text(database.version)),
        row("Host", text(database.host)),
        row("Port", formatCount(database.port)),
        row("Name", text(database.name)),
        row("Charset", text(database.charset)),
        row("Prefix", text(database.prefix)),
        row("Schema version", formatCount(database.schemaVersion)),
        row(
            "Required schema version",
            formatCount(database.requiredSchemaVersion),
        ),
        row("Schema compatible", yesNo(database.schemaCompatible)),
        row("Schema upgrade required", yesNo(database.schemaUpgradeRequired)),
        row("Schema issues", formatCount(database.schemaIssuesCount)),
        row("Last upgraded", text(database.schemaLastUpgradedAt)),
        row("Last error", text(database.schemaLastError), 56),
    ]);
}

function storageRows(storage: StorageInfo | null | undefined): Row[] {
    if (!storage) {
        return [];
    }

    return rows([
        row("Content directory", text(storage.contentDirectory), 60),
        row("Content exists", yesNo(storage.contentExists)),
        row("Content writable", yesNo(storage.contentWritable)),
        row("Content size", formatSize(storage.contentDirectorySizeBytes)),
        row("Languages directory", text(storage.languagesDirectory), 60),
        row("Languages exists", yesNo(storage.languagesDirectoryExists)),
        row("Languages readable", yesNo(storage.languagesDirectoryReadable)),
        row("Languages size", formatSize(storage.languagesDirectorySizeBytes)),
        row("Config path", text(storage.configPath), 60),
        row("Config exists", yesNo(storage.configExists)),
        row("Config size", formatSize(storage.configSizeBytes)),
        row("Debug log path", text(storage.debugLogPath), 60),
        row("Debug log exists", yesNo(storage.debugLogExists)),
        row("Debug log readable", yesNo(storage.debugLogReadable)),
        row("Debug log size", formatSize(storage.debugLogSizeBytes)),
        row("App directory", text(storage.appDirectory), 60),
        row("App writable", yesNo(storage.appWritable)),
        row("App size", formatSize(storage.appDirectorySizeBytes)),
        row("Release root", text(storage.releaseRoot), 60),
        row("Release size", formatSize(storage.releaseRootSizeBytes)),
    ]);
}

function mailRows(mail: MailInfo | null | undefined): Row[] {
    if (!mail) {
        return [];
    }

    return rows([
        row("Driver", text(mail.driver)),
        row("Transport", yesNo(mail.transportReady, "Ready", "Not ready")),
        row("From email", text(mail.fromEmail)),
        row("From name", text(mail.fromName)),
        row("SMTP host", text(mail.smtpHost)),
        row("SMTP port", text(mail.smtpPort)),
        row("SMTP encryption", text(mail.smtpEncryption)),
        row("SMTP auth", yesNo(mail.smtpAuth)),
        row("Configuration", text(mail.configurationLabel)),
        row("Configuration path", text(mail.configurationPath), 60),
    ]);
}

function locationRows(location: LocationInfo | null | undefined): Row[] {
    if (!location) {
        return [];
    }

    return rows([
        row(
            "Analytics",
            yesNo(location.locationAnalyticsReady, "Ready", "Not ready"),
        ),
        row("Last downloaded", text(location.lastDownloadedAt)),
        row("Database updated", text(location.databaseUpdatedAt)),
        row("Database size", formatSize(location.databaseSizeBytes)),
        row("Credentials configured", yesNo(location.credentialsConfigured)),
        row("Account ID", text(location.accountId)),
        row("Database path", text(location.databasePath), 60),
        row("Database readable", yesNo(location.databaseReadable)),
        row("Download command", text(location.downloadCommand), 60),
    ]);
}

function dataRows(data: SiteCounts | null | undefined): Row[] {
    if (!data) {
        return [];
    }

    return rows([
        row("Users", formatCount(data.users)),
        row("Links", formatCount(data.links)),
        row("Clicks", formatCount(data.clicks)),
        row("Sessions", formatCount(data.sessions)),
        row("API keys", formatCount(data.apiKeys)),
        row("Webhooks", formatCount(data.webhooks)),
        row("Audit events", formatCount(data.auditEvents)),
        row("Managed tables", formatCount(data.managedTables)),
    ]);
}

function checksTable(checks: SystemCheck[]): string | undefined {
    if (checks.length === 0) {
        return undefined;
    }

    const rows = checks.map((check) => [
        wrapText(text(check.label) || "Check", 24),
        formatState(check.status) || "Unknown",
        wrapText(text(check.description) || "Not available", 56),
    ]);

    return formatTable(["Check", "Status", "Description"], rows);
}

function section(title: string, rows: Row[]): string | undefined {
    if (rows.length === 0) {
        return undefined;
    }

    return `${title}\n${formatTable(["Field", "Value"], rows)}`;
}

/**
 * Returns the compact status key used by `--quiet`.
 *
 * @param status Parsed system status payload.
 * @returns Overall health key when available.
 */
export function getStatusValue(status: SystemStatus): string {
    return text(getSummary(status).overall) || "unknown";
}

/**
 * Formats the full human-readable system status report.
 *
 * @param status Parsed system status payload.
 * @returns Multi-section terminal report built from boxed tables.
 */
export function formatStatusReport(status: SystemStatus): string {
    const checks = checksTable(status.checks ?? []);
    const sections = [
        section("Summary", summaryRows(status)),
        checks ? `Checks\n${checks}` : undefined,
        section("Site", siteRows(status.site)),
        section("Server", serverRows(status.server)),
        section("Database", databaseRows(status.database)),
        section("Storage", storageRows(status.storage)),
        section("Mail", mailRows(status.mail)),
        section("Location", locationRows(status.location)),
        section("Data", dataRows(status.data)),
    ].filter((value): value is string => Boolean(value));

    return sections.length > 0
        ? sections.join("\n\n")
        : "No system status fields returned.";
}

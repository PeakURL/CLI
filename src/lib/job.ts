import { formatDetailsTable, formatTable } from "./output.js";
import type {
    Job,
    JobRun,
    JobStatus,
    RunJobResult,
    RunDueResult,
} from "../types.js";

function formatInterval(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
}

function formatDate(date: string | null): string {
    if (!date) return "never";
    return new Date(date).toISOString().replace("T", " ").substring(0, 19);
}

export function formatJobsList(status: JobStatus): string {
    const rows = status.jobs.map((job) => [
        job.id,
        job.title,
        job.status,
        job.is_enabled ? "yes" : "no",
        formatDate(job.next_run_at),
    ]);

    const table = formatTable(
        ["ID", "Job", "Status", "Enabled", "Next Run"],
        rows,
    );
    const summary = `\n${status.jobs_count} jobs registered.\nTimezone: ${status.timezone}\nHistory retention: ${status.retention_days} days`;

    return `${table}${summary}`;
}

export function formatJobDetails(job: Job): string {
    const rows = [
        ["ID", job.id],
        ["Title", job.title],
        ["Status", job.status],
        ["Enabled", job.is_enabled ? "yes" : "no"],
        ["Current interval", formatInterval(job.interval_seconds)],
        [
            "Recommended interval",
            formatInterval(job.recommended_interval_seconds),
        ],
        ["Preferred run time", job.preferred_run_time || "none"],
        ["Customized", job.is_customized ? "yes" : "no"],
        ["Next run", formatDate(job.next_run_at)],
        ["Last run", formatDate(job.last_run_at)],
        ["Last finished", formatDate(job.last_finished_at)],
        ["Attempts", String(job.attempts)],
        ["Maximum attempts", String(job.max_attempts)],
        ["Last error", job.last_error || "none"],
    ];

    let out = formatDetailsTable(rows);
    if (job.recent_runs && job.recent_runs.length > 0) {
        out += `\n\nRecent Runs:\n${formatJobHistory(job.recent_runs)}`;
    }
    return out;
}

export function formatJobHistory(runs: JobRun[]): string {
    if (!runs || runs.length === 0) {
        return "No recent runs.";
    }

    const rows = runs.map((run) => [
        run.id,
        run.status,
        String(run.attempt),
        formatDate(run.started_at),
        formatDate(run.finished_at),
        run.duration_ms ? `${run.duration_ms}ms` : "-",
        run.output_summary || "-",
        run.error_message || "-",
    ]);

    return formatTable(
        [
            "Run ID",
            "Status",
            "Attempt",
            "Started",
            "Finished",
            "Duration",
            "Summary",
            "Error",
        ],
        rows,
    );
}

export function formatRunJobResult(result: RunJobResult): string {
    let out = `Job: ${result.job_id}\nStatus: ${result.status}`;
    if (result.summary) {
        out += `\nSummary: ${result.summary}`;
    }
    if (result.error) {
        out += `\nError: ${result.error}`;
    }
    return out;
}

export function formatRunDueResult(result: RunDueResult): string {
    if (!result.results || result.results.length === 0) {
        return "No jobs were due.";
    }

    const rows = result.results.map((r) => [
        r.job_id,
        r.status,
        r.summary || "-",
        r.error || "-",
    ]);

    return formatTable(["Job ID", "Status", "Summary", "Error"], rows);
}

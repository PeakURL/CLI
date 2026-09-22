import { ApiClient } from "../api/client.js";
import { CliError } from "../lib/errors.js";
import {
    formatJobDetails,
    formatJobHistory,
    formatJobsList,
    formatRunJobResult,
    formatRunDueResult,
    getAuthConfig,
    successLine,
    writeJson,
    writeStdout,
} from "../lib/index.js";
import type { OutputOptions } from "../types.js";

async function getClient(): Promise<ApiClient> {
    const config = await getAuthConfig(process.env);
    return new ApiClient(config);
}

export async function listJobs(options: OutputOptions): Promise<void> {
    const client = await getClient();
    const response = await client.getJobStatus();

    if (options.json) {
        writeJson(response);
        return;
    }

    if (options.quiet) {
        const ids = response.data.jobs.map((job) => job.id).join("\n");
        if (ids) {
            writeStdout(ids);
        }
        return;
    }

    writeStdout(successLine(response.message));
    writeStdout();
    writeStdout(formatJobsList(response.data));
}

export async function getJob(
    id: string,
    options: OutputOptions,
): Promise<void> {
    const client = await getClient();
    const response = await client.getJobStatus();

    const job = response.data.jobs.find((j) => j.id === id);
    if (!job) {
        throw new CliError(`Job '${id}' not found.`, 1);
    }

    if (options.json) {
        writeJson({
            success: true,
            message: "Job loaded.",
            data: job,
            timestamp: response.timestamp,
        });
        return;
    }

    if (options.quiet) {
        writeStdout(job.id);
        return;
    }

    writeStdout(successLine(`Job ${job.id} loaded.`));
    writeStdout();
    writeStdout(formatJobDetails(job));
}

export async function runJob(
    id: string,
    options: OutputOptions,
): Promise<void> {
    const client = await getClient();
    const response = await client.runJob(id);

    if (options.json) {
        writeJson(response);
        return;
    }

    if (options.quiet) {
        writeStdout(response.data.status);
        return;
    }

    writeStdout(successLine(response.message));
    writeStdout();
    writeStdout(formatRunJobResult(response.data));
}

export async function runDueJobs(options: OutputOptions): Promise<void> {
    const client = await getClient();
    const response = await client.runDueJobs();

    if (options.json) {
        writeJson(response);
        return;
    }

    if (options.quiet) {
        const statuses = response.data.results.map((r) => r.status).join("\n");
        if (statuses) {
            writeStdout(statuses);
        }
        return;
    }

    writeStdout(successLine(response.message));
    writeStdout();
    writeStdout(formatRunDueResult(response.data));
}

export async function listJobHistory(
    id: string,
    options: OutputOptions,
): Promise<void> {
    const client = await getClient();
    const response = await client.getJobStatus();

    const job = response.data.jobs.find((j) => j.id === id);
    if (!job) {
        throw new CliError(`Job '${id}' not found.`, 1);
    }

    if (options.json) {
        writeJson({
            success: true,
            message: "History loaded.",
            data: job.recent_runs || [],
            timestamp: response.timestamp,
        });
        return;
    }

    if (options.quiet) {
        const ids = (job.recent_runs || []).map((r) => r.id).join("\n");
        if (ids) {
            writeStdout(ids);
        }
        return;
    }

    writeStdout(successLine(`History for job ${job.id} loaded.`));
    writeStdout();
    writeStdout(formatJobHistory(job.recent_runs || []));
}

interface ClearHistoryOptions extends OutputOptions {
    job?: string;
}

export async function clearJobHistory(
    options: ClearHistoryOptions,
): Promise<void> {
    const client = await getClient();
    const response = await client.clearJobHistory(options.job);

    if (options.json) {
        writeJson(response);
        return;
    }

    if (options.quiet) {
        return;
    }

    writeStdout(successLine(response.message));
}

interface ScheduleOptions extends OutputOptions {
    interval?: string;
    preferredTime?: string;
    enabled?: boolean;
    disabled?: boolean;
}

export async function updateJobSchedule(
    id: string,
    options: ScheduleOptions,
): Promise<void> {
    const client = await getClient();

    if (options.enabled && options.disabled) {
        throw new CliError("Cannot specify both --enabled and --disabled.", 1);
    }

    const payload: {
        interval_seconds?: number;
        preferred_run_time?: string | null;
        is_enabled?: boolean;
    } = {};

    if (options.interval !== undefined) {
        const interval = parseInt(options.interval, 10);
        if (isNaN(interval) || interval <= 0) {
            throw new CliError("Interval must be a positive integer.", 1);
        }
        payload.interval_seconds = interval;
    }

    if (options.preferredTime !== undefined) {
        if (
            options.preferredTime.toLowerCase() === "none" ||
            options.preferredTime === ""
        ) {
            payload.preferred_run_time = null;
        } else if (
            /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(options.preferredTime)
        ) {
            payload.preferred_run_time = options.preferredTime;
        } else {
            throw new CliError(
                "Preferred time must be in HH:MM format or 'none'.",
                1,
            );
        }
    }

    if (options.enabled !== undefined) {
        payload.is_enabled = true;
    } else if (options.disabled !== undefined) {
        payload.is_enabled = false;
    }

    if (Object.keys(payload).length === 0) {
        throw new CliError("No schedule changes requested.", 1);
    }

    const response = await client.updateJobSchedule(id, payload);

    if (options.json) {
        writeJson(response);
        return;
    }

    if (options.quiet) {
        return;
    }

    writeStdout(successLine(response.message));
    writeStdout();
    writeStdout(formatJobDetails(response.data));
}

export async function resetJobSchedule(
    id: string,
    options: OutputOptions,
): Promise<void> {
    const client = await getClient();
    const response = await client.resetJobSchedule(id);

    if (options.json) {
        writeJson(response);
        return;
    }

    if (options.quiet) {
        return;
    }

    writeStdout(successLine(response.message));
    writeStdout();
    writeStdout(formatJobDetails(response.data));
}

interface SettingsOptions extends OutputOptions {
    retentionDays?: string;
}

export async function updateJobSettings(
    options: SettingsOptions,
): Promise<void> {
    const client = await getClient();

    if (options.retentionDays !== undefined) {
        const days = parseInt(options.retentionDays, 10);
        if (isNaN(days) || days < 0) {
            throw new CliError(
                "Retention days must be a non-negative integer.",
                1,
            );
        }

        const response = await client.updateJobSettings({
            retention_days: days,
        });

        if (options.json) {
            writeJson(response);
            return;
        }

        if (options.quiet) {
            writeStdout(String(response.data.retention_days));
            return;
        }

        writeStdout(successLine(response.message));
        return;
    }

    const response = await client.getJobStatus();

    if (options.json) {
        writeJson({
            success: true,
            message: "Settings loaded.",
            data: {
                retention_days: response.data.retention_days,
                timezone: response.data.timezone,
            },
            timestamp: response.timestamp,
        });
        return;
    }

    if (options.quiet) {
        writeStdout(String(response.data.retention_days));
        return;
    }

    writeStdout(successLine("Settings loaded."));
    writeStdout(`History retention: ${response.data.retention_days} days`);
    writeStdout(`Timezone: ${response.data.timezone}`);
}

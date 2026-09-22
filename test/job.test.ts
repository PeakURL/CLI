import test from "node:test";
import assert from "node:assert/strict";
import { runCli } from "./harness.js";

test("job command defaults to list", async () => {
    const { code, stdout } = await runCli(["job"]);
    assert.equal(code, 0);
    assert.match(stdout, /Success: Cron status loaded./);
    assert.match(stdout, /peakurl_version_check/);
});

test("job list human-readable", async () => {
    const { code, stdout } = await runCli(["job", "list"]);
    assert.equal(code, 0);
    assert.match(stdout, /Success: Cron status loaded./);
    assert.match(stdout, /peakurl_version_check/);
});

test("job list quiet", async () => {
    const { code, stdout } = await runCli(["job", "list", "--quiet"]);
    assert.equal(code, 0);
    assert.match(stdout, /peakurl_version_check/);
});

test("job list json", async () => {
    const { code, stdout } = await runCli(["job", "list", "--json"]);
    assert.equal(code, 0);
    const parsed = JSON.parse(stdout) as {
        success: boolean;
        data: { jobs: { id: string }[] };
    };
    assert.equal(parsed.success, true);
    assert.equal(parsed.data.jobs[0]?.id, "peakurl_version_check");
});

test("job get job human-readable", async () => {
    const { code, stdout } = await runCli([
        "job",
        "get",
        "peakurl_version_check",
    ]);
    assert.equal(code, 0);
    assert.match(stdout, /Success: Job peakurl_version_check loaded./);
});

test("job run job", async () => {
    const { code, stdout } = await runCli([
        "job",
        "run",
        "peakurl_version_check",
    ]);
    assert.equal(code, 0);
    assert.match(stdout, /Success: Job executed./);
});

test("job run due jobs", async () => {
    const { code, stdout } = await runCli(["job", "run-due"]);
    assert.equal(code, 0);
    assert.match(stdout, /Success: Due jobs executed./);
});

test("job history", async () => {
    const { code, stdout } = await runCli([
        "job",
        "history",
        "peakurl_version_check",
    ]);
    assert.equal(code, 0);
    assert.match(
        stdout,
        /Success: History for job peakurl_version_check loaded./,
    );
    assert.match(stdout, /run_123/);
});

test("job clear history", async () => {
    const { code, stdout } = await runCli(["job", "clear-history"]);
    assert.equal(code, 0);
    assert.match(stdout, /Success: History cleared./);
});

test("job clear history for specific job", async () => {
    const { code, stdout } = await runCli([
        "job",
        "clear-history",
        "--job",
        "peakurl_version_check",
    ]);
    assert.equal(code, 0);
    assert.match(stdout, /Success: History cleared./);
});

test("job schedule update", async () => {
    const { code, stdout } = await runCli([
        "job",
        "schedule",
        "peakurl_version_check",
        "--interval",
        "10",
        "--preferred-time",
        "12:00",
        "--enabled",
    ]);
    assert.equal(code, 0);
    assert.match(stdout, /Success: Schedule updated./);
});

test("job schedule reset", async () => {
    const { code, stdout } = await runCli([
        "job",
        "reset",
        "peakurl_version_check",
    ]);
    assert.equal(code, 0);
    assert.match(stdout, /Success: Schedule reset./);
});

test("job settings get", async () => {
    const { code, stdout } = await runCli(["job", "settings"]);
    assert.equal(code, 0);
    assert.match(stdout, /History retention: 30 days/);
});

test("job settings update", async () => {
    const { code, stdout } = await runCli([
        "job",
        "settings",
        "--retention-days",
        "15",
    ]);
    assert.equal(code, 0);
    assert.match(stdout, /Success: Settings updated./);
});

test("rejects aliases and plurals with helpful suggestions", async () => {
    const jobsRes = await runCli(["jobs", "list"]);
    assert.notEqual(jobsRes.code, 0);
    assert.match(
        jobsRes.stderr,
        /error: unknown command 'jobs'\. Did you mean 'peakurl job'\?/,
    );

    const cronRes = await runCli(["cron", "list"]);
    assert.notEqual(cronRes.code, 0);
    assert.match(
        cronRes.stderr,
        /error: unknown command 'cron'\. Did you mean 'peakurl job'\?/,
    );

    const webhooksRes = await runCli(["webhooks", "list"]);
    assert.notEqual(webhooksRes.code, 0);
    assert.match(
        webhooksRes.stderr,
        /error: unknown command 'webhooks'\. Did you mean 'peakurl webhook'\?/,
    );

    const activitiesRes = await runCli(["activities", "list"]);
    assert.notEqual(activitiesRes.code, 0);
    assert.match(
        activitiesRes.stderr,
        /error: unknown command 'activities'\. Did you mean 'peakurl activity'\?/,
    );
});

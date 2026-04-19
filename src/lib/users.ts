import type { PeakUrlUser } from "../types.js";

function readString(value: unknown): string | undefined {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/**
 * Returns the best human-readable label for a PeakURL user.
 */
export function getUserLabel(user: PeakUrlUser): string {
    const fullName = [readString(user.firstName), readString(user.lastName)]
        .filter(Boolean)
        .join(" ");
    return (
        fullName ||
        readString(user.username) ||
        readString(user.email) ||
        String(user.id ?? "unknown")
    );
}

/**
 * Returns a compact identifier for quiet user output.
 */
export function getQuietUserValue(user: PeakUrlUser): string {
    return (
        readString(user.username) ||
        readString(user.email) ||
        String(user.id ?? "")
    );
}

/**
 * Formats user fields for the default human-readable CLI output.
 */
export function formatUserDetails(user: PeakUrlUser): string {
    const lines = [
        ["Name", getUserLabel(user)],
        ["Username", readString(user.username)],
        ["Email", readString(user.email)],
        ["Role", readString(user.role)],
        ["ID", user.id === undefined ? undefined : String(user.id)],
    ].filter((entry): entry is [string, string] => Boolean(entry[1]));

    return lines.map(([label, value]) => `${label}: ${value}`).join("\n");
}

import type { User } from "../types.js";
import { formatDetailsTable } from "./output.js";

function text(value: unknown): string | undefined {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/**
 * Returns the best human-readable label for a PeakURL user.
 */
export function userLabel(user: User): string {
    const fullName = [text(user.firstName), text(user.lastName)]
        .filter((value): value is string => Boolean(value))
        .join(" ");
    return (
        fullName ||
        text(user.username) ||
        text(user.email) ||
        String(user.id ?? "unknown")
    );
}

/**
 * Returns a compact identifier for quiet user output.
 */
export function userValue(user: User): string {
    return text(user.username) || text(user.email) || String(user.id ?? "");
}

/**
 * Formats user fields for the default human-readable CLI output.
 */
export function userTable(user: User, apiBaseUrl?: string): string {
    const rows = [
        ["ID", user.id === undefined ? undefined : String(user.id)],
        ["Role", text(user.role)],
        ["Username", text(user.username)],
        ["Name", userLabel(user)],
        ["Email", text(user.email)],
    ].filter((entry): entry is [string, string] => Boolean(entry[1]));

    if (apiBaseUrl) {
        rows.push(["API URL", apiBaseUrl]);
    }

    if (rows.length === 0) {
        return "No user fields returned.";
    }

    return formatDetailsTable(rows);
}

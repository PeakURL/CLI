/**
 * Standard PeakURL API response envelope.
 */
export interface PeakUrlEnvelope<T = unknown> {
    success: boolean;
    message: string;
    data: T;
    timestamp: string;
}

/**
 * Persisted or environment-provided CLI credentials.
 */
export interface PeakUrlConfig {
    baseUrl: string;
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
 * User fields commonly returned by `GET /users/me`.
 */
export interface PeakUrlUser {
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
export interface PeakUrlLink {
    id?: string | number;
    alias?: string;
    shortCode?: string;
    shortUrl?: string;
    destinationUrl?: string;
    title?: string;
    status?: string;
    clicks?: number;
    createdAt?: string;
    updatedAt?: string;
    [key: string]: unknown;
}

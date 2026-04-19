/**
 * Command-level error with a stable exit code for CLI flows.
 */
export class CliError extends Error {
    readonly exitCode: number;

    constructor(message: string, exitCode = 1, options?: ErrorOptions) {
        super(message, options);
        this.name = "CliError";
        this.exitCode = exitCode;
    }
}

/**
 * Normalizes unknown failures into a CLI-safe error instance.
 */
export function toCliError(error: unknown): CliError {
    if (error instanceof CliError) {
        return error;
    }

    if (error instanceof Error) {
        return new CliError(error.message, 1, { cause: error });
    }

    return new CliError("Unexpected error.");
}

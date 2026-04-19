/**
 * Writes a single line to stdout.
 */
export function writeStdout(message = ""): void {
    process.stdout.write(`${message}\n`);
}

/**
 * Writes a single line to stderr.
 */
export function writeStderr(message = ""): void {
    process.stderr.write(`${message}\n`);
}

/**
 * Serializes a value as pretty JSON and writes it to stdout.
 */
export function writeJson(value: unknown): void {
    writeStdout(JSON.stringify(value, null, 2));
}

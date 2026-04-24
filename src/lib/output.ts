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

function outputStream(target: "stdout" | "stderr"): NodeJS.WriteStream {
    return target === "stdout" ? process.stdout : process.stderr;
}

function useColor(target: "stdout" | "stderr"): boolean {
    return Boolean(outputStream(target).isTTY && !process.env.NO_COLOR);
}

/**
 * Formats a successful status line for human-readable CLI output.
 *
 * @param message Message shown after the success label.
 * @param target Output stream target used to decide color support.
 * @returns Status line ready for stdout or stderr.
 */
export function successLine(
    message: string,
    target: "stdout" | "stderr" = "stdout",
): string {
    const label = useColor(target) ? "\x1b[32mSuccess\x1b[39m" : "Success";
    return `${label}: ${message}`;
}

/**
 * Formats an error status line for human-readable CLI output.
 *
 * @param message Message shown after the error label.
 * @param target Output stream target used to decide color support.
 * @returns Status line ready for stdout or stderr.
 */
export function errorLine(
    message: string,
    target: "stdout" | "stderr" = "stderr",
): string {
    const label = useColor(target) ? "\x1b[31mError\x1b[39m" : "Error";
    return `${label}: ${message}`;
}

/**
 * Writes a boxed block to stderr for notices that should stand out in the TUI.
 *
 * @param title Short heading shown in the top border.
 * @param lines Content lines rendered inside the box.
 * @param target Output stream target.
 */
export function writeNoticeBox(
    title: string,
    lines: string[],
    target: "stdout" | "stderr" = "stderr",
): void {
    const contentLines = lines.length > 0 ? lines : [""];
    const width = Math.max(
        title.length,
        ...contentLines.map((line) => line.length),
    );
    const stream = outputStream(target);
    const useTuiBox = stream.isTTY;
    const border = useTuiBox
        ? {
              topLeft: "┌",
              topRight: "┐",
              bottomLeft: "└",
              bottomRight: "┘",
              horizontal: "─",
              vertical: "│",
              separatorLeft: "├",
              separatorRight: "┤",
          }
        : {
              topLeft: "+",
              topRight: "+",
              bottomLeft: "+",
              bottomRight: "+",
              horizontal: "-",
              vertical: "|",
              separatorLeft: "+",
              separatorRight: "+",
          };
    const topBorder = `${border.topLeft}${border.horizontal.repeat(width + 2)}${border.topRight}`;
    const separator = `${border.separatorLeft}${border.horizontal.repeat(width + 2)}${border.separatorRight}`;
    const bottomBorder = `${border.bottomLeft}${border.horizontal.repeat(width + 2)}${border.bottomRight}`;
    const writeLine = target === "stdout" ? writeStdout : writeStderr;

    writeLine(topBorder);
    writeLine(`${border.vertical} ${title.padEnd(width)} ${border.vertical}`);
    writeLine(separator);

    for (const line of contentLines) {
        writeLine(
            `${border.vertical} ${line.padEnd(width)} ${border.vertical}`,
        );
    }

    writeLine(bottomBorder);
}

/**
 * Renders a plain-text table with a boxed header/body layout.
 *
 * Unicode borders are used in interactive terminals. Non-TTY output falls back
 * to ASCII so logs and captured output remain readable everywhere.
 *
 * @param headers Header labels shown in the first row.
 * @param rows Body rows shown below the header separator.
 * @param target Output stream target.
 * @returns Table string ready to write as a single block.
 */
export function formatTable(
    headers: string[],
    rows: string[][],
    target: "stdout" | "stderr" = "stdout",
): string {
    const stream = outputStream(target);
    const useTuiBox = stream.isTTY;
    const border = useTuiBox
        ? {
              topLeft: "┌",
              topRight: "┐",
              bottomLeft: "└",
              bottomRight: "┘",
              horizontal: "─",
              vertical: "│",
              separatorLeft: "├",
              separatorRight: "┤",
              topJunction: "┬",
              middleJunction: "┼",
              bottomJunction: "┴",
          }
        : {
              topLeft: "+",
              topRight: "+",
              bottomLeft: "+",
              bottomRight: "+",
              horizontal: "-",
              vertical: "|",
              separatorLeft: "+",
              separatorRight: "+",
              topJunction: "+",
              middleJunction: "+",
              bottomJunction: "+",
          };
    const getLines = (value: string | undefined): string[] =>
        (value ?? "").split("\n");
    const widths = headers.map((header, index) =>
        Math.max(
            header.length,
            ...rows.flatMap((row) =>
                getLines(row[index]).map((line) => line.length),
            ),
        ),
    );

    const formatTableBorder = (
        left: string,
        join: string,
        right: string,
    ): string =>
        `${left}${widths
            .map((width) => border.horizontal.repeat(width + 2))
            .join(join)}${right}`;

    const formatTableRow = (cells: string[]): string => {
        const linesByCell = cells.map(getLines);
        const rowHeight = Math.max(...linesByCell.map((lines) => lines.length));

        return Array.from(
            { length: rowHeight },
            (_value, rowIndex) =>
                `${border.vertical}${linesByCell
                    .map(
                        (lines, cellIndex) =>
                            ` ${(lines[rowIndex] ?? "").padEnd(widths[cellIndex])} `,
                    )
                    .join(border.vertical)}${border.vertical}`,
        ).join("\n");
    };

    return [
        formatTableBorder(border.topLeft, border.topJunction, border.topRight),
        formatTableRow(headers),
        formatTableBorder(
            border.separatorLeft,
            border.middleJunction,
            border.separatorRight,
        ),
        ...rows.map(formatTableRow),
        formatTableBorder(
            border.bottomLeft,
            border.bottomJunction,
            border.bottomRight,
        ),
    ].join("\n");
}

/**
 * Renders a professional two-column details table.
 *
 * @param rows Detail rows shown below the header separator.
 * @param target Output stream target.
 * @returns Table string ready to write as a single block.
 */
export function formatDetailsTable(
    rows: string[][],
    target: "stdout" | "stderr" = "stdout",
): string {
    return formatTable(["Detail", "Information"], rows, target);
}

/**
 * Serializes a value as pretty JSON and writes it to stdout.
 */
export function writeJson(value: unknown): void {
    writeStdout(JSON.stringify(value, null, 2));
}

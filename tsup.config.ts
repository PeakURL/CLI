import { defineConfig } from "tsup";

/**
 * Build configuration for the published PeakURL CLI binary.
 *
 * The named `peakurl` entry makes the compiled artifact land at
 * `bin/peakurl.js`, which keeps the package layout aligned with the executable
 * users actually install and run.
 */
export default defineConfig({
    entry: {
        peakurl: "src/index.ts",
    },
    outDir: "bin",
    format: ["esm"],
    target: "node20",
    clean: true,
});

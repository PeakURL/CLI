import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import prettierConfig from "eslint-config-prettier";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
    // ==========================================
    // Global Ignores
    // ==========================================
    globalIgnores([
        "bin/**",
        "dist/**",
        "node_modules/**",
        "coverage/**",
        "*.log",
    ]),

    // ==========================================
    // Base Recommended Presets
    // ==========================================
    js.configs.recommended,
    ...tseslint.configs.recommendedTypeChecked,
    ...tseslint.configs.stylisticTypeChecked,

    // ==========================================
    // TypeScript & CLI Language Options
    // ==========================================
    {
        files: ["**/*.ts"],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "module",
            globals: {
                ...globals.node,
                ...globals.es2022,
            },
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
        rules: {
            // ==========================================
            // 1. Security & Defensive Logic
            // ==========================================
            eqeqeq: ["error", "always"],
            "no-eval": "error",
            "no-implied-eval": "error",
            "no-new-func": "error",
            "no-caller": "error",
            "no-script-url": "error",
            "@typescript-eslint/ban-ts-comment": [
                "error",
                {
                    "ts-ignore": "allow-with-description",
                    "ts-expect-error": "allow-with-description",
                    minimumDescriptionLength: 3,
                },
            ],

            // ==========================================
            // 2. TypeScript & Import Hygiene
            // ==========================================
            "@typescript-eslint/consistent-type-imports": [
                "error",
                {
                    prefer: "type-imports",
                    fixStyle: "separate-type-imports",
                },
            ],
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    argsIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                    caughtErrorsIgnorePattern: "^_",
                },
            ],
            "@typescript-eslint/no-explicit-any": [
                "warn",
                {
                    ignoreRestArgs: true,
                },
            ],
            "@typescript-eslint/no-wrapper-object-types": "error",
            "@typescript-eslint/no-unsafe-function-type": "error",
            "@typescript-eslint/no-empty-object-type": "error",
            "@typescript-eslint/prefer-as-const": "error",

            // ==========================================
            // 3. CLI & Runtime Logic
            // ==========================================
            // Console is standard output in a terminal CLI application
            "no-console": "off",

            // Allow numbers and booleans inside template literals for CLI strings
            "@typescript-eslint/restrict-template-expressions": [
                "error",
                {
                    allowNumber: true,
                    allowBoolean: true,
                },
            ],

            // The codebase intentionally uses || for falsy-coalescing in string defaults
            "@typescript-eslint/prefer-nullish-coalescing": "off",

            // Allow string | "literal" unions for documentation readability
            "@typescript-eslint/no-redundant-type-constituents": "off",

            // ==========================================
            // 4. Modern Code Quality & Standards
            // ==========================================
            "prefer-const": "error",
            "no-var": "error",
            "prefer-template": "warn",
            "object-shorthand": ["warn", "always"],
            "no-useless-concat": "error",
            "no-useless-rename": "error",
            "no-empty": ["error", { allowEmptyCatch: true }],
            "no-debugger": "error",
        },
    },

    // ==========================================
    // Config & Build Script Overrides
    // ==========================================
    {
        files: ["*.config.{js,ts}", "scripts/**/*.{js,ts}"],
        ...tseslint.configs.disableTypeChecked,
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "module",
            globals: {
                ...globals.node,
            },
        },
    },

    // ==========================================
    // Test Files (relax rules conflicting with node:test)
    // ==========================================
    {
        files: ["test/**/*.ts"],
        rules: {
            "no-script-url": "off",
            "@typescript-eslint/no-floating-promises": "off",
            "@typescript-eslint/no-unsafe-call": "off",
            "@typescript-eslint/no-unsafe-member-access": "off",
            "@typescript-eslint/no-unsafe-argument": "off",
            "@typescript-eslint/no-misused-promises": "off",
            "@typescript-eslint/no-base-to-string": "off",
        },
    },

    // ==========================================
    // Prettier Formatting Overrides
    // ==========================================
    prettierConfig,
]);
